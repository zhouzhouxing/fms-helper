/**
 * 逆变误差参数组件
 *
 * 收集逆变的误差参数：
 *   - 输出侧（AC）：电压误差+精度%、电流误差+精度%、频率误差
 *   - 输入侧（DC）：电压误差+精度%、电流误差+精度%、效率
 *   - 选项：唤醒开关、DC输出端、CC电阻值、负载模式
 *
 * DOM 依赖：
 *   #invertVoutError, #invertVoutAccuracy, #invertIoutError, #invertIoutAccuracy — 输出侧
 *   #invertFreqError — 输出频率误差
 *   #invertVinError, #invertVinAccuracy, #invertIinError, #invertIinAccuracy — 输入侧
 *   #invertEfficiency — 效率
 *   #invertIncludeWake, #invertDcOutPoint, #invertCcResistance, #invertLoadMode — 选项
 */

function init() {
    // 默认值已在 HTML 中设置
}

function getData() {
    return {
        // 输出侧（AC，对应OBC输入）
        voutError: getNumVal('invertVoutError', null),
        voutAccuracy: getNumVal('invertVoutAccuracy', null),
        ioutError: getNumVal('invertIoutError', null),
        ioutAccuracy: getNumVal('invertIoutAccuracy', null),
        freqError: getNumVal('invertFreqError', null),

        // 输入侧（DC，对应OBC输出）
        vinError: getNumVal('invertVinError', null),
        vinAccuracy: getNumVal('invertVinAccuracy', null),
        iinError: getNumVal('invertIinError', null),
        iinAccuracy: getNumVal('invertIinAccuracy', null),

        // 效率
        efficiency: getNumVal('invertEfficiency', 94),

        // 选项
        includeWake: document.getElementById('invertIncludeWake') ? document.getElementById('invertIncludeWake').checked : false,
        dcOutPoint: getSelectVal('invertDcOutPoint', ''),
        ccResistance: getSelectVal('invertCcResistance', '1000'),
        loadMode: getSelectVal('invertLoadMode', 'CR')
    };
}

// ===== 校验：4组误差/精度至少填一个 =====
function validate() {
    var errors = [];
    var checks = [
        { errorId: 'invertVoutError', accuracyId: 'invertVoutAccuracy', name: '逆变输出电压误差' },
        { errorId: 'invertIoutError', accuracyId: 'invertIoutAccuracy', name: '逆变输出电流误差' },
        { errorId: 'invertVinError', accuracyId: 'invertVinAccuracy', name: '逆变输入电压误差' },
        { errorId: 'invertIinError', accuracyId: 'invertIinAccuracy', name: '逆变输入电流误差' }
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
