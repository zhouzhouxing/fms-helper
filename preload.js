// === Preload 桥接脚本 ===
// 在渲染进程加载前执行，把主进程的API安全地暴露给页面
// contextBridge 确保渲染进程只能访问我们明确暴露的API

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  /**
   * 读取文件内容
   * @param {string} filePath - 文件路径
   * @returns {Promise<{success: boolean, data?: string, error?: string}>}
   */
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),

  /**
   * 写入文件内容
   * @param {string} filePath - 文件路径
   * @param {string} content - 要写入的内容
   * @param {boolean} [withBOM=false] - 是否在文件头加UTF-8 BOM（CFG666需要）
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  writeFile: (filePath, content, withBOM = false) => ipcRenderer.invoke('write-file', filePath, content, withBOM),

  /**
   * 打开文件选择对话框
   * @param {object} options - dialog.showOpenDialog 的选项
   * @returns {Promise<{success: boolean, filePaths?: string[], canceled?: boolean}>}
   */
  openDialog: (options) => ipcRenderer.invoke('open-dialog', options),

  /**
   * 打开保存对话框
   * @param {object} options - dialog.showSaveDialog 的选项
   * @returns {Promise<{success: boolean, filePath?: string, canceled?: boolean}>}
   */
  saveDialog: (options) => ipcRenderer.invoke('save-dialog', options),

  // ===== 自动更新相关 =====

  /** 监听：发现新版本 */
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_e, info) => callback(info)),

  /** 监听：下载进度 */
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_e, percent) => callback(percent)),

  /** 监听：下载完成 */
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_e, info) => callback(info)),

  /** 触发：立即重启安装更新 */
  installUpdate: () => ipcRenderer.send('install-update'),

  /** 手动检查更新 */
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  /** 获取当前版本号 */
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
});
