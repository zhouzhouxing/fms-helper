/**
 * 默认参数配置模块
 *
 * 集中管理所有步骤中"写死"的参数默认值。
 * 用户可在"高级设置"弹窗中修改这些值，修改后存到 localStorage。
 * 生成 CFG666 时，各 step 文件从这里读取最新值。
 *
 * 存储 key: fms_advanced_params
 * 存储格式: JSON，如 { obc: { delay: 5000, ... }, dcdc: { ... }, invert: { ... } }
 *
 * 优先级：localStorage 用户改过的值 > 默认值
 */

// localStorage 存储 key
var STORAGE_KEY = 'fms_advanced_params';

// ===== 默认值定义 =====

var DEFAULTS = {
    // ---- OBC 参数（11项）----
    obc: {
        delay: 3000,              // 步骤延时(ms)
        triggerTimeOut: 180000,   // 触发超时(ms)
        adjustTime: 300,          // 触发调节时间(ms)
        reTestCount: 3,           // 重测次数
        reTestTime: 500,          // 重测间隔(ms)
        kl30Volt: 14,             // KL30默认电压(V)
        lowVoltLimitCurr: 3,      // 低压限流(A)
        vbatLimitCurr: 0.3,       // 电池限流(A)
        ccResistance: 220,        // CC电阻(Ω)
        cpPercent: 60,            // CP百分比(%)
        loadTriggerOffset: 15     // 负载触发偏移(V)：vout减去多少=触发阈值
    },

    // ---- DCDC 参数（6项）----
    dcdc: {
        delay: 3000,
        triggerTimeOut: 180000,
        adjustTime: 500,          // 注意：跟OBC不同
        reTestCount: 3,
        reTestTime: 500,
        dcInputLimitCurr: 20      // 直流输入限流(A)
    },

    // ---- 逆变参数（6项）----
    invert: {
        delay: 3000,
        triggerTimeOut: 180000,
        adjustTime: 300,
        reTestCount: 3,
        reTestTime: 500,
        ccResistance: 1000        // 注意：跟OBC不同
    }
};

// ===== 缓存：当前生效的配置（默认值 + 用户覆盖）=====

var _merged = null;

// ===== 核心 API =====

/**
 * 初始化：合并默认值和 localStorage 中保存的用户值
 * 在 app.js 启动时调用一次
 */
function init() {
    load();
}

/**
 * 从 localStorage 加载用户保存的配置，与默认值合并
 */
function load() {
    _merged = JSON.parse(JSON.stringify(DEFAULTS)); // 深拷贝默认值

    try {
        var saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            var userConfig = JSON.parse(saved);
            // 逐个合并（只覆盖用户改过的字段，保留默认值中没改的）
            for (var group in userConfig) {
                if (!_merged[group]) continue;
                for (var key in userConfig[group]) {
                    if (_merged[group].hasOwnProperty(key)) {
                        _merged[group][key] = userConfig[group][key];
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[AdvancedParams] 加载配置失败，使用默认值:', e);
    }
}

/**
 * 保存配置到 localStorage
 * @param {object} config - 完整的配置对象 { obc: {...}, dcdc: {...}, invert: {...} }
 */
function save(config) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        _merged = config;
    } catch (e) {
        console.error('[AdvancedParams] 保存配置失败:', e);
    }
}

/**
 * 恢复全部默认值
 */
function resetToDefault() {
    _merged = JSON.parse(JSON.stringify(DEFAULTS));
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.error('[AdvancedParams] 重置配置失败:', e);
    }
}

/**
 * 获取当前生效的配置
 * @param {string} [group] - 可选，只取某一组 'obc'|'dcdc'|'invert'。不传返回全部。
 * @returns {object}
 */
function get(group) {
    if (!_merged) load(); // 容错：如果忘了 init，自动加载
    if (group) return _merged[group] || {};
    return _merged;
}

/**
 * 获取默认值（不受用户修改影响的原始值）
 * @param {string} [group]
 * @returns {object}
 */
function getDefaults(group) {
    if (group) return DEFAULTS[group] || {};
    return DEFAULTS;
}

export { init, load, save, resetToDefault, get, getDefaults, STORAGE_KEY };
