/**
 * template-loader.js - 模板加载器
 *
 * 用于导入已有的 DBC666 / CFG666 配置文件。
 * 提供一站式导入流程：打开对话框 → 读取文件 → 自动识别类型 → 解析验证。
 *
 * 核心导出:
 *   importConfigFile()    - 一站式导入（对话框 + 读取 + 解析）
 *   parseImportedCFG666() - 从 JSON 对象中提取并验证 ConfigPara 数组
 *   parseImportedDBC666() - 从 JSON 对象中验证并返回完整 DBC666 结构
 */

import {
  readFileAsJson,
  showOpenDialog,
  isCfg666File,
  isDbc666File
} from './file-io.js';

import { TEMPLET_TYPES } from '../schema/cfg666-schema.js';
import { validateDBC666 } from '../schema/dbc666-schema.js';
import { parseTempletValue } from './templet-value.js';

/**
 * 一站式导入配置文件
 *
 * 流程: 打开对话框 → 读取JSON → 根据扩展名自动解析 → 返回结构化结果
 *
 * @returns {Promise<{
 *   type: 'cfg666'|'dbc666',
 *   data: object,
 *   fileName: string,
 *   warnings: string[]
 * } | { error: string } | null>}
 *   - null: 用户取消了对话框
 *   - { error }: 读取或解析失败
 *   - { type, data, fileName, warnings }: 导入成功
 */
export async function importConfigFile() {
  // 1. 打开文件选择对话框
  const dialogResult = await showOpenDialog('选择配置文件');
  if (!dialogResult.success) {
    return { error: dialogResult.error || '打开对话框失败' };
  }
  if (dialogResult.canceled) {
    return null;
  }

  const filePath = dialogResult.filePath;
  // 提取文件名（不含路径）
  const fileName = filePath.split(/[\\/]/).pop() || filePath;

  // 2. 读取文件（BOM 已在 file-io.js 的 readFileAsJson 中自动处理）
  const readResult = await readFileAsJson(filePath);
  if (!readResult.success) {
    return { error: readResult.error };
  }

  // 3. 根据扩展名判断文件类型并解析
  if (isCfg666File(filePath)) {
    return parseCfg666AndWrap(fileName, readResult.data);
  }

  if (isDbc666File(filePath)) {
    return parseDbc666AndWrap(fileName, readResult.data);
  }

  // 扩展名不匹配时的兜底处理：根据 JSON 结构自动推断类型
  // 优先检查 SignParaInfo（DBC666 特有），再检查 ConfigPara（CFG666 特有）
  if (readResult.data.SignParaInfo !== undefined) {
    return parseDbc666AndWrap(fileName, readResult.data);
  }

  if (readResult.data.ConfigPara !== undefined) {
    return parseCfg666AndWrap(fileName, readResult.data);
  }

  return {
    error: `无法识别文件类型（扩展名: ${fileName.split('.').pop() || '无'}），文件缺少 SignParaInfo 和 ConfigPara 字段`
  };
}

/**
 * 解析 CFG666 数据并包装为标准返回格式
 * @param {string} fileName
 * @param {object} json
 * @returns {{ type: string, data: object, fileName: string, warnings: string[] }}
 */
function parseCfg666AndWrap(fileName, json) {
  const parseResult = parseImportedCFG666(json);
  if (parseResult.error) {
    return { error: parseResult.error };
  }
  return {
    type: 'cfg666',
    // 用验证后的 ConfigPara 替换原数组
    data: { ...json, ConfigPara: parseResult.configParas },
    fileName,
    warnings: parseResult.warnings
  };
}

/**
 * 解析 DBC666 数据并包装为标准返回格式
 * @param {string} fileName
 * @param {object} json
 * @returns {{ type: string, data: object, fileName: string, warnings: string[] }}
 */
function parseDbc666AndWrap(fileName, json) {
  const parseResult = parseImportedDBC666(json);
  if (parseResult.error) {
    return {
      error: parseResult.error,
      validationErrors: parseResult.validationErrors || []
    };
  }
  return {
    type: 'dbc666',
    data: parseResult.data,
    fileName,
    warnings: parseResult.warnings
  };
}

/**
 * 解析导入的 CFG666 JSON 对象，提取并验证 ConfigPara 数组
 *
 * 对每项进行以下检查:
 * - TempletType 是否为空
 * - TempletType 是否在 TEMPLET_TYPES 已知类型中
 * - TempletValue 是否能被 parseTempletValue 正确解析
 *
 * 注意: 验证失败的项不会被丢弃，而是保留原始数据并追加警告。
 * 由调用方根据 warnings 决定是忽略还是提示用户。
 *
 * @param {object} json - 已解析的 CFG666 JSON 对象
 * @returns {{
 *   configParas: object[],
 *   warnings: string[]
 * } | { error: string }}
 */
export function parseImportedCFG666(json) {
  // 结构验证
  if (!json || typeof json !== 'object') {
    return { error: '无效的 CFG666 数据：不是对象' };
  }

  if (!Array.isArray(json.ConfigPara)) {
    return { error: '无效的 CFG666 数据：缺少 ConfigPara 数组' };
  }

  const warnings = [];
  const configParas = [];

  for (let i = 0; i < json.ConfigPara.length; i++) {
    const item = json.ConfigPara[i];

    // 必须要有 TempletType，否则无法确定如何解析
    if (!item.TempletType) {
      warnings.push(`第 ${i + 1} 项缺少 TempletType 字段，已跳过`);
      continue;
    }

    // 检查 TempletType 是否在已知类型列表中
    if (!TEMPLET_TYPES[item.TempletType]) {
      warnings.push(
        `第 ${i + 1} 项的 TempletType "${item.TempletType}" 不在已知类型中，将保留原始数据`
      );
      configParas.push(item);
      continue;
    }

    // 验证 TempletValue 格式
    // parseTempletValue 内部可能 throw（如 GlobalVariableConfig 的 JSON.parse）
    if (item.TempletValue !== undefined && item.TempletValue !== null) {
      try {
        parseTempletValue(item.TempletType, String(item.TempletValue));
      } catch (parseError) {
        warnings.push(
          `第 ${i + 1} 项(${item.TempletType}) 的 TempletValue 解析失败: ${parseError.message}`
        );
      }
    }

    configParas.push(item);
  }

  return { configParas, warnings };
}

/**
 * 解析导入的 DBC666 JSON 对象，验证结构并返回完整对象
 *
 * @param {object} json - 已解析的 DBC666 JSON 对象
 * @returns {{
 *   data: object,
 *   warnings: string[]
 * } | { error: string, validationErrors: string[] }}
 */
export function parseImportedDBC666(json) {
  // 基础类型检查
  if (!json || typeof json !== 'object') {
    return { error: '无效的 DBC666 数据：不是对象' };
  }

  // 结构验证
  const validation = validateDBC666(json);

  if (!validation.valid) {
    return {
      error: 'DBC666 结构验证失败',
      validationErrors: validation.errors
    };
  }

  // 验证通过，返回完整对象
  return {
    data: json,
    warnings: []
  };
}
