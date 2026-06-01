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

  // Load the AWS hosted version
  win.loadURL('http://media-tracker-app-eggnog-915238109618-eu-north-1-an.s3-website.eu-north-1.amazonaws.com');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
