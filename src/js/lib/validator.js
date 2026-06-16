/**
 * 输入校验引擎
 *
 * 对 FMS 配置表单数据进行校验，包括 ConfigPara 数组、TempletValue、
 * 项目名称等，返回统一的错误报告格式。
 *
 * 使用方法：
 *   import { validateConfigPara, validateTempletValue, validateProjectName }
 *     from './lib/validator.js';
 *
 *   const result = validateConfigPara(configPara);
 *   if (!result.valid) {
 *     console.log(result.errors);
 *   }
 */
import { TEMPLET_TYPES } from '../schema/cfg666-schema.js';
import { parseTempletValue } from './templet-value.js';

/**
 * 校验整个 ConfigPara 数组
 *
 * 遍历每一项，检查：
 *   - TempletType 是否存在且为已知类型
 *   - TempletValue 是否能正确解析且不为空（除非类型允许空值）
 *   - 有 FuncDesc 要求的类型（hasFuncDesc=true）是否填写了 FuncDesc
 *
 * @param {Array} configPara - ConfigPara 数组
 * @returns {{ valid: boolean, errors: Array<{ index: number, field: string, message: string }> }}
 */
function validateConfigPara(configPara) {
  const errors = [];

  // 不是数组直接返回错误
  if (!Array.isArray(configPara)) {
    return {
      valid: false,
      errors: [{ index: -1, field: 'ConfigPara', message: 'ConfigPara 必须是数组' }]
    };
  }

  for (let i = 0; i < configPara.length; i++) {
    const item = configPara[i];

    // 每一项必须是对象
    if (!item || typeof item !== 'object') {
      errors.push({
        index: i,
        field: 'ConfigPara',
        message: `第 ${i + 1} 项不是有效对象`
      });
      continue;
    }

    // ---- 1. 检查 TempletType ----
    if (!item.TempletType) {
      errors.push({
        index: i,
        field: 'TempletType',
        message: `第 ${i + 1} 项缺少 TempletType`
      });
      continue; // 没有类型，后续校验无从谈起
    }

    const typeInfo = TEMPLET_TYPES[item.TempletType];
    if (!typeInfo) {
      errors.push({
        index: i,
        field: 'TempletType',
        message: `第 ${i + 1} 项的 TempletType "${item.TempletType}" 不是已知类型`
      });
      continue; // 未知类型，跳过后续校验
    }

    // ---- 2. 检查 TempletValue ----
    const tvResult = validateTempletValue(item.TempletType, item.TempletValue);
    for (const err of tvResult.errors) {
      errors.push({
        index: i,
        field: err.field,
        message: `第 ${i + 1} 项：${err.message}`
      });
    }

    // ---- 3. 检查 FuncDesc ----
    if (typeInfo.hasFuncDesc) {
      if (!item.FuncDesc || (typeof item.FuncDesc === 'string' && item.FuncDesc.trim() === '')) {
        errors.push({
          index: i,
          field: 'FuncDesc',
          message: `第 ${i + 1} 项 "${typeInfo.name}" 需要填写功能描述`
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 校验单个 TempletValue
 *
 * 校验内容：
 *   - 对含有默认参数的类型，TempletValue 不能为空
 *   - 尝试调用 parseTempletValue 解析，抛异常则无效
 *   - 对标准4字段格式，检查数字字段（typeCode=0/2）的值是否为有效数字
 *   - 对含有默认参数的类型，检查所有字段是否已填写
 *
 * @param {string} templetType - 模板类型（TEMPLET_TYPES 的键名）
 * @param {string} templetValue - 待校验的 TempletValue 字符串
 * @returns {{ valid: boolean, errors: Array<{ index: number, field: string, message: string }> }}
 */
function validateTempletValue(templetType, templetValue) {
  const errors = [];
  const typeInfo = TEMPLET_TYPES[templetType];

  // 未知类型 → 无法进一步校验
  if (!typeInfo) {
    errors.push({
      index: -1,
      field: 'TempletType',
      message: `未知的模板类型：${templetType}`
    });
    return { valid: false, errors };
  }

  const hasDefaultParams = Object.keys(typeInfo.defaultParams).length > 0;

  // ---- 空值检查 ----
  const isEmpty = !templetValue || (typeof templetValue === 'string' && templetValue.trim() === '');

  if (isEmpty && hasDefaultParams) {
    // 有默认参数的类型，TempletValue 必须有值
    errors.push({
      index: -1,
      field: 'TempletValue',
      message: `"${typeInfo.name}" 的 TempletValue 不能为空`
    });
    return { valid: false, errors };
  }

  if (isEmpty) {
    // 允许空值的类型（如 GlobalVariableConfig）→ 直接通过
    return { valid: true, errors: [] };
  }

  // ---- 尝试解析 ----
  let parsed;
  try {
    parsed = parseTempletValue(templetType, templetValue);
  } catch (e) {
    errors.push({
      index: -1,
      field: 'TempletValue',
      message: `解析失败：${e.message}`
    });
    return { valid: false, errors };
  }

  // 解析结果为空
  if (parsed === undefined || parsed === null) {
    errors.push({
      index: -1,
      field: 'TempletValue',
      message: '解析结果为空'
    });
    return { valid: false, errors };
  }

  // 对标准4字段格式的解析结果（普通对象，非数组），做字段级校验
  if (typeof parsed === 'object' && !Array.isArray(parsed)) {
    const entries = Object.entries(parsed);

    if (entries.length === 0) {
      errors.push({
        index: -1,
        field: 'TempletValue',
        message: '解析结果中不包含任何参数'
      });
      return { valid: false, errors };
    }

    for (const [key, field] of entries) {
      // ---- 数字字段校验 ----
      // 标准4字段格式中，field.index 即为原始编码中的 typeCode
      // typeCode 0=整数, 2=浮点数
      if ('index' in field && (field.index === 0 || field.index === 2)) {
        const rawValue = field.value;

        if (rawValue === '' || rawValue === undefined || rawValue === null) {
          errors.push({
            index: -1,
            field: `TempletValue.${key}`,
            message: `参数 "${key}" 是数字类型，但值为空`
          });
          continue;
        }

        const num = Number(rawValue);
        if (isNaN(num)) {
          errors.push({
            index: -1,
            field: `TempletValue.${key}`,
            message: `参数 "${key}" 需要是有效数字，当前值为 "${rawValue}"`
          });
        } else if (field.index === 0 && !Number.isInteger(num)) {
          // typeCode=0 要求整数
          errors.push({
            index: -1,
            field: `TempletValue.${key}`,
            message: `参数 "${key}" 需要是整数，当前值为 "${rawValue}"`
          });
        }
      }

      // ---- 必填字段不能为空 ----
      // 对于有默认参数的类型，所有默认参数都应该有值
      if (hasDefaultParams && key in typeInfo.defaultParams) {
        const val = 'value' in field ? field.value : null;
        if (val === '' || val === undefined || val === null) {
          errors.push({
            index: -1,
            field: `TempletValue.${key}`,
            message: `必填字段 "${key}" 不能为空`
          });
        }
      }
    }
  }

  // 对 GlobalVariableConfig 的 JSON 数组格式，检查每项的必要字段
  if (Array.isArray(parsed)) {
    for (let i = 0; i < parsed.length; i++) {
      const entry = parsed[i];
      if (!entry.Name) {
        errors.push({
          index: -1,
          field: `TempletValue[${i}].Name`,
          message: `全局变量第 ${i + 1} 项缺少变量名（Name）`
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 校验项目名称
 *
 * 规则：
 *   - 不能为空
 *   - 不能包含特殊字符：\/:*?"<>|
 *
 * @param {string} name - 项目名称
 * @returns {{ valid: boolean, errors: Array<{ index: number, field: string, message: string }> }}
 */
function validateProjectName(name) {
  const errors = [];

  // 不能为空
  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.push({
      index: -1,
      field: 'ProjectName',
      message: '项目名称不能为空'
    });
    return { valid: false, errors };
  }

  // 不能包含特殊字符：\/:*?"<>|
  const INVALID_CHARS = /[\\/:*?"<>|]/;
  if (INVALID_CHARS.test(name)) {
    errors.push({
      index: -1,
      field: 'ProjectName',
      message: `项目名称不能包含特殊字符（\\/:*?"<>|），当前名称：${name}`
    });
  }

  return { valid: errors.length === 0, errors };
}

export { validateConfigPara, validateTempletValue, validateProjectName };
