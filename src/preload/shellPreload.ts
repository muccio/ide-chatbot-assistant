import { contextBridge, ipcRenderer } from 'electron';
import {
  AppConfig,
  AssistantAPI,
  ClipboardEntry,
  ExtractedCodeBlock,
  NavigationState,
  OperatingPreset,
  QuickActionType,
  SessionSettings,
  ToastPayload,
} from '../shared/types';

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const api: AssistantAPI = {
  getSnapshot: () => ipcRenderer.invoke('app:get-snapshot'),
  navigate: (url, providerId) => ipcRenderer.invoke('nav:go', url, providerId),
  navBack: () => ipcRenderer.invoke('nav:back'),
  navForward: () => ipcRenderer.invoke('nav:forward'),
  navReload: () => ipcRenderer.invoke('nav:reload'),
  addProvider: (name, url) => ipcRenderer.invoke('providers:add', name, url),
  removeProvider: (id) => ipcRenderer.invoke('providers:remove', id),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke('window:set-aot', enabled),
  setOpacity: (opacity) => ipcRenderer.invoke('window:set-opacity', opacity),
  setFullOpacityOnFocus: (enabled) => ipcRenderer.invoke('window:set-focus-opacity', enabled),
  setSidebarOpen: (open) => ipcRenderer.invoke('window:set-sidebar', open),
  setActivePreset: (presetId) => ipcRenderer.invoke('presets:set-active', presetId),
  upsertPreset: (preset) => ipcRenderer.invoke('presets:upsert', preset),
  deletePreset: (presetId) => ipcRenderer.invoke('presets:delete', presetId),
  updateSession: (patch) => ipcRenderer.invoke('session:update', patch),
  clearProfileSession: () => ipcRenderer.invoke('session:clear'),
  injectPrompt: (action, code, userInstruction) =>
    ipcRenderer.invoke('chatbot:inject-prompt', action, code, userInstruction),
  copyOutputToClipboard: (code) => ipcRenderer.invoke('clipboard:copy-output', code),
  refreshCodeBlocks: () => ipcRenderer.invoke('chatbot:refresh-code-blocks'),
  clearClipboardHistory: () => ipcRenderer.invoke('clipboard:clear-history'),
  onConfigUpdate: (cb) => subscribe<AppConfig>('event:config', cb),
  onNavigationUpdate: (cb) => subscribe<NavigationState>('event:navigation', cb),
  onClipboardUpdate: (cb) =>
    subscribe<{ latest: ClipboardEntry | null; history: ClipboardEntry[] }>('event:clipboard', cb),
  onCodeBlocksUpdate: (cb) => subscribe<ExtractedCodeBlock[]>('event:code-blocks', cb),
  onToast: (cb) => subscribe<ToastPayload>('event:toast', cb),
};

contextBridge.exposeInMainWorld('assistantAPI', api);
