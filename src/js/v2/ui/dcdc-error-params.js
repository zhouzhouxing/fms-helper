/**
 * DCDC误差参数组件
 *
 * 收集DCDC的误差参数：
 *   - 输入侧：电压误差+精度%、电流误差+精度%
 *   - 输出侧：电压误差+精度%、电流误差+精度%、效率
 *   - 选项：唤醒开关、DC输出端、KL15、48V继电器
 *
 * DOM 依赖：
 *   #dcdcVinError, #dcdcVinAccuracy, #dcdcIinError, #dcdcIinAccuracy — 输入侧
 *   #dcdcVoutError, #dcdcVoutAccuracy, #dcdcIoutError, #dcdcIoutAccuracy, #dcdcEfficiency — 输出侧
 *   #dcdcIncludeWake, #dcdcDcOutPoint, #dcdcKl15Option, #dcdcDcOutSwitchRelay — 选项
 */

function init() {
    // 默认值已在 HTML 中设置
}

function getData() {
    return {
        vinError: getNumVal('dcdcVinError', null),
        vinAccuracy: getNumVal('dcdcVinAccuracy', null),
        iinError: getNumVal('dcdcIinError', null),
        iinAccuracy: getNumVal('dcdcIinAccuracy', null),

        voutError: getNumVal('dcdcVoutError', null),
        voutAccuracy: getNumVal('dcdcVoutAccuracy', null),
        ioutError: getNumVal('dcdcIoutError', null),
        ioutAccuracy: getNumVal('dcdcIoutAccuracy', null),

        efficiency: getNumVal('dcdcEfficiency', 94),
        loadStepValue: getNumVal('dcdcLoadStepValue', 10),
        includeWake: document.getElementById('dcdcIncludeWake') ? document.getElementById('dcdcIncludeWake').checked : false,
        dcOutPoint: getSelectVal('dcdcDcOutPoint', ''),
        kl15Option: getSelectVal('dcdcKl15Option', ''),
        dcOutSwitchRelay: getSelectVal('dcdcDcOutSwitchRelay', '')
    };
}

// ===== 校验：4组误差/精度至少填一个 =====
function validate() {
    var errors = [];
    var checks = [
        { errorId: 'dcdcVinError', accuracyId: 'dcdcVinAccuracy', name: 'DCDC输入电压误差' },
        { errorId: 'dcdcIinError', accuracyId: 'dcdcIinAccuracy', name: 'DCDC输入电流误差' },
        { errorId: 'dcdcVoutError', accuracyId: 'dcdcVoutAccuracy', name: 'DCDC输出电压误差' },
        { errorId: 'dcdcIoutError', accuracyId: 'dcdcIoutAccuracy', name: 'DCDC输出电流误差' }
    ];
    for (var i = 0; i < checks.length; i++) {
        var c = checks[i];
        if (getNumVal(c.errorId, null) === null && getNumVal(c.accuracyId, null) === null) {
            errors.push(c.name + '：误差和精度至少填写一个');
        }
    }
    return { valid: errors.length === 0, errors: errors };
}

// ===== 内部函数 =====

function getNumVal(id, defaultVal) {
    var el = document.getElementById(id);
    if (!el) return defaultVal;
    var val = parseFloat(el.value);
    if (isNaN(val) || el.value.trim() === '') return defaultVal;
    return val;
}

function getSelectVal(id, defaultVal) {
    var el = document.getElementById(id);
    if (!el) return defaultVal;
    return el.value || defaultVal;
}

export { init, getData, validate };
