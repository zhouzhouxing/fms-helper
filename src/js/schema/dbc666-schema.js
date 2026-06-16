/**
 * DBC666 Schema - DBC参数配置文件结构定义
 * 
 * DBC666文件是JSON格式（UTF-8无BOM），用于Frame.ManagementSystem的DBC参数配置
 * 包含CAN信号到工具内部参数的映射关系
 */

// 生成UUID
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // fallback：简单的UUID生成
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 创建空DBC666配置对象
 * @param {string} configName - 配置名称
 * @returns {object} 完整的DBC666结构
 */
export function createEmptyDBC666(configName = '') {
  return {
    DbcFileGUID: generateUUID(),
    TraceInfomation: '未设置',
    CommuncationMode: 'CANFD',
    BaudRate: '500kbps',
    ProtocolVersion: '3.0',
    ConfigName: configName,
    CrcCheckType: '无CRC',
    CrcCheckInfo: [],
    SignParaInfo: [],
    TrigParaInfo: []
  };
}

// DBC666顶层必需字段
const REQUIRED_TOP_FIELDS = [
  'DbcFileGUID', 'TraceInfomation', 'CommuncationMode',
  'BaudRate', 'ProtocolVersion', 'ConfigName',
  'CrcCheckType', 'CrcCheckInfo', 'SignParaInfo', 'TrigParaInfo'
];

// SignParaInfo每项必需字段
const REQUIRED_SIGN_FIELDS = [
  'SignType', 'TempletName', 'ControlName', 'ParaName',
  'DBCMsgID', 'DBCSignName', 'DBCValueDesc'
];

/**
 * 验证DBC666 JSON结构是否正确
 * @param {any} json - 要验证的对象
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDBC666(json) {
  const errors = [];

  // 检查是否为对象
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { valid: false, errors: ['输入不是有效对象'] };
  }

  // 检查顶层字段
  for (const field of REQUIRED_TOP_FIELDS) {
    if (!(field in json)) {
      errors.push(`缺少顶层字段: ${field}`);
    }
  }

  // 检查SignParaInfo是否为数组
  if ('SignParaInfo' in json && !Array.isArray(json.SignParaInfo)) {
    errors.push('SignParaInfo 必须是数组');
  }

  // 检查SignParaInfo每项的字段
  if (Array.isArray(json.SignParaInfo)) {
    json.SignParaInfo.forEach((item, index) => {
      for (const field of REQUIRED_SIGN_FIELDS) {
        if (!(field in item)) {
          errors.push(`SignParaInfo[${index}] 缺少字段: ${field}`);
        }
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 创建单个SignParaInfo条目
 * @param {object} overrides - 覆盖默认值的字段
 * @returns {object} SignParaInfo条目
 */
export function createSignParaInfo(overrides = {}) {
  return {
    SignType: 0,
    TempletName: '',
    ControlName: '',
    ParaName: '',
    DBCMsgID: '',
    DBCSignName: '',
    DBCValueDesc: '',
    ...overrides
  };
}

/**
 * SignType含义映射
 */
export const SIGN_TYPES = {
  0: { label: 'OBC功能检查/总接收', desc: '接收信号' },
  1: { label: '产品配置', desc: '发送信号（OBC相关）' },
  2: { label: '功能结果/功率结果/全局变量读取', desc: '结果读取' },
  3: { label: '产品配置DCDC', desc: '发送信号（DCDC相关）' }
};
