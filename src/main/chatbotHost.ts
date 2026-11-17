import { app, BrowserWindow, Session, WebContentsView, session } from 'electron';
import { CHROME_USER_AGENTS, FIREFOX_USER_AGENTS } from '../shared/defaults';
import { calculateWebViewBounds, clampOpacity } from '../shared/layoutMath';
import {
  AppConfig,
  ExtractedCodeBlock,
  NavigationState,
  UserAgentMode,
} from '../shared/types';
import { isAllowedNavigationUrl, normalizeChatbotUrl } from '../shared/urlUtils';
import {
  extractCodeBlocksFromChatbot,
  injectPromptIntoChatbot,
  InjectPromptResult,
} from './chatbotBridge';
import { ClipboardWatcher } from './clipboardWatcher';
import { ConfigStore } from './store';

export const TOP_BAR_HEIGHT = 54;
export const STATUS_BAR_HEIGHT = 26;
const CODE_POLL_INTERVAL_MS = 2500;

export interface HostCallbacks {
  onNavigation: (state: NavigationState) => void;
  onCodeBlocks: (blocks: ExtractedCodeBlock[]) => void;
  onConfig: (config: AppConfig) => void;
  onToast: (message: string, kind: 'info' | 'success' | 'error') => void;
}

export function cleanChromiumUserAgent(rawUa: string): string {
  return rawUa
    .replace(/\s*Electron\/\S+/g, '')
    .replace(/\s*ide-chatbot-assistant\/\S+/gi, '')
    .replace(/\s*IDE Chatbot Assistant\/\S+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function resolveUserAgent(mode: UserAgentMode, customUa: string): string {
  if (mode === 'chrome-mac') {
    return CHROME_USER_AGENTS.mac;
  }
  if (mode === 'chrome-win') {
    return CHROME_USER_AGENTS.win;
  }
  if (mode === 'firefox-mac') {
    return FIREFOX_USER_AGENTS.mac;
  }
  if (mode === 'firefox-win') {
    return FIREFOX_USER_AGENTS.win;
  }
  if (mode === 'custom' && customUa.trim()) {
    return customUa.trim();
  }
  const fallback = cleanChromiumUserAgent(app.userAgentFallback || '');
  if (fallback.includes('Chrome/')) {
    return fallback;
  }
  const chromeVer = process.versions.chrome || '130.0.6723.191';
  return process.platform === 'win32'
    ? `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`
    : `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`;
}

/**
 * Owns the BrowserWindow shell, embedded WebContentsView, session partitions, opacity/AoT, and DOM polling.
 */
export class ChatbotHost {
  private readonly mainWindow: BrowserWindow;
  private readonly store: ConfigStore;
  private readonly clipboardWatcher: ClipboardWatcher;
  private readonly callbacks: HostCallbacks;
  private readonly configuredSessions = new WeakSet<Session>();

  private chatbotView: WebContentsView | null = null;
  private activeProfileId = '';
  private navState: NavigationState = {
    url: '',
    title: '',
    canGoBack: false,
    canGoForward: false,
    isLoading: false,
  };
  private extractedBlocks: ExtractedCodeBlock[] = [];
  private codePollTimer: NodeJS.Timeout | null = null;
  private isCodePollInFlight = false;
  private disposed = false;
  private boundsSaveTimer: NodeJS.Timeout | null = null;
  private navSaveTimer: NodeJS.Timeout | null = null;
  private lastAppliedOpacity: number | null = null;
  private lastStableBlockHash = '';
  private pendingCandidateHash = '';
  private opacityPreviewUntil = 0;

  constructor(
    mainWindow: BrowserWindow,
    store: ConfigStore,
    clipboardWatcher: ClipboardWatcher,
    callbacks: HostCallbacks,
  ) {
    this.mainWindow = mainWindow;
    this.store = store;
    this.clipboardWatcher = clipboardWatcher;
    this.callbacks = callbacks;

    this.bindWindowEvents();
  }

  private bindWindowEvents(): void {
    const relayout = () => this.updateBounds();
    this.mainWindow.on('resize', relayout);
    this.mainWindow.on('maximize', relayout);
    this.mainWindow.on('unmaximize', relayout);

    this.mainWindow.on('focus', () => this.applyWindowOpacity());
    this.mainWindow.on('blur', () => {
      this.opacityPreviewUntil = 0;
      this.applyWindowOpacity();
    });

    this.mainWindow.on('moved', () => this.scheduleSaveWindowBounds());
    this.mainWindow.on('resized', () => this.scheduleSaveWindowBounds());
  }

  private scheduleSaveWindowBounds(): void {
    if (this.boundsSaveTimer) {
      clearTimeout(this.boundsSaveTimer);
    }
    this.boundsSaveTimer = setTimeout(() => {
      this.boundsSaveTimer = null;
      if (this.mainWindow.isDestroyed() || this.mainWindow.isMinimized() || this.mainWindow.isMaximized()) {
        return;
      }
      const bounds = this.mainWindow.getBounds();
      this.store.updateWindowSettings({ bounds });
    }, 400);
  }

  private scheduleSaveActiveTarget(url: string): void {
    if (this.navSaveTimer) {
      clearTimeout(this.navSaveTimer);
    }
    this.navSaveTimer = setTimeout(() => {
      this.navSaveTimer = null;
      this.store.setActiveTarget(url);
    }, 500);
  }

  init(): void {
    const config = this.store.getConfig();
    this.applyAlwaysOnTop(config.window.alwaysOnTop);
    this.applyWindowOpacity();
    this.mountChatbotView(config.session.profileId);
    this.navigate(config.activeUrl, config.activeProviderId);
    this.scheduleNextCodePoll();
  }

  dispose(): void {
    this.disposed = true;
    if (this.codePollTimer) {
      clearTimeout(this.codePollTimer);
      this.codePollTimer = null;
    }
    if (this.boundsSaveTimer) {
      clearTimeout(this.boundsSaveTimer);
      this.boundsSaveTimer = null;
    }
    if (this.navSaveTimer) {
      clearTimeout(this.navSaveTimer);
      this.navSaveTimer = null;
    }
  }

  private getSessionForProfile(profileId: string): Session {
    const safeProfile = profileId.replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
    return session.fromPartition(`persist:chatbot-${safeProfile}`);
  }

  private ensureSessionHeaderInterceptor(ses: Session): void {
    if (this.configuredSessions.has(ses)) {
      return;
    }
    this.configuredSessions.add(ses);

    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      const { userAgentMode, customUserAgent } = this.store.getConfig().session;
      const ua = resolveUserAgent(userAgentMode, customUserAgent);
      const headers = { ...details.requestHeaders };
      headers['User-Agent'] = ua;

      if (userAgentMode.startsWith('firefox')) {
        for (const key of Object.keys(headers)) {
          if (key.toLowerCase().startsWith('sec-ch-ua')) {
            delete headers[key];
          }
        }
      } else {
        for (const key of Object.keys(headers)) {
          if (key.toLowerCase() === 'sec-ch-ua' && typeof headers[key] === 'string') {
            headers[key] = headers[key].replace(/,?\s*"Electron";v="[^"]*"/gi, '').trim();
          }
        }
      }

      callback({ requestHeaders: headers });
    });
  }

  private applySessionPreferences(ses: Session, config: AppConfig): void {
    const ua = resolveUserAgent(config.session.userAgentMode, config.session.customUserAgent);
    ses.setUserAgent(ua);
    this.ensureSessionHeaderInterceptor(ses);
    if (this.chatbotView && !this.chatbotView.webContents.isDestroyed()) {
      this.chatbotView.webContents.setUserAgent(ua);
      this.chatbotView.webContents.setZoomFactor(config.session.zoomFactor);
    }
  }

  private mountChatbotView(profileId: string): void {
    if (this.chatbotView) {
      this.mainWindow.contentView.removeChildView(this.chatbotView);
      if (!this.chatbotView.webContents.isDestroyed()) {
        this.chatbotView.webContents.close();
      }
      this.chatbotView = null;
    }

    this.activeProfileId = profileId;
    const config = this.store.getConfig();
    const ses = this.getSessionForProfile(profileId);
    const ua = resolveUserAgent(config.session.userAgentMode, config.session.customUserAgent);
    ses.setUserAgent(ua);
    this.ensureSessionHeaderInterceptor(ses);

    const view = new WebContentsView({
      webPreferences: {
        session: ses,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: true,
        backgroundThrottling: false,
      },
    });

    view.webContents.setUserAgent(ua);
    view.webContents.setZoomFactor(config.session.zoomFactor);

    // Allow OAuth/SSO popups (Google, GitHub, Microsoft, Apple) sharing the exact same persistent session
    view.webContents.setWindowOpenHandler(({ url }) => {
      if (!isAllowedNavigationUrl(url)) {
        return { action: 'deny' };
      }
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 540,
          height: 700,
          parent: this.mainWindow,
          autoHideMenuBar: true,
          webPreferences: {
            session: ses,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            backgroundThrottling: false,
          },
        },
      };
    });

    view.webContents.on('did-create-window', (childWindow) => {
      const currentCfg = this.store.getConfig();
      const childUa = resolveUserAgent(
        currentCfg.session.userAgentMode,
        currentCfg.session.customUserAgent,
      );
      childWindow.webContents.setUserAgent(childUa);
      if (currentCfg.window.alwaysOnTop) {
        childWindow.setAlwaysOnTop(true, 'floating');
      }
    });

    view.webContents.on('will-navigate', (event, targetUrl) => {
      if (!isAllowedNavigationUrl(targetUrl)) {
        event.preventDefault();
      }
    });

    const emitNav = (error?: string) => {
      if (view.webContents.isDestroyed()) {
        return;
      }
      this.navState = {
        url: view.webContents.getURL() || this.navState.url,
        title: view.webContents.getTitle() || '',
        canGoBack: view.webContents.navigationHistory.canGoBack(),
        canGoForward: view.webContents.navigationHistory.canGoForward(),
        isLoading: view.webContents.isLoading(),
        error,
      };
      this.callbacks.onNavigation(this.navState);
    };

    view.webContents.on('did-start-loading', () => emitNav());
    view.webContents.on('did-stop-loading', () => {
      emitNav();
      void this.refreshCodeBlocks();
    });
    view.webContents.on('did-navigate', (_e, url) => {
      this.scheduleSaveActiveTarget(url);
      emitNav();
      if (url.includes('accounts.google.com')) {
        this.callbacks.onToast(
          'Google Login: se compare "browser non sicuro", prova User-Agent Firefox in Parametri o accedi con Email/Password sul provider.',
          'info',
        );
      }
    });
    view.webContents.on('did-navigate-in-page', (_e, url) => {
      this.scheduleSaveActiveTarget(url);
      emitNav();
    });
    view.webContents.on('page-title-updated', () => emitNav());
    view.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
      if (errorCode === -3) {
        return; // Ignore benign aborted navigations
      }
      emitNav(`Errore caricamento (${errorCode}) per ${validatedURL}: ${errorDescription}`);
    });

    // Mask navigator.userAgentData when emulating Firefox so headers & JS match
    view.webContents.on('dom-ready', () => {
      const { userAgentMode } = this.store.getConfig().session;
      if (userAgentMode.startsWith('firefox') && !view.webContents.isDestroyed()) {
        void view.webContents
          .executeJavaScript(
            '(() => { try { Object.defineProperty(Navigator.prototype, "userAgentData", { get: () => undefined, configurable: true }); } catch {} return true; })()',
            false,
          )
          .catch(() => {});
      }
    });

    this.chatbotView = view;
    this.mainWindow.contentView.addChildView(view);
    this.updateBounds();
  }

  updateBounds(): void {
    if (this.mainWindow.isDestroyed() || !this.chatbotView) {
      return;
    }
    const [contentWidth, contentHeight] = this.mainWindow.getContentSize();
    const { sidebarOpen, sidebarWidth } = this.store.getConfig().window;
    const rect = calculateWebViewBounds({
      contentWidth,
      contentHeight,
      topBarHeight: TOP_BAR_HEIGHT,
      statusBarHeight: STATUS_BAR_HEIGHT,
      sidebarOpen,
      sidebarWidth,
    });
    this.chatbotView.setBounds(rect);
  }

  navigate(rawUrl: string, providerId?: string): { ok: boolean; url?: string; error?: string } {
    const normalized = normalizeChatbotUrl(rawUrl);
    if (!normalized) {
      return { ok: false, error: 'URL non valido. Inserisci un indirizzo http(s) valido.' };
    }

    const updated = this.store.setActiveTarget(normalized, providerId);
    this.callbacks.onConfig(updated);

    if (this.chatbotView && !this.chatbotView.webContents.isDestroyed()) {
      this.navState = { ...this.navState, url: normalized, isLoading: true, error: undefined };
      this.callbacks.onNavigation(this.navState);
      void this.chatbotView.webContents.loadURL(normalized);
    }

    return { ok: true, url: normalized };
  }

  goBack(): void {
    if (this.chatbotView && this.chatbotView.webContents.navigationHistory.canGoBack()) {
      this.chatbotView.webContents.navigationHistory.goBack();
    }
  }

  goForward(): void {
    if (this.chatbotView && this.chatbotView.webContents.navigationHistory.canGoForward()) {
      this.chatbotView.webContents.navigationHistory.goForward();
    }
  }

  reload(): void {
    if (this.chatbotView && !this.chatbotView.webContents.isDestroyed()) {
      this.chatbotView.webContents.reload();
    }
  }

  applyAlwaysOnTop(enabled: boolean): AppConfig {
    const config = this.store.updateWindowSettings({ alwaysOnTop: enabled });
    if (!this.mainWindow.isDestroyed()) {
      this.mainWindow.setAlwaysOnTop(enabled, 'floating');
      if (process.platform === 'darwin') {
        this.mainWindow.setVisibleOnAllWorkspaces(enabled, { visibleOnFullScreen: true });
      }
    }
    this.callbacks.onConfig(config);
    return config;
  }

  setOpacity(rawOpacity: number): AppConfig {
    const clamped = clampOpacity(rawOpacity);
    this.opacityPreviewUntil = Date.now() + 1500;
    const config = this.store.updateWindowSettings({ opacity: clamped });
    this.applyWindowOpacity();
    this.callbacks.onConfig(config);
    return config;
  }

  setFullOpacityOnFocus(enabled: boolean): AppConfig {
    const config = this.store.updateWindowSettings({ fullOpacityOnFocus: enabled });
    this.opacityPreviewUntil = 0;
    this.applyWindowOpacity();
    this.callbacks.onConfig(config);
    return config;
  }

  private applyWindowOpacity(): void {
    if (this.mainWindow.isDestroyed()) {
      return;
    }
    const { opacity, fullOpacityOnFocus } = this.store.getConfig().window;
    const previewActive = Date.now() < this.opacityPreviewUntil;
    const shouldBoost = fullOpacityOnFocus && this.mainWindow.isFocused() && !previewActive;
    const targetOpacity = shouldBoost ? 1.0 : clampOpacity(opacity);

    if (this.lastAppliedOpacity !== targetOpacity) {
      this.lastAppliedOpacity = targetOpacity;
      this.mainWindow.setOpacity(targetOpacity);
    }
  }

  setSidebarOpen(open: boolean): AppConfig {
    const config = this.store.updateWindowSettings({ sidebarOpen: open });
    this.updateBounds();
    this.callbacks.onConfig(config);
    return config;
  }

  updateSessionSettings(patch: Partial<AppConfig['session']>): AppConfig {
    const prevProfile = this.activeProfileId;
    const prevUaMode = this.store.getConfig().session.userAgentMode;
    const config = this.store.updateSessionSettings(patch);
    this.clipboardWatcher.configure(
      config.session.clipboardPollingEnabled,
      config.session.clipboardPollIntervalMs,
    );

    if (config.session.profileId !== prevProfile) {
      this.mountChatbotView(config.session.profileId);
      this.navigate(config.activeUrl, config.activeProviderId);
    } else {
      const ses = this.getSessionForProfile(config.session.profileId);
      this.applySessionPreferences(ses, config);
      if (config.session.userAgentMode !== prevUaMode) {
        this.reload();
      }
    }

    this.callbacks.onConfig(config);
    return config;
  }

  async clearActiveProfileSession(): Promise<void> {
    const ses = this.getSessionForProfile(this.activeProfileId);
    await ses.clearStorageData();
    await ses.clearCache();
    this.reload();
    this.callbacks.onToast('Sessione e cookie cancellati per il profilo corrente.', 'info');
  }

  async injectPrompt(promptText: string): Promise<InjectPromptResult> {
    if (!this.chatbotView) {
      return { ok: false, method: 'none', submitted: false, error: 'Vista chatbot non inizializzata.' };
    }
    const { autoSubmit } = this.store.getConfig().session;
    return injectPromptIntoChatbot(this.chatbotView.webContents, promptText, autoSubmit);
  }

  private scheduleNextCodePoll(): void {
    if (this.disposed) {
      return;
    }
    this.codePollTimer = setTimeout(async () => {
      if (this.disposed) {
        return;
      }
      if (
        this.chatbotView &&
        !this.chatbotView.webContents.isDestroyed() &&
        !this.chatbotView.webContents.isLoading()
      ) {
        await this.refreshCodeBlocks();
      }
      this.scheduleNextCodePoll();
    }, CODE_POLL_INTERVAL_MS);
  }

  async refreshCodeBlocks(): Promise<ExtractedCodeBlock[]> {
    if (
      this.isCodePollInFlight ||
      !this.chatbotView ||
      this.chatbotView.webContents.isDestroyed()
    ) {
      return this.extractedBlocks;
    }

    this.isCodePollInFlight = true;
    try {
      const blocks = await extractCodeBlocksFromChatbot(this.chatbotView.webContents);
      const serializedPrev = this.extractedBlocks.map((b) => b.hash).join(',');
      const serializedNext = blocks.map((b) => b.hash).join(',');

      if (serializedPrev !== serializedNext) {
        this.extractedBlocks = blocks;
        this.callbacks.onCodeBlocks(blocks);
      }

      const latest = blocks[blocks.length - 1];
      if (latest && this.store.getConfig().session.autoCopyGeneratedCode) {
        if (latest.hash !== this.lastStableBlockHash) {
          if (this.pendingCandidateHash === latest.hash) {
            this.lastStableBlockHash = latest.hash;
            this.pendingCandidateHash = '';
            this.clipboardWatcher.writeOutputToClipboard(latest.code);
            this.callbacks.onToast('Nuovo blocco codice copiato automaticamente in clipboard!', 'success');
          } else {
            this.pendingCandidateHash = latest.hash;
          }
        }
      }

      return blocks;
    } finally {
      this.isCodePollInFlight = false;
    }
  }

  getNavigationState(): NavigationState {
    return this.navState;
  }

  getExtractedBlocks(): ExtractedCodeBlock[] {
    return this.extractedBlocks;
  }
}
