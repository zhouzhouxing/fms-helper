/**
 * file-io.js - 文件读写工具（渲染进程侧）
 * 
 * 封装 window.api 的IPC调用，提供更友好的文件操作接口
 * - 读取JSON文件时自动去除BOM并解析
 * - 写入JSON文件时可选择是否添加BOM（CFG666需要BOM，DBC666不需要）
 * - 文件对话框的快捷封装
 */

/**
 * 读取文件并解析为JSON对象
 * BOM已在主进程的read-file handler中自动去除
 * @param {string} filePath - 文件路径
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function readFileAsJson(filePath) {
  const result = await window.api.readFile(filePath);
  if (!result.success) {
    return { success: false, error: result.error };
  }
  try {
    const parsed = JSON.parse(result.data);
    return { success: true, data: parsed };
  } catch (parseError) {
    return { success: false, error: `JSON解析失败: ${parseError.message}` };
  }
}

/**
 * 将对象序列化为JSON并写入文件
 * @param {string} filePath - 文件路径
 * @param {object} data - 要写入的对象
 * @param {boolean} [withBOM=false] - 是否添加UTF-8 BOM（CFG666用true，DBC666用false）
 * @param {number} [indent=2] - JSON缩进空格数
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function writeJsonFile(filePath, data, withBOM = false, indent = 2) {
  try {
    const content = JSON.stringify(data, null, indent);
    return await window.api.writeFile(filePath, content, withBOM);
  } catch (stringifyError) {
    return { success: false, error: `JSON序列化失败: ${stringifyError.message}` };
  }
}

/**
 * 读取纯文本文件（不解析JSON）
 * @param {string} filePath - 文件路径
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
export async function readTextFile(filePath) {
  return await window.api.readFile(filePath);
}

/**
 * 写入纯文本文件
 * @param {string} filePath - 文件路径
 * @param {string} content - 文本内容
 * @param {boolean} [withBOM=false] - 是否添加BOM
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function writeTextFile(filePath, content, withBOM = false) {
  return await window.api.writeFile(filePath, content, withBOM);
}

/**
 * 打开文件选择对话框（DBC666/CFG666文件）
 * @param {string} [title='选择配置文件'] - 对话框标题
 * @returns {Promise<{success: boolean, filePath?: string, canceled?: boolean}>}
 */
export async function showOpenDialog(title = '选择配置文件') {
  const result = await window.api.openDialog({
    title,
    filters: [
      { name: '配置文件', extensions: ['dbc666', 'cfg666'] },
      { name: 'JSON文件', extensions: ['json'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { success: true, canceled: true };
  }
  return { success: true, filePath: result.filePaths[0] };
}

/**
 * 打开保存对话框
 * @param {string} defaultName - 默认文件名
 * @param {string} [ext='cfg666'] - 默认扩展名
 * @returns {Promise<{success: boolean, filePath?: string, canceled?: boolean}>}
 */
export async function showSaveDialog(defaultName, ext = 'cfg666') {
  const result = await window.api.saveDialog({
    title: '保存配置文件',
    defaultPath: defaultName,
    filters: [
      { name: `${ext.toUpperCase()} 文件`, extensions: [ext] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }
  if (result.canceled) {
    return { success: true, canceled: true };
  }
  return { success: true, filePath: result.filePath };
}

/**
 * 判断文件扩展名是否为CFG666
 * @param {string} filePath - 文件路径
 * @returns {boolean}
 */
export function isCfg666File(filePath) {
  return filePath.toLowerCase().endsWith('.cfg666');
}

/**
 * 判断文件扩展名是否为DBC666
 * @param {string} filePath - 文件路径
 * @returns {boolean}
 */
export function isDbc666File(filePath) {
  return filePath.toLowerCase().endsWith('.dbc666');
}
