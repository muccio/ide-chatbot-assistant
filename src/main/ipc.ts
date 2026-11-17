import { BrowserWindow, ipcMain } from 'electron';
import { buildCodingPrompt } from '../shared/promptBuilder';
import {
  AppSnapshot,
  OperatingPreset,
  QuickActionType,
  SessionSettings,
} from '../shared/types';
import { ChatbotHost } from './chatbotHost';
import { ClipboardWatcher } from './clipboardWatcher';
import { ConfigStore } from './store';

export const AVAILABLE_PROFILES = ['default', 'work', 'personal'];

export interface IpcController {
  injectQuickAction: (action: QuickActionType, overrideCode?: string, userInstruction?: string) => Promise<{
    ok: boolean;
    method: string;
    submitted: boolean;
    error?: string;
  }>;
  copyLatestCodeBlock: () => Promise<boolean>;
}

/**
 * Registers all typed IPC handlers between the shell UI and main process services.
 */
export function registerIpcHandlers(
  mainWindow: BrowserWindow,
  store: ConfigStore,
  host: ChatbotHost,
  clipboardWatcher: ClipboardWatcher,
): IpcController {
  const sendToRenderer = <T>(channel: string, payload: T) => {
    if (!mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  };

  const injectQuickAction = async (
    action: QuickActionType,
    overrideCode?: string,
    userInstruction?: string,
  ) => {
    const config = store.getConfig();
    const activePreset =
      config.presets.find((p) => p.id === config.activePresetId) ?? config.presets[0];
    const code = overrideCode ?? clipboardWatcher.getLatestInput()?.text ?? '';
    const prompt = buildCodingPrompt({
      preset: activePreset,
      code,
      action,
      userInstruction,
    });

    const result = await host.injectPrompt(prompt);
    if (result.ok) {
      sendToRenderer('event:toast', {
        message: result.submitted
          ? 'Prompt e codice inviati al chatbot.'
          : 'Prompt e codice inseriti nella chat (pronti da inviare).',
        kind: 'success',
      });
    } else {
      clipboardWatcher.writeOutputToClipboard(prompt);
      sendToRenderer('event:toast', {
        message: `${result.error || 'Input non rilevato.'} Prompt copiato in clipboard: premi Cmd/Ctrl+V nella chat.`,
        kind: 'info',
      });
    }
    return result;
  };

  const copyLatestCodeBlock = async (): Promise<boolean> => {
    const blocks = await host.refreshCodeBlocks();
    const latest = blocks[blocks.length - 1];
    if (!latest) {
      sendToRenderer('event:toast', {
        message: 'Nessun blocco di codice trovato nella risposta del chatbot.',
        kind: 'info',
      });
      return false;
    }
    clipboardWatcher.writeOutputToClipboard(latest.code);
    sendToRenderer('event:toast', {
      message: `Copiato blocco ${latest.language} (${latest.lineCount} righe) per l'IDE.`,
      kind: 'success',
    });
    return true;
  };

  ipcMain.handle('app:get-snapshot', (): AppSnapshot => ({
    config: store.getConfig(),
    navigation: host.getNavigationState(),
    latestClipboard: clipboardWatcher.getLatestInput(),
    clipboardHistory: clipboardWatcher.getHistory(),
    extractedCodeBlocks: host.getExtractedBlocks(),
    profiles: AVAILABLE_PROFILES,
  }));

  ipcMain.handle('nav:go', (_e, url: string, providerId?: string) => host.navigate(url, providerId));
  ipcMain.handle('nav:back', () => host.goBack());
  ipcMain.handle('nav:forward', () => host.goForward());
  ipcMain.handle('nav:reload', () => host.reload());

  ipcMain.handle('providers:add', (_e, name: string, url: string) => {
    const provider = store.addCustomProvider(name, url);
    if (!provider) {
      return { ok: false, error: 'Nome o URL non valido.' };
    }
    sendToRenderer('event:config', store.getConfig());
    return { ok: true, provider };
  });

  ipcMain.handle('providers:remove', (_e, id: string) => {
    const removed = store.removeProvider(id);
    if (removed) {
      sendToRenderer('event:config', store.getConfig());
    }
    return removed;
  });

  ipcMain.handle('window:set-aot', (_e, enabled: boolean) => host.applyAlwaysOnTop(Boolean(enabled)));
  ipcMain.handle('window:set-opacity', (_e, opacity: number) => host.setOpacity(Number(opacity)));
  ipcMain.handle('window:set-focus-opacity', (_e, enabled: boolean) =>
    host.setFullOpacityOnFocus(Boolean(enabled)),
  );
  ipcMain.handle('window:set-sidebar', (_e, open: boolean) => host.setSidebarOpen(Boolean(open)));

  ipcMain.handle('presets:set-active', (_e, presetId: string) => {
    const updated = store.setActivePreset(presetId);
    sendToRenderer('event:config', updated);
    return updated;
  });

  ipcMain.handle('presets:upsert', (_e, preset: OperatingPreset) => {
    store.upsertPreset(preset);
    const updated = store.getConfig();
    sendToRenderer('event:config', updated);
    return updated;
  });

  ipcMain.handle('presets:delete', (_e, presetId: string) => {
    store.deletePreset(presetId);
    const updated = store.getConfig();
    sendToRenderer('event:config', updated);
    return updated;
  });

  ipcMain.handle('session:update', (_e, patch: Partial<SessionSettings>) =>
    host.updateSessionSettings(patch),
  );

  ipcMain.handle('session:clear', async () => {
    await host.clearActiveProfileSession();
    return { ok: true };
  });

  ipcMain.handle(
    'chatbot:inject-prompt',
    (_e, action: QuickActionType, code: string, userInstruction?: string) =>
      injectQuickAction(action, code, userInstruction),
  );

  ipcMain.handle('clipboard:copy-output', (_e, code: string) => {
    clipboardWatcher.writeOutputToClipboard(code);
    sendToRenderer('event:toast', {
      message: 'Codice copiato nella clipboard. Pronto per Ctrl/Cmd+V nell’IDE.',
      kind: 'success',
    });
    return { ok: true };
  });

  ipcMain.handle('chatbot:refresh-code-blocks', () => host.refreshCodeBlocks());

  ipcMain.handle('clipboard:clear-history', () => {
    clipboardWatcher.clearHistory();
    sendToRenderer('event:clipboard', { latest: null, history: [] });
  });

  return {
    injectQuickAction,
    copyLatestCodeBlock,
  };
}
