/**
 * V2 导出模块
 *
 * 把 Step Builder 生成的 ConfigPara 数组导出为 CFG666 文件。
 * 通过 Electron 的 IPC (preload.js) 调用文件保存对话框。
 */

/**
 * 生成默认文件名
 * 格式: OBC-{模式}-脚本-{日期}.cfg666
 * @param {string} mode - 'obc-single' 或 'obc-three'
 * @returns {string}
 */
function generateFileName(mode) {
    var modeLabel = mode === 'obc-three' ? '三相' : '单相';
    var date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return 'OBC-' + modeLabel + '-脚本-' + date + '.CFG666';
}

/**
 * 导出 CFG666 文件
 *
 * 流程：
 * 1. 弹出保存对话框让用户选择位置
 * 2. 构建 CFG666 JSON 结构
 * 3. 写入文件（带 BOM）
 *
 * @param {object} cfgData - buildCFG666() 的返回值
 * @param {string} defaultName - 默认文件名
 * @returns {Promise<{success: boolean, filePath?: string, error?: string}>}
 */
async function exportCFG666(cfgData, defaultName) {
    // 检查 Electron API
    if (!window.api || !window.api.saveDialog) {
        return { success: false, error: 'Electron API 不可用，无法保存文件' };
    }

    // 弹出保存对话框
    var dialogResult = await window.api.saveDialog({
        defaultPath: defaultName || generateFileName('obc-single'),
        filters: [{ name: 'CFG666 文件', extensions: ['CFG666', 'cfg666'] }]
    });

    if (!dialogResult.success) {
        return { success: false, error: '保存对话框出错: ' + (dialogResult.error || '') };
    }
    if (dialogResult.canceled) {
        return { success: false, canceled: true };
    }

    // 序列化 JSON
    var jsonStr = JSON.stringify(cfgData, null, 2);

    // 写入文件（CFG666 需要 BOM）
    var writeResult = await window.api.writeFile(dialogResult.filePath, jsonStr, true);

    if (!writeResult.success) {
        return { success: false, error: '文件写入失败: ' + (writeResult.error || '') };
    }

    return { success: true, filePath: dialogResult.filePath };
}

export { generateFileName, exportCFG666 };
