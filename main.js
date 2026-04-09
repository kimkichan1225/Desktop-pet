const { app, BrowserWindow, ipcMain, screen, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const SAVE_PATH = path.join(__dirname, 'data', 'save.json');

let mainWindow;
let tray;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 캐릭터 영역 외에는 클릭이 통과되도록 설정
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.setVisibleOnAllWorkspaces(true);

  mainWindow.webContents.openDevTools({ mode: 'detach' });
}

// 렌더러에서 마우스 이벤트 전달/무시 전환
ipcMain.on('set-ignore-mouse', (event, ignore) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

// 세이브/로드
ipcMain.handle('save-data', (event, data) => {
  fs.writeFileSync(SAVE_PATH, JSON.stringify(data, null, 2), 'utf-8');
});

ipcMain.handle('load-data', () => {
  try {
    if (fs.existsSync(SAVE_PATH)) {
      return JSON.parse(fs.readFileSync(SAVE_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('세이브 로드 실패:', e);
  }
  return null;
});

ipcMain.on('quit-app', () => {
  app.quit();
});

function createTray() {
  // 시스템 트레이 아이콘 (간단한 1x1 아이콘 생성)
  const { nativeImage } = require('electron');
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADklEQVQ4jWNgGAWDCQAAAhAAARsBl4AAAAAASUVORK5CYII=',
      'base64'
    )
  );

  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '캐릭터 보이기/숨기기',
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
        }
      },
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setToolTip('데스크톱 펫');
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  app.quit();
});
