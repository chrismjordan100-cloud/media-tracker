const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, 'alien.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load the CloudFront (HTTPS) hosted version. The direct S3 website URL now returns 403.
  // Clear Electron's HTTP cache first so a new deploy always shows on next launch
  // (localStorage is separate and is NOT touched by clearCache).
  win.webContents.session.clearCache().finally(() => {
    win.loadURL('https://d21se3p58mjg34.cloudfront.net/media-tracker.html');
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
