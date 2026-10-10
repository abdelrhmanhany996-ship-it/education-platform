// Desktop app for the platform (Windows / macOS). The window is excluded from screen capture by the OS:
// screenshots, Snipping Tool, Game Bar, OBS and Teams/Zoom sharing all show a black window.
const { app, BrowserWindow, Menu, shell, session, ipcMain } = require('electron');
const crypto = require('crypto');
const path = require('path');
const { appUrl } = require('./config.json');

// Started with a debugging port / inspector, someone could read the video from outside the window
const DEBUG_SWITCHES = ['remote-debugging-port', 'remote-debugging-pipe', 'inspect', 'inspect-brk', 'remote-allow-origins'];
if (DEBUG_SWITCHES.some(s => app.commandLine.hasSwitch(s)) || process.argv.some(a => /^--(inspect|remote-debugging)/.test(a))) {
  app.exit(0);
}

// Signing key registered with the server by the build (app-key.json is written by CI, never committed)
let signKey = null;
try {
  const { k1, k2 } = require('./app-key.json');
  const a = Buffer.from(k1, 'hex');
  const b = Buffer.from(k2, 'hex');
  if (a.length === 32 && b.length === 32) signKey = Buffer.from(a.map((x, i) => x ^ b[i]));
} catch {
  /* development build without a key */
}

const APP_HOST = new URL(appUrl).host;
// Video players may load inside the page (iframes) but never as a page of their own: their pages show the
// video link (share / copy link), so they are neither opened in the window nor in the browser.
const VIDEO_HOSTS = ['youtube-nocookie.com', 'youtube.com', 'youtu.be', 'vdocipher.com', 'ytimg.com', 'googlevideo.com'];
const hostOf = url => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};
const isAppPage = url => {
  try {
    return new URL(url).host === APP_HOST;
  } catch {
    return false;
  }
};
const isVideoHost = url => {
  const h = hostOf(url);
  return VIDEO_HOSTS.some(a => h === a || h.endsWith('.' + a));
};
const openOutside = url => {
  if (!isVideoHost(url) && /^(https?|mailto|tel):/.test(url)) shell.openExternal(url);
};

// One window only: a second launch focuses the first
if (!app.requestSingleInstanceLock()) app.quit();

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 360,
    minHeight: 500,
    backgroundColor: '#0f172a',
    title: 'المنصة الأكاديمية',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false,
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: false
    }
  });
  // The protection itself (SetWindowDisplayAffinity on Windows, NSWindowSharingNone on macOS)
  win.setContentProtection(true);
  Menu.setApplicationMenu(null);

  const ua = win.webContents.getUserAgent().replace(/Electron\/\S+\s?/, '');
  win.webContents.setUserAgent(`${ua} AcademicPlatformApp/desktop-${app.getVersion()}`);
  win.loadURL(appUrl);

  // External links open in the normal browser; the platform stays in the protected window
  win.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!isAppPage(url)) {
      e.preventDefault();
      openOutside(url);
    }
  });
  win.webContents.on('will-redirect', (e, url, _inPlace, isMainFrame) => {
    if (isMainFrame && !isAppPage(url)) e.preventDefault();
  });
  // No "Save image / Inspect" context menu, no developer tools shortcut
  win.webContents.on('context-menu', e => e.preventDefault());
  win.webContents.on('before-input-event', (e, input) => {
    const k = (input.key || '').toLowerCase();
    if (k === 'f12' || ((input.control || input.meta) && input.shift && (k === 'i' || k === 'j' || k === 'c'))) e.preventDefault();
    if ((input.control || input.meta) && (k === 's' || k === 'p')) e.preventDefault(); // save page / print
  });
  // Only the platform's own pages get a signature
  ipcMain.removeHandler('academic-sign');
  ipcMain.handle('academic-sign', (e, msg) => {
    let host = '';
    try {
      host = new URL(e.senderFrame.url).host;
    } catch {
      /* no url */
    }
    if (!signKey || host !== APP_HOST) return '';
    return crypto.createHmac('sha256', signKey).update(String(msg)).digest('hex');
  });

  // Files are never downloaded from the protected window
  session.defaultSession.on('will-download', e => e.preventDefault());

  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3: aborted by a redirect
    win.loadURL(
      'data:text/html;charset=utf-8,' +
        encodeURIComponent(`<html dir="rtl"><body style="margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f172a;color:#e2e8f0;font-family:sans-serif">
        <h2>لا يوجد اتصال بالإنترنت</h2><p style="color:#94a3b8">تأكد من الاتصال ثم أعد المحاولة.</p>
        <button onclick="location.href='${appUrl}'" style="margin-top:12px;padding:12px 24px;border:0;border-radius:12px;background:#4f46e5;color:#fff;font-size:16px">إعادة المحاولة</button></body></html>`)
    );
  });
}

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
