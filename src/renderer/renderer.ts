import type {
  AppConfig,
  AssistantAPI,
  ClipboardEntry,
  ExtractedCodeBlock,
  NavigationState,
  OperatingPreset,
  OutputMode,
  QuickActionType,
  ToastPayload,
  UserAgentMode,
} from '../shared/types';

declare global {
  interface Window {
    assistantAPI: AssistantAPI;
  }
}

const api = window.assistantAPI;

let currentConfig: AppConfig | null = null;
let toastTimer: number | null = null;

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing element #${id}`);
  }
  return el as T;
}

const els = {
  btnSidebar: byId<HTMLButtonElement>('btn-sidebar'),
  btnBack: byId<HTMLButtonElement>('btn-back'),
  btnForward: byId<HTMLButtonElement>('btn-forward'),
  btnReload: byId<HTMLButtonElement>('btn-reload'),
  providerSelect: byId<HTMLSelectElement>('provider-select'),
  urlForm: byId<HTMLFormElement>('url-form'),
  urlInput: byId<HTMLInputElement>('url-input'),
  btnAot: byId<HTMLButtonElement>('btn-aot'),
  opacitySlider: byId<HTMLInputElement>('opacity-slider'),
  opacityValue: byId<HTMLSpanElement>('opacity-value'),
  sidebar: byId<HTMLElement>('sidebar'),
  clipboardPreview: byId<HTMLTextAreaElement>('clipboard-preview'),
  clipboardMeta: byId<HTMLSpanElement>('clipboard-meta'),
  userInstruction: byId<HTMLInputElement>('user-instruction'),
  clipboardHistory: byId<HTMLDivElement>('clipboard-history'),
  btnClearHistory: byId<HTMLButtonElement>('btn-clear-history'),
  btnCopyLatestOutput: byId<HTMLButtonElement>('btn-copy-latest-output'),
  presetSelect: byId<HTMLSelectElement>('preset-select'),
  btnNewPreset: byId<HTMLButtonElement>('btn-new-preset'),
  btnDeletePreset: byId<HTMLButtonElement>('btn-delete-preset'),
  presetForm: byId<HTMLFormElement>('preset-form'),
  presetName: byId<HTMLInputElement>('preset-name'),
  presetLang: byId<HTMLInputElement>('preset-lang'),
  presetOutput: byId<HTMLSelectElement>('preset-output'),
  presetRole: byId<HTMLTextAreaElement>('preset-role'),
  presetRules: byId<HTMLTextAreaElement>('preset-rules'),
  presetPrefix: byId<HTMLInputElement>('preset-prefix'),
  presetSuffix: byId<HTMLInputElement>('preset-suffix'),
  chkAutoSubmit: byId<HTMLInputElement>('chk-auto-submit'),
  chkAutoCopy: byId<HTMLInputElement>('chk-auto-copy'),
  chkPolling: byId<HTMLInputElement>('chk-polling'),
  chkFocusOpacity: byId<HTMLInputElement>('chk-focus-opacity'),
  sessionProfile: byId<HTMLSelectElement>('session-profile'),
  sessionZoom: byId<HTMLInputElement>('session-zoom'),
  zoomLabel: byId<HTMLSpanElement>('zoom-label'),
  sessionUa: byId<HTMLSelectElement>('session-ua'),
  customUaWrap: byId<HTMLDivElement>('custom-ua-wrap'),
  sessionCustomUa: byId<HTMLInputElement>('session-custom-ua'),
  btnClearSession: byId<HTMLButtonElement>('btn-clear-session'),
  addProviderForm: byId<HTMLFormElement>('add-provider-form'),
  newProviderName: byId<HTMLInputElement>('new-provider-name'),
  newProviderUrl: byId<HTMLInputElement>('new-provider-url'),
  customProvidersList: byId<HTMLDivElement>('custom-providers-list'),
  btnRefreshBlocks: byId<HTMLButtonElement>('btn-refresh-blocks'),
  outputBlocksList: byId<HTMLDivElement>('output-blocks-list'),
  outputBadge: byId<HTMLSpanElement>('output-badge'),
  statusIndicator: byId<HTMLSpanElement>('status-indicator'),
  statusUrl: byId<HTMLSpanElement>('status-url'),
  statusProfile: byId<HTMLSpanElement>('status-profile'),
  toastBar: byId<HTMLDivElement>('toast-bar'),
};

function showToast(payload: ToastPayload): void {
  els.toastBar.textContent = payload.message;
  els.toastBar.className = `toast-bar ${payload.kind}`;
  if (toastTimer !== null) {
    window.clearTimeout(toastTimer);
  }
  toastTimer = window.setTimeout(() => {
    els.toastBar.textContent = '';
    els.toastBar.className = 'toast-bar';
  }, 4500);
}

function renderProviders(config: AppConfig): void {
  els.providerSelect.innerHTML = '';
  for (const p of config.providers) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    els.providerSelect.appendChild(opt);
  }

  const customOpt = document.createElement('option');
  customOpt.value = '__custom__';
  customOpt.textContent = 'URL Manuale...';
  els.providerSelect.appendChild(customOpt);

  const matched = config.providers.find(
    (p) => p.id === config.activeProviderId || config.activeUrl.startsWith(p.url),
  );
  els.providerSelect.value = matched ? matched.id : '__custom__';

  els.customProvidersList.innerHTML = '';
  const customOnly = config.providers.filter((p) => !p.builtIn);
  if (customOnly.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Nessun chatbot personalizzato aggiunto.';
    els.customProvidersList.appendChild(empty);
    return;
  }

  for (const p of customOnly) {
    const row = document.createElement('div');
    row.className = 'history-item';

    const label = document.createElement('span');
    label.className = 'history-snippet';
    label.textContent = `${p.name} — ${p.url}`;
    label.addEventListener('click', () => {
      void api.navigate(p.url, p.id);
    });

    const del = document.createElement('button');
    del.className = 'link-btn danger';
    del.textContent = 'Rimuovi';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      void api.removeProvider(p.id);
    });

    row.append(label, del);
    els.customProvidersList.appendChild(row);
  }
}

function populatePresetForm(preset: OperatingPreset): void {
  els.presetName.value = preset.name;
  els.presetLang.value = preset.targetLanguage;
  els.presetOutput.value = preset.outputMode;
  els.presetRole.value = preset.role;
  els.presetRules.value = preset.customRules;
  els.presetPrefix.value = preset.prefix;
  els.presetSuffix.value = preset.suffix;
}

function renderPresets(config: AppConfig): void {
  els.presetSelect.innerHTML = '';
  for (const preset of config.presets) {
    const opt = document.createElement('option');
    opt.value = preset.id;
    opt.textContent = preset.name;
    els.presetSelect.appendChild(opt);
  }
  els.presetSelect.value = config.activePresetId;
  els.btnDeletePreset.disabled = config.presets.length <= 1;

  const active = config.presets.find((p) => p.id === config.activePresetId) ?? config.presets[0];
  if (active) {
    populatePresetForm(active);
  }
}

function renderConfig(config: AppConfig): void {
  currentConfig = config;

  els.btnAot.classList.toggle('active', config.window.alwaysOnTop);
  const pct = Math.round(config.window.opacity * 100);
  els.opacitySlider.value = String(pct);
  els.opacityValue.textContent = `${pct}%`;

  els.sidebar.classList.toggle('collapsed', !config.window.sidebarOpen);
  els.btnSidebar.classList.toggle('active', config.window.sidebarOpen);

  if (document.activeElement !== els.urlInput) {
    els.urlInput.value = config.activeUrl;
  }

  els.chkAutoSubmit.checked = config.session.autoSubmit;
  els.chkAutoCopy.checked = config.session.autoCopyGeneratedCode;
  els.chkPolling.checked = config.session.clipboardPollingEnabled;
  els.chkFocusOpacity.checked = config.window.fullOpacityOnFocus;

  els.sessionProfile.value = config.session.profileId;
  const zoomPct = Math.round(config.session.zoomFactor * 100);
  els.sessionZoom.value = String(zoomPct);
  els.zoomLabel.textContent = `${zoomPct}%`;
  els.sessionUa.value = config.session.userAgentMode;
  els.sessionCustomUa.value = config.session.customUserAgent;
  els.customUaWrap.classList.toggle('hidden', config.session.userAgentMode !== 'custom');

  els.statusProfile.textContent = `Profilo: ${config.session.profileId}`;

  renderProviders(config);
  renderPresets(config);
}

function renderNavigation(nav: NavigationState): void {
  els.btnBack.disabled = !nav.canGoBack;
  els.btnForward.disabled = !nav.canGoForward;

  if (nav.url && document.activeElement !== els.urlInput) {
    els.urlInput.value = nav.url;
  }

  els.statusUrl.textContent = nav.error ? nav.error : nav.url || 'Pronto';
  els.statusIndicator.className = 'status-dot';
  if (nav.error) {
    els.statusIndicator.classList.add('error');
  } else if (nav.isLoading) {
    els.statusIndicator.classList.add('loading');
  }
}

function renderClipboard(latest: ClipboardEntry | null, history: ClipboardEntry[]): void {
  if (latest) {
    els.clipboardPreview.value = latest.text;
    els.clipboardMeta.textContent = `${latest.lineCount} righe • ${latest.charCount} car.`;
  } else if (!els.clipboardPreview.value) {
    els.clipboardMeta.textContent = 'Vuoto';
  }

  els.clipboardHistory.innerHTML = '';
  if (history.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Nessuna copia recente dall’IDE.';
    els.clipboardHistory.appendChild(empty);
    return;
  }

  for (const item of history) {
    const row = document.createElement('div');
    row.className = 'history-item';

    const snippet = document.createElement('span');
    snippet.className = 'history-snippet';
    snippet.textContent = item.text.replace(/\s+/g, ' ').slice(0, 70);

    const meta = document.createElement('span');
    meta.className = 'history-meta';
    meta.textContent = `${item.lineCount}L`;

    row.addEventListener('click', () => {
      els.clipboardPreview.value = item.text;
      els.clipboardMeta.textContent = `${item.lineCount} righe • ${item.charCount} car.`;
    });

    row.append(snippet, meta);
    els.clipboardHistory.appendChild(row);
  }
}

function renderExtractedBlocks(blocks: ExtractedCodeBlock[]): void {
  els.outputBadge.textContent = String(blocks.length);
  els.outputBlocksList.innerHTML = '';

  if (blocks.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Nessun blocco di codice rilevato nella chat corrente.';
    els.outputBlocksList.appendChild(empty);
    return;
  }

  const reversed = [...blocks].reverse();
  for (const block of reversed) {
    const card = document.createElement('div');
    card.className = 'block-card';

    const header = document.createElement('div');
    header.className = 'block-card-header';

    const title = document.createElement('span');
    title.textContent = `${block.language} • ${block.lineCount} righe`;

    const copyBtn = document.createElement('button');
    copyBtn.className = 'accent-btn compact';
    copyBtn.textContent = 'Copia → IDE';
    copyBtn.addEventListener('click', () => {
      void api.copyOutputToClipboard(block.code);
    });

    header.append(title, copyBtn);

    const pre = document.createElement('pre');
    pre.textContent = block.code;

    card.append(header, pre);
    els.outputBlocksList.appendChild(card);
  }
}

function bindEvents(): void {
  // Tabs
  document.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      if (target) {
        document.getElementById(`tab-${target}`)?.classList.add('active');
      }
    });
  });

  // Top navigation
  els.btnSidebar.addEventListener('click', () => {
    if (!currentConfig) return;
    void api.setSidebarOpen(!currentConfig.window.sidebarOpen);
  });
  els.btnBack.addEventListener('click', () => void api.navBack());
  els.btnForward.addEventListener('click', () => void api.navForward());
  els.btnReload.addEventListener('click', () => void api.navReload());

  els.providerSelect.addEventListener('change', () => {
    if (!currentConfig) return;
    const selectedId = els.providerSelect.value;
    if (selectedId === '__custom__') {
      els.urlInput.focus();
      els.urlInput.select();
      return;
    }
    const provider = currentConfig.providers.find((p) => p.id === selectedId);
    if (provider) {
      void api.navigate(provider.url, provider.id);
    }
  });

  els.urlForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await api.navigate(els.urlInput.value, '__custom__');
    if (!res.ok) {
      showToast({ message: res.error || 'URL non valido', kind: 'error' });
    }
  });

  // Window controls
  els.btnAot.addEventListener('click', () => {
    if (!currentConfig) return;
    void api.setAlwaysOnTop(!currentConfig.window.alwaysOnTop);
  });

  els.opacitySlider.addEventListener('input', () => {
    const pct = Number(els.opacitySlider.value);
    els.opacityValue.textContent = `${pct}%`;
    void api.setOpacity(pct / 100);
  });

  // Coding quick actions
  document.querySelectorAll<HTMLButtonElement>('.action-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = (btn.dataset.action as QuickActionType) || 'send';
      void api.injectPrompt(action, els.clipboardPreview.value, els.userInstruction.value);
    });
  });

  els.btnCopyLatestOutput.addEventListener('click', async () => {
    const blocks = await api.refreshCodeBlocks();
    const latest = blocks[blocks.length - 1];
    if (!latest) {
      showToast({ message: 'Nessun blocco di codice rilevato nella chat.', kind: 'info' });
      return;
    }
    await api.copyOutputToClipboard(latest.code);
  });

  els.btnClearHistory.addEventListener('click', () => {
    els.clipboardPreview.value = '';
    els.clipboardMeta.textContent = 'Vuoto';
    void api.clearClipboardHistory();
  });

  // Operating presets
  els.presetSelect.addEventListener('change', () => {
    void api.setActivePreset(els.presetSelect.value);
  });

  els.btnNewPreset.addEventListener('click', () => {
    const created: OperatingPreset = {
      id: `preset-${Date.now().toString(36)}`,
      name: 'Nuovo Preset',
      role: 'Agisci come Senior Developer.',
      targetLanguage: 'Auto-detect',
      outputMode: 'code-and-brief',
      customRules: '',
      prefix: '',
      suffix: '',
    };
    void api.upsertPreset(created);
  });

  els.btnDeletePreset.addEventListener('click', () => {
    if (!currentConfig) return;
    void api.deletePreset(currentConfig.activePresetId);
  });

  els.presetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentConfig) return;
    const preset: OperatingPreset = {
      id: currentConfig.activePresetId,
      name: els.presetName.value,
      targetLanguage: els.presetLang.value || 'Auto-detect',
      outputMode: els.presetOutput.value as OutputMode,
      role: els.presetRole.value,
      customRules: els.presetRules.value,
      prefix: els.presetPrefix.value,
      suffix: els.presetSuffix.value,
    };
    await api.upsertPreset(preset);
    showToast({ message: 'Parametri operativi salvati.', kind: 'success' });
  });

  // Session & window toggles
  els.chkAutoSubmit.addEventListener('change', () => {
    void api.updateSession({ autoSubmit: els.chkAutoSubmit.checked });
  });
  els.chkAutoCopy.addEventListener('change', () => {
    void api.updateSession({ autoCopyGeneratedCode: els.chkAutoCopy.checked });
  });
  els.chkPolling.addEventListener('change', () => {
    void api.updateSession({ clipboardPollingEnabled: els.chkPolling.checked });
  });
  els.chkFocusOpacity.addEventListener('change', () => {
    void api.setFullOpacityOnFocus(els.chkFocusOpacity.checked);
  });
  els.sessionProfile.addEventListener('change', () => {
    void api.updateSession({ profileId: els.sessionProfile.value });
  });
  els.sessionZoom.addEventListener('input', () => {
    const pct = Number(els.sessionZoom.value);
    els.zoomLabel.textContent = `${pct}%`;
    void api.updateSession({ zoomFactor: pct / 100 });
  });
  els.sessionUa.addEventListener('change', () => {
    const mode = els.sessionUa.value as UserAgentMode;
    els.customUaWrap.classList.toggle('hidden', mode !== 'custom');
    void api.updateSession({ userAgentMode: mode });
  });
  els.sessionCustomUa.addEventListener('change', () => {
    void api.updateSession({ customUserAgent: els.sessionCustomUa.value });
  });
  els.btnClearSession.addEventListener('click', () => {
    void api.clearProfileSession();
  });

  // Custom provider form
  els.addProviderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await api.addProvider(els.newProviderName.value, els.newProviderUrl.value);
    if (res.ok && res.provider) {
      els.newProviderName.value = '';
      els.newProviderUrl.value = '';
      showToast({ message: `Aggiunto ${res.provider.name}.`, kind: 'success' });
      void api.navigate(res.provider.url, res.provider.id);
    } else {
      showToast({ message: res.error || 'Impossibile aggiungere provider.', kind: 'error' });
    }
  });

  // Output refresh
  els.btnRefreshBlocks.addEventListener('click', async () => {
    const blocks = await api.refreshCodeBlocks();
    renderExtractedBlocks(blocks);
  });
}

async function init(): Promise<void> {
  bindEvents();

  api.onConfigUpdate((cfg) => renderConfig(cfg));
  api.onNavigationUpdate((nav) => renderNavigation(nav));
  api.onClipboardUpdate(({ latest, history }) => renderClipboard(latest, history));
  api.onCodeBlocksUpdate((blocks) => renderExtractedBlocks(blocks));
  api.onToast((toast) => showToast(toast));

  const snapshot = await api.getSnapshot();
  els.sessionProfile.innerHTML = '';
  for (const profile of snapshot.profiles) {
    const opt = document.createElement('option');
    opt.value = profile;
    opt.textContent = profile;
    els.sessionProfile.appendChild(opt);
  }

  renderConfig(snapshot.config);
  renderNavigation(snapshot.navigation);
  renderClipboard(snapshot.latestClipboard, snapshot.clipboardHistory);
  renderExtractedBlocks(snapshot.extractedCodeBlocks);
}

void init();
