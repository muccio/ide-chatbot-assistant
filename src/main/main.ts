import { app, BrowserWindow, Menu, MenuItemConstructorOptions } from 'electron';
import { join } from 'node:path';
import { ChatbotHost } from './chatbotHost';
import { ClipboardWatcher } from './clipboardWatcher';
import { IpcController, registerIpcHandlers } from './ipc';
import { ConfigStore } from './store';

let mainWindow: BrowserWindow | null = null;
let chatbotHost: ChatbotHost | null = null;
let clipboardWatcher: ClipboardWatcher | null = null;

function buildAppMenu(
  store: ConfigStore,
  host: ChatbotHost,
  ipcController: IpcController,
): Menu {
  const isMac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'Modifica',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Assistente',
      submenu: [
        {
          label: 'Toggle Always on Top',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => {
            const current = store.getConfig().window.alwaysOnTop;
            host.applyAlwaysOnTop(!current);
          },
        },
        {
          label: 'Toggle Pannello Laterale',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => {
            const current = store.getConfig().window.sidebarOpen;
            host.setSidebarOpen(!current);
          },
        },
        {
          label: 'Inietta Clipboard IDE in Chat',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            void ipcController.injectQuickAction('send');
          },
        },
        {
          label: 'Copia Ultimo Codice Generato',
          accelerator: 'CmdOrCtrl+Shift+K',
          click: () => {
            void ipcController.copyLatestCodeBlock();
          },
        },
        { type: 'separator' },
        {
          label: 'Ricarica Pagina Chatbot',
          accelerator: 'CmdOrCtrl+R',
          click: () => host.reload(),
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

function createWindow(): void {
  const store = new ConfigStore(join(app.getPath('userData'), 'config.json'));
  const config = store.getConfig();

  mainWindow = new BrowserWindow({
    width: config.window.bounds.width,
    height: config.window.bounds.height,
    x: config.window.bounds.x,
    y: config.window.bounds.y,
    minWidth: 720,
    minHeight: 520,
    title: 'IDE Chatbot Assistant',
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'shellPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const watcher = new ClipboardWatcher();
  clipboardWatcher = watcher;
  watcher.configure(
    config.session.clipboardPollingEnabled,
    config.session.clipboardPollIntervalMs,
  );

  const sendToRenderer = <T>(channel: string, payload: T) => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  };

  watcher.onChange((entry, history) => {
    sendToRenderer('event:clipboard', { latest: entry, history });
  });

  const host = new ChatbotHost(mainWindow, store, watcher, {
    onNavigation: (nav) => sendToRenderer('event:navigation', nav),
    onCodeBlocks: (blocks) => sendToRenderer('event:code-blocks', blocks),
    onConfig: (updated) => sendToRenderer('event:config', updated),
    onToast: (message, kind) => sendToRenderer('event:toast', { message, kind }),
  });
  chatbotHost = host;

  const ipcController = registerIpcHandlers(mainWindow, store, host, watcher);
  Menu.setApplicationMenu(buildAppMenu(store, host, ipcController));

  watcher.start();
  void mainWindow.loadFile(join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    host.init();
    if (process.env.ASSISTANT_SMOKE_TEST === '1') {
      console.log('SMOKE_OK');
      setTimeout(() => app.quit(), 1200);
    }
  });

  mainWindow.on('closed', () => {
    host.dispose();
    watcher.stop();
    chatbotHost = null;
    clipboardWatcher = null;
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  chatbotHost?.dispose();
  clipboardWatcher?.stop();
});
