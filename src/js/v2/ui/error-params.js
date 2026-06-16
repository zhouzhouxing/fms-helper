/**
 * 误差参数组件
 *
 * 收集用户填写的误差参数：
 *   - 每个电压/电流参数有2个输入框：绝对误差 + 精度%
 *   - 只填一个用那个，两个都填取范围大的
 *   - 输入电压类型：线电压/相电压
 *   - 输出功率类型：总功率/单相功率
 *
 * DOM 依赖：
 *   - #vinError, #vinAccuracy, #iinError, #iinAccuracy, #freqError — 输入侧
 *   - #voutError, #voutAccuracy, #ioutError, #ioutAccuracy, #efficiency — 输出侧
 *   - #vinType, #poutType, #acInputMode, #includeWake — 选项
 */

// ===== 公共 API =====

/**
 * 初始化（V2 HTML中已设好默认值）
 */
function init() {
    // 默认值已在 HTML 中设置
}

/**
 * 获取所有误差参数
 * @returns {object}
 */
function getData() {
    // vinType 现在是勾选框：勾上='phase'，不勾='line'
    var vinTypeEl = document.getElementById('vinType');
    var vinType = (vinTypeEl && vinTypeEl.checked) ? 'phase' : 'line';

    return {
        // 输入电压类型
        vinType: vinType,

        // 输入侧：绝对误差 + 精度%
        vinError: getNumVal('vinError', null),
        vinAccuracy: getNumVal('vinAccuracy', null),
        iinError: getNumVal('iinError', null),
        iinAccuracy: getNumVal('iinAccuracy', null),
        freqError: getNumVal('freqError', null),

        // 输出侧：绝对误差 + 精度%
        voutError: getNumVal('voutError', null),
        voutAccuracy: getNumVal('voutAccuracy', null),
        ioutError: getNumVal('ioutError', null),
        ioutAccuracy: getNumVal('ioutAccuracy', null),

        // 其他
        efficiency: getNumVal('efficiency', 96),
        includeWake: document.getElementById('includeWake') ? document.getElementById('includeWake').checked : false,
        dcOutPoint: getSelectVal('dcOutPoint', ''),
        kl15Option: getSelectVal('kl15Option', '')
    };
}

// ===== 内部函数 =====

/**
 * 获取 number input 的值，取不到时返回默认值
 * @param {string} id
 * @param {number|null} defaultVal
 * @returns {number|null}
 */
function getNumVal(id, defaultVal) {
    var el = document.getElementById(id);
    if (!el) return defaultVal;
    var val = parseFloat(el.value);
    if (isNaN(val) || el.value.trim() === '') return defaultVal;
    return val;
}

/**
 * 获取 select 的值，取不到时返回默认值
 */
function getSelectVal(id, defaultVal) {
    var el = document.getElementById(id);
    if (!el) return defaultVal;
    return el.value || defaultVal;
}

/**
 * 根据测试模式显示/隐藏三相专属字段
 * @param {string} mode - 'obc-single' 或 'obc-three'
 */
function syncModeVisibility(mode) {
    var threePhaseElements = document.querySelectorAll('.three-phase-only');
    // 三相和混合模式都显示三相专属字段
    for (var i = 0; i < threePhaseElements.length; i++) {
        threePhaseElements[i].style.display = (mode === 'obc-three') ? '' : 'none';
    }
}

/**
 * 校验误差参数：4组（输入电压/电流、输出电压/电流）至少填一个（误差或精度）
 * @returns {{valid: boolean, errors: string[]}}
 */
function validate() {
    var errors = [];
    // 每组检查：误差和精度至少填一个
    var checks = [
        { errorId: 'vinError', accuracyId: 'vinAccuracy', name: '输入电压误差' },
        { errorId: 'iinError', accuracyId: 'iinAccuracy', name: '输入电流误差' },
        { errorId: 'voutError', accuracyId: 'voutAccuracy', name: '输出电压误差' },
        { errorId: 'ioutError', accuracyId: 'ioutAccuracy', name: '输出电流误差' }
    ];
    for (var i = 0; i < checks.length; i++) {
        var c = checks[i];
        var hasError = getNumVal(c.errorId, null) !== null;
        var hasAccuracy = getNumVal(c.accuracyId, null) !== null;
        if (!hasError && !hasAccuracy) {
            errors.push(c.name + '：误差和精度至少填写一个');
        }
    }
    return { valid: errors.length === 0, errors: errors };
}

// ===== 导出 =====

export { init, getData, syncModeVisibility, validate };
