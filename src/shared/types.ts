export type OutputMode = 'code-only' | 'code-and-brief' | 'diff-only' | 'detailed';

export type QuickActionType = 'send' | 'fix' | 'refactor' | 'tests' | 'explain';

export type UserAgentMode = 'auto' | 'chrome-mac' | 'chrome-win' | 'firefox-mac' | 'firefox-win' | 'custom';

export interface ChatbotProvider {
  id: string;
  name: string;
  url: string;
  builtIn?: boolean;
}

export interface OperatingPreset {
  id: string;
  name: string;
  role: string;
  targetLanguage: string;
  outputMode: OutputMode;
  customRules: string;
  prefix: string;
  suffix: string;
}

export interface SessionSettings {
  profileId: string;
  autoSubmit: boolean;
  autoCopyGeneratedCode: boolean;
  clipboardPollingEnabled: boolean;
  clipboardPollIntervalMs: number;
  zoomFactor: number;
  userAgentMode: UserAgentMode;
  customUserAgent: string;
}

export interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export interface WindowSettings {
  alwaysOnTop: boolean;
  opacity: number;
  fullOpacityOnFocus: boolean;
  sidebarOpen: boolean;
  sidebarWidth: number;
  bounds: WindowBounds;
}

export interface AppConfig {
  activeProviderId: string;
  activeUrl: string;
  providers: ChatbotProvider[];
  activePresetId: string;
  presets: OperatingPreset[];
  session: SessionSettings;
  window: WindowSettings;
}

export interface ClipboardEntry {
  id: string;
  text: string;
  timestamp: number;
  lineCount: number;
  charCount: number;
}

export interface ExtractedCodeBlock {
  id: string;
  language: string;
  code: string;
  lineCount: number;
  hash: string;
}

export interface PromptBuildInput {
  preset: OperatingPreset;
  code: string;
  action: QuickActionType;
  userInstruction?: string;
}

export interface WebViewBoundsInput {
  contentWidth: number;
  contentHeight: number;
  topBarHeight: number;
  statusBarHeight: number;
  sidebarOpen: boolean;
  sidebarWidth: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NavigationState {
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  error?: string;
}

export interface AppSnapshot {
  config: AppConfig;
  navigation: NavigationState;
  latestClipboard: ClipboardEntry | null;
  clipboardHistory: ClipboardEntry[];
  extractedCodeBlocks: ExtractedCodeBlock[];
  profiles: string[];
}

export interface ToastPayload {
  message: string;
  kind: 'info' | 'success' | 'error';
}

export interface InjectResult {
  ok: boolean;
  method: string;
  submitted: boolean;
  error?: string;
}

export interface AssistantAPI {
  getSnapshot: () => Promise<AppSnapshot>;
  navigate: (url: string, providerId?: string) => Promise<{ ok: boolean; url?: string; error?: string }>;
  navBack: () => Promise<void>;
  navForward: () => Promise<void>;
  navReload: () => Promise<void>;
  addProvider: (name: string, url: string) => Promise<{ ok: boolean; provider?: ChatbotProvider; error?: string }>;
  removeProvider: (id: string) => Promise<boolean>;
  setAlwaysOnTop: (enabled: boolean) => Promise<AppConfig>;
  setOpacity: (opacity: number) => Promise<AppConfig>;
  setFullOpacityOnFocus: (enabled: boolean) => Promise<AppConfig>;
  setSidebarOpen: (open: boolean) => Promise<AppConfig>;
  setActivePreset: (presetId: string) => Promise<AppConfig>;
  upsertPreset: (preset: OperatingPreset) => Promise<AppConfig>;
  deletePreset: (presetId: string) => Promise<AppConfig>;
  updateSession: (patch: Partial<SessionSettings>) => Promise<AppConfig>;
  clearProfileSession: () => Promise<{ ok: boolean }>;
  injectPrompt: (
    action: QuickActionType,
    code: string,
    userInstruction?: string,
  ) => Promise<InjectResult>;
  copyOutputToClipboard: (code: string) => Promise<{ ok: boolean }>;
  refreshCodeBlocks: () => Promise<ExtractedCodeBlock[]>;
  clearClipboardHistory: () => Promise<void>;
  onConfigUpdate: (cb: (config: AppConfig) => void) => () => void;
  onNavigationUpdate: (cb: (nav: NavigationState) => void) => () => void;
  onClipboardUpdate: (cb: (payload: { latest: ClipboardEntry | null; history: ClipboardEntry[] }) => void) => () => void;
  onCodeBlocksUpdate: (cb: (blocks: ExtractedCodeBlock[]) => void) => () => void;
  onToast: (cb: (toast: ToastPayload) => void) => () => void;
}
