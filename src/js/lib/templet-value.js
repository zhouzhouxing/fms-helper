/**
 * TempletValue 解析/格式化引擎
 *
 * 把 FMS 配置文件中的 TempletValue 字符串解析为结构化对象，
 * 修改后再格式化为字符串，保证 round-trip 一致性。
 *
 * 分离符（从真实文件的字节分析确认）：
 *   § (U+00A7) — 参数组之间的分隔
 *   ∥ (U+2225) — Key-Value 之间的分隔
 *   ‖ (U+2016) — 字段之间的分隔
 *
 * 两种格式：
 *   标准4字段: Key∥Value‖Bool‖Index          （3个 ‖ 分隔）
 *   Read 5字段: Key∥Bool‖VarName‖VarDesc‖Type （4个 ‖ 分隔）
 */

// ===== 核心常量 =====
/** 参数组分隔符（§） */
const SEP_ENTRY = '\u00A7';

/** Key-Value 分隔符（∥） */
const SEP_KV = '\u2225';

/** 字段分隔符（‖） */
const SEP_FIELD = '\u2016';

// ===== 解析器注册表 =====
const parserRegistry = new Map();

/**
 * 注册一个 TempletType 的专属解析/格式化器
 * @param {string} templetType - 类型名称（如 'GlobalVariableConfig'）
 * @param {{ parse: Function, format: Function }} handler - 解析和格式化函数
 */
function registerParser(templetType, { parse, format }) {
  parserRegistry.set(templetType, { parse, format });
}

/**
 * 解析 TempletValue 字符串为结构化对象
 * @param {string} templetType - 类型名称
 * @param {string} rawString - 原始 TempletValue 字符串
 * @returns {object} 结构化参数对象
 */
function parseTempletValue(templetType, rawString) {
  const handler = parserRegistry.get(templetType);
  if (handler) return handler.parse(rawString);
  // fallback：通用解析器（自动识别格式）
  return parseAny(rawString);
}

/**
 * 将结构化对象格式化为 TempletValue 字符串
 * @param {string} templetType - 类型名称
 * @param {object} params - 结构化参数对象
 * @returns {string} TempletValue 字符串
 */
function formatTempletValue(templetType, params) {
  const handler = parserRegistry.get(templetType);
  if (handler) return handler.format(params);
  // fallback：通用格式化器
  return formatAny(params);
}

// ===== 通用解析器（自动识别 4字段/5字段 格式）=====

/**
 * 通用解析：按照 ‖ 分割后，根据 parts 数量自动识别格式
 *
 * - fieldParts.length >= 4: Read 5字段格式 → { enabled, varName, varDesc, type }
 * - 其他: 标准4字段格式 → { value, enabled, index }
 *
 * @param {string} rawString
 * @returns {object}
 */
function parseAny(rawString) {
  if (!rawString) return {};

  const entries = rawString.split(SEP_ENTRY);
  const result = {};

  for (const entry of entries) {
    if (!entry) continue;

    const fieldParts = entry.split(SEP_FIELD);
    // fieldParts[0] 是 "Key∥Something"，需要再拆
    const kvParts = fieldParts[0].split(SEP_KV);
    const key = kvParts[0];
    const valueAfterKV = kvParts[1] ?? '';

    if (fieldParts.length >= 4) {
      // ===== Read 5字段格式：Key∥Bool‖VarName‖VarDesc‖Type =====
      result[key] = {
        enabled: valueAfterKV === 'True',
        varName: fieldParts[1] ?? '',
        varDesc: fieldParts[2] ?? '',
        type: fieldParts[3] ?? ''
      };
    } else {
      // ===== 标准4字段格式：Key∥Value‖Bool‖Index =====
      const rawIndex = parseInt(fieldParts[2] ?? '-1', 10);
      result[key] = {
        value: valueAfterKV,
        enabled: (fieldParts[1] ?? 'True') === 'True',
        index: Number.isNaN(rawIndex) ? -1 : rawIndex
      };
    }
  }

  return result;
}

/**
 * 通用格式化：根据每个参数是否有 varName 属性来选择输出格式
 *
 * @param {object} params
 * @returns {string}
 */
function formatAny(params) {
  const entries = [];

  // 保持插入顺序（JS 的 Object 属性顺序 = 插入顺序）
  for (const [key, param] of Object.entries(params)) {
    if ('varName' in param) {
      // Read 5字段格式
      entries.push(
        key +
        SEP_KV +
        (param.enabled ? 'True' : 'False') +
        SEP_FIELD +
        (param.varName ?? '') +
        SEP_FIELD +
        (param.varDesc ?? '') +
        SEP_FIELD +
        (param.type ?? '')
      );
    } else {
      // 标准4字段格式
      const index = Number.isNaN(param.index) ? -1 : param.index;
      entries.push(
        key +
        SEP_KV +
        (param.value ?? '') +
        SEP_FIELD +
        (param.enabled ? 'True' : 'False') +
        SEP_FIELD +
        index
      );
    }
  }

  return entries.join(SEP_ENTRY);
}

// ===== 专属解析器：GlobalVariableConfig（JSON 数组）=====

function parseConfig(rawString) {
  if (!rawString) return [];
  return JSON.parse(rawString);
}

function formatConfig(params) {
  return JSON.stringify(params);
}

// ===== 专属解析器：GlobalVariableRead（纯5字段）=====

function parseRead(rawString) {
  // GlobalVariableRead 全为5字段格式，直接复用通用解析器
  return parseAny(rawString);
}

function formatRead(params) {
  // 通用格式化器可以正确处理全5字段
  return formatAny(params);
}

// ===== 预注册已知类型 =====

// GlobalVariableConfig: TempletValue 是一个 JSON 数组字符串
// 例如: [{"Edited":true,"Name":"输出电压工装","Description":"输出电压工装上板","Type":1}, ...]
registerParser('GlobalVariableConfig', {
  parse: parseConfig,
  format: formatConfig
});

// GlobalVariableRead: 全部使用5字段格式 Key∥Bool‖VarName‖VarDesc‖Type
// 例如: MachDCDCInVolt∥True‖输入电压工装‖输入电压工装上板‖Number
registerParser('GlobalVariableRead', {
  parse: parseRead,
  format: formatRead
});

// GlobalVariableCalculate: 混合格式 — 部分标准4字段、部分Read5字段
// 不做专属注册，走 fallback 通用解析器（parseAny/formatAny 自动识别格式）

// 其他所有类型（DelayConfig、ProductConfig、PowerResult、
// GlobalVariableResult 等）全部走 fallback 通用解析器

// ===== 导出 =====
export {
  SEP_ENTRY,
  SEP_KV,
  SEP_FIELD,
  registerParser,
  parseTempletValue,
  formatTempletValue
};
