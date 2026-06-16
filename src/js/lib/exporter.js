/**
 * exporter.js - 文件导出管道
 *
 * 把编辑好的配置数据导出为 CFG666 和 DBC666 JSON 文件。
 * 通过 showSaveDialog 让用户选择保存位置，然后写入文件。
 *
 * 关键区别：
 * - CFG666 文件需要带 UTF-8 BOM（writeJsonFile 第三个参数传 true）
 * - DBC666 文件不带 BOM（传 false）
 * - 用户取消保存对话框时返回 null，由调用方自行处理
 */

import { writeJsonFile, showSaveDialog } from './file-io.js';
import { createEmptyCFG666 } from '../schema/cfg666-schema.js';

// ===== 内部工具函数 =====

/**
 * 生成 YYYY-MM-DD 格式日期字符串
 * 用来拼到默认文件名里，方便一眼看出导出日期
 * @returns {string}
 */
function getDateStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 生成默认文件名：{名称}_{日期}.{扩展名}
 * @param {string} name - 项目名或配置名
 * @param {string} ext - 扩展名（如 cfgg666、dbc666）
 * @returns {string}
 */
function buildDefaultName(name, ext) {
  const safeName = name || 'config';
  const upperExt = ext.toUpperCase();
  return `${safeName}_${getDateStr()}.${upperExt}`;
}

// ===== 导出函数 =====

/**
 * 导出 CFG666 配置文件
 *
 * 流程：
 * 1. 用 createEmptyCFG666 创建顶层结构
 * 2. 把 configPara 数组填入 ConfigPara 字段
 * 3. 设置 ConfigName 和 LineNumber
 * 4. 弹出保存对话框让用户选位置
 * 5. 写文件（带 BOM）
 *
 * @param {object[]} configPara - ConfigPara 配置项数组，每项已包含 Finally/TempletType/TempletValue 等字段
 * @param {string} scriptType - 脚本类型（当前预留，未在导出逻辑中使用）
 * @param {string} projectName - 项目名称，用于文件名和 ConfigName 字段
 * @returns {Promise<{filePath: string}|{error: string}|null>}
 *   - 成功返回 { filePath } 对象
 *   - 用户取消返回 null
 *   - 出错返回 { error: '错误描述' }
 */
export async function exportCFG666(configPara, scriptType, projectName) {
  // 参数校验：没有配置项就不往下走
  if (!configPara || configPara.length === 0) {
    return { error: '没有可导出的配置' };
  }

  // 弹出保存对话框，让用户选位置
  const defaultName = buildDefaultName(projectName, 'cfg666');
  const dialogResult = await showSaveDialog(defaultName, 'cfg666');

  if (!dialogResult.success) {
    return { error: `保存对话框出错: ${dialogResult.error}` };
  }
  if (dialogResult.canceled) {
    return null; // 用户点了取消
  }

  // 构建完整的 CFG666 数据结构
  const cfgData = createEmptyCFG666(projectName);
  cfgData.ConfigPara = configPara;
  cfgData.ConfigName = projectName || '';
  cfgData.LineNumber = configPara.length;

  // 写入文件，CFG666 必须带 BOM
  const writeResult = await writeJsonFile(dialogResult.filePath, cfgData, true);
  if (!writeResult.success) {
    return { error: `文件写入失败: ${writeResult.error}` };
  }

  return { filePath: dialogResult.filePath };
}

/**
 * 导出 DBC666 配置文件
 *
 * 流程：
 * 1. 检查 dbcConfig 是否为空（为空则跳过）
 * 2. 弹出保存对话框
 * 3. 写文件（不带 BOM）
 *
 * @param {object} dbcConfig - 完整的 DBC666 配置对象（由 dbc666-schema 构建）
 * @returns {Promise<{filePath: string}|{error: string}|null>}
 *   - 成功返回 { filePath } 对象
 *   - 无数据或用户取消返回 null
 *   - 出错返回 { error: '错误描述' }
 */
export async function exportDBC666(dbcConfig) {
  if (!dbcConfig) {
    return null; // 没有 DBC 配置，静默跳过
  }

  // 弹出保存对话框
  const configName = dbcConfig.ConfigName || 'dbc-config';
  const defaultName = buildDefaultName(configName, 'dbc666');
  const dialogResult = await showSaveDialog(defaultName, 'dbc666');

  if (!dialogResult.success) {
    return { error: `保存对话框出错: ${dialogResult.error}` };
  }
  if (dialogResult.canceled) {
    return null; // 用户点了取消
  }

  // 写入文件，DBC666 不带 BOM
  const writeResult = await writeJsonFile(dialogResult.filePath, dbcConfig, false);
  if (!writeResult.success) {
    return { error: `文件写入失败: ${writeResult.error}` };
  }

  return { filePath: dialogResult.filePath };
}

/**
 * 一键导出当前所有配置
 *
 * 依次导出 CFG666 和 DBC666（如果当前状态包含 DBC 配置的话）。
 * 两个导出互不影响——即使 CFG666 导出失败，只要 state 里有 dbcConfig，
 * 仍然会尝试导出 DBC666。
 *
 * @param {object} state - 应用当前编辑状态
 * @param {object[]} state.configPara - CFG666 的 ConfigPara 数组
 * @param {object} [state.dbcConfig] - DBC666 配置对象（可选，没有就不导）
 * @param {string} state.scriptType - 脚本类型，透传给 exportCFG666
 * @param {string} state.projectName - 项目名称，用于文件名
 * @returns {Promise<Array<{filePath: string}|{error: string}|null>>}
 *   导出结果数组，先 CFG666 的结果，再 DBC666 的结果（如果有）
 */
export async function exportAll(state) {
  const results = [];

  // 第一步：导出 CFG666
  const cfgResult = await exportCFG666(
    state.configPara,
    state.scriptType,
    state.projectName
  );
  results.push(cfgResult);

  // 第二步：如果有 DBC 配置，接着导出 DBC666
  if (state.dbcConfig) {
    const dbcResult = await exportDBC666(state.dbcConfig);
    results.push(dbcResult);
  }

  return results;
}
