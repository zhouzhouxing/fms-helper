// === Electron 主进程 ===
// 负责创建窗口、注册IPC处理器

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// 自动更新（打包后才生效，开发模式自动跳过）
let autoUpdater = null;
try {
  if (app.isPackaged) {
    autoUpdater = require('electron-updater').autoUpdater;
  }
} catch (e) {
  console.warn('[updater] electron-updater 未加载:', e.message);
}

// 主窗口引用（防止被垃圾回收）
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: 'FMS Helper',
    // 隐藏默认菜单栏
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // 隔离渲染进程上下文（安全）
      nodeIntegration: false,   // 渲染进程不能直接用Node API
    },
  });

  // 加载页面
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // 页面准备好后再显示窗口，避免白屏等待
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 页面标题被HTML的<title>覆盖的话，强制设一次
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
  });
  mainWindow.setTitle('FMS Helper');
}

// ========== IPC 处理器 ==========
// 渲染进程通过 preload.js 暴露的 window.api 调用这些处理器

// 读取文件（自动去除UTF-8 BOM）
ipcMain.handle('read-file', async (_event, filePath) => {
  try {
    let data = await fs.promises.readFile(filePath, 'utf-8');
    // 去掉UTF-8 BOM（EF BB BF，即 \uFEFF）
    if (data.charCodeAt(0) === 0xFEFF) {
      data = data.slice(1);
    }
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 写入文件（可选是否加UTF-8 BOM）
ipcMain.handle('write-file', async (_event, filePath, content, withBOM) => {
  try {
    const bom = withBOM ? '\uFEFF' : '';
    await fs.promises.writeFile(filePath, bom + content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 打开文件选择对话框
ipcMain.handle('open-dialog', async (_event, options) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 打开保存对话框
ipcMain.handle('save-dialog', async (_event, options) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ========== 应用生命周期 ==========
app.whenReady().then(() => {
  createWindow();

  // macOS 点击Dock图标时如果没有窗口就新建一个
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // ========== 自动更新 ==========
  if (autoUpdater) {
    autoUpdater.autoDownload = true;        // 发现有新版本自动下载
    autoUpdater.autoInstallOnAppQuit = false; // 不在退出时自动装，等用户确认

    // 检查到新版本
    autoUpdater.on('update-available', (info) => {
      console.log('[updater] 发现新版本:', info.version);
      if (mainWindow) mainWindow.webContents.send('update-available', info);
    });

    // 没有新版本
    autoUpdater.on('update-not-available', () => {
      console.log('[updater] 已是最新版本');
    });

    // 下载进度
    autoUpdater.on('download-progress', (progress) => {
      if (mainWindow) mainWindow.webContents.send('update-progress', Math.round(progress.percent));
    });

    // 下载完成
    autoUpdater.on('update-downloaded', (info) => {
      console.log('[updater] 下载完成:', info.version);
      if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
    });

    // 出错
    autoUpdater.on('error', (error) => {
      console.error('[updater] 更新出错:', error);
    });

    // 延迟5秒首次检查，避免启动时争资源
    setTimeout(() => {
      autoUpdater.checkForUpdates();
      // 之后每30分钟自动检查一次
      setInterval(() => {
        autoUpdater.checkForUpdates();
      }, 30 * 60 * 1000);
    }, 5000);
  }

  // 渲染进程：用户点"检查更新"按钮（关于弹窗里的手动触发）
  ipcMain.handle('check-for-updates', () => {
    if (autoUpdater) {
      autoUpdater.checkForUpdates();
      return true;
    }
    return false;
  });

  // 渲染进程：用户点"立即重启安装"
  ipcMain.on('install-update', () => {
    if (autoUpdater) autoUpdater.quitAndInstall();
  });

  // 渲染进程：获取当前版本号
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });
});

// 所有窗口关闭时退出应用（Windows/Linux）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
