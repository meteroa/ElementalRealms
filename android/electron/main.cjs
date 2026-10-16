const { app, BrowserWindow, Menu, globalShortcut, nativeTheme } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Enforce single instance lock: prevent duplicate ghost processes from blocking startup
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Force dark mode for native Windows elements (eliminates bright white title bar on Windows 10/11)
nativeTheme.themeSource = 'dark';

// Embedded local log receiver fallback for tools/battle_ai_records.txt
function startInternalLogServer() {
  const logServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/record-log' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const entry = JSON.parse(body);
          const logText = entry.formattedText || (typeof entry === 'string' ? entry : JSON.stringify(entry));
          const logFile = path.resolve(__dirname, '../../tools/battle_ai_records.txt');
          fs.appendFileSync(logFile, logText.trim() + '\n\n', 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, savedTo: logFile }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  logServer.listen(3928, '127.0.0.1', () => {
    console.log('[AI Logger Server] Listening on http://127.0.0.1:3928/record-log');
  }).on('error', () => {
    // Port 3928 already in use by tools/test_combat_api.js - which is perfectly fine!
  });
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: '元素秘境 · 魔导对决 (Elemental Realms)',
    backgroundColor: '#0a0d18',
    icon: path.join(__dirname, '../public/icons/icon-512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    autoHideMenuBar: true,
    show: false,
  });

  Menu.setApplicationMenu(null);

  // If in dev mode (passed by npm run electron:dev), load Vite dev server
  const isDev = process.env.ELECTRON_DEV === 'true' || process.argv.includes('--dev');
  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Display the window maximized immediately to fill the display and avoid revealing background windows
  const displayWindow = () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.maximize();
      mainWindow.show();
      mainWindow.focus();
    }
  };

  mainWindow.once('ready-to-show', displayWindow);

  // Fallback guarantee: ensure window is presented within 600ms even if external font/network hangs
  setTimeout(displayWindow, 600);

  // Shortcuts: F11 or Alt+Enter to toggle borderless fullscreen
  globalShortcut.register('F11', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  globalShortcut.register('Alt+Enter', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  startInternalLogServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

