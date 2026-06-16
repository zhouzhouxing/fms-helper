/**
 * 步骤1: 量程设置 (PowerMeterAdvancedConfig)
 *
 * 固定字段: 线路滤波=5.5kHz, 响应速度=SLOW, 多量程表=0
 * 推算字段: 电压量程-OBC输入, 电压量程-OBC输出, 电流量程-OBC输出, 电流量程-OBC输入
 */

import * as calc from '../calculator.js';

// 电压量程档位列表
var VOLT_RANGES = [15, 30, 60, 100, 150, 300, 600, 1000];

// 电流量程档位列表
var CURR_RANGES = [0.5, 1, 2, 5, 10, 20, 40, 50];

/**
 * 格式化电压量程值，加上 V 单位
 * @param {number|string} val - 计算得出的量程值（数字 或 '自动'）
 * @returns {string} 带单位的量程字符串
 */
function formatVoltRange(val) {
    if (val === '自动') {
        return '自动';
    }
    return String(val) + 'V';
}

/**
 * 格式化电流量程值，加上 A/mA 单位
 * @param {number|string} val - 计算得出的量程值（数字 或 '自动'）
 * @returns {string} 带单位的量程字符串
 */
function formatCurrRange(val) {
    if (val === '自动') {
        return '自动';
    }
    if (val === 0.5) {
        return '500mA';
    }
    return String(val) + 'A';
}

/**
 * 构建量程设置步骤
 * @param {object} pointData - 测试点位 {vin, vout, iout, pout, iin, ...}
 * @param {object} calcResult - 计算器输出（可选，这里直接用pointData计算）
 * @param {object} sharedParams - 共享参数
 * @returns {object} TempletValue 参数键值对
 */
function buildStepPowerMeter(pointData, calcResult, sharedParams) {
    var vin = pointData.vin || 0;
    var vout = pointData.vout || 0;
    var iout = pointData.iout || 0;

    // 推算输入电流（用户不提供时用estimateInputCurrent）
    var iin = pointData.iin;
    if (!iin || iin <= 0) {
        var eff = (sharedParams && sharedParams.efficiency) || 96;
        iin = calc.estimateInputCurrent(pointData.pout || 0, eff, vin);
    }

    var params = {
        // OBC模式：Ch1/Ch2固定5.5kHz，Ch3/Ch4是DCDC不写
        LineFilteringChannel1: '5.5kHz',
        LineFilteringChannel2: '5.5kHz',
        VoltResponseSpeed: 'SLOW',
        MultiMeterRange: '0'
    };

    // 推算电压量程-OBC输入
    // 量程裕量：电压+20%（小电压精度高，大电压包得住波动）
    if (vin > 0) {
        params['VoltRangeChannel1'] = formatVoltRange(calc.calcRange(vin, vin * 0.2, VOLT_RANGES));
    }

    // 推算电压量程-OBC输出
    if (vout > 0) {
        params['VoltRangeChannel2'] = formatVoltRange(calc.calcRange(vout, vout * 0.2, VOLT_RANGES));
    }

    // 推算电流量程-OBC输出（Iout没填时从Pout/Vout推算）
    // 量程裕量：电流+50%（小电流精度高，大电流包得住波动）
    var ioutVal = iout;
    if ((!ioutVal || ioutVal <= 0) && vout > 0 && (pointData.pout || 0) > 0) {
        ioutVal = (pointData.pout || 0) / vout;
    }
    if (ioutVal && ioutVal > 0) {
        params['CurrRangeChannel2'] = formatCurrRange(calc.calcRange(ioutVal, ioutVal * 0.5, CURR_RANGES));
    }

    // 推算电流量程-OBC输入
    if (iin > 0) {
        params['CurrRangeChannel1'] = formatCurrRange(calc.calcRange(iin, iin * 0.5, CURR_RANGES));
    }

    return params;
}

export { buildStepPowerMeter };
