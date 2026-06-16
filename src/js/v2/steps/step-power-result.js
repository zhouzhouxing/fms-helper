/**
 * 功率结果步骤定义 (PowerResult)
 *
 * 3个函数：
 *   1. buildPowerResultSingle — 单相步骤10
 *   2. buildTriphasePowerResult — 三相步骤10（L1/L2/L3输入侧）
 *   3. buildPowerResultThreePhase — 三相步骤11（输出侧 + ThreeMode=True）
 *
 * Offset/Accuracy 互斥规则（R4-3）：
 *   - 每个参数有2个输入：绝对误差(error) + 精度%(accuracy)
 *   - 只填一个 → 用那个
 *   - 两个都填 → 取范围更大的那个（更保守）
 *   - 输出时只填赢的那个（Offset 或 Accuracy），不同时填
 *   - OffsetMin/Max = ±errorValue, AccuracyMin/Max = ±accuracyValue
 *   - Min/Max = baseValue ± winningError
 */

import * as calc from '../calculator.js';
import * as params from '../config/default-params.js';

/**
 * 保留2位小数
 * 注意：step-builder.js 的 r2() 和 calculator.js 的 round2() 是同一个功能
 * 如果将来要改精度（比如保留3位），三个地方都要一起改
 */
function r2(v) {
    return Math.round(v * 100) / 100;
}

/**
 * 决定用绝对误差还是精度%，返回最终使用的误差值和类型
 *
 * 规则：
 *   - 只填了error → 用绝对误差
 *   - 只填了accuracy → 用精度%
 *   - 两个都填 → 比较两者产生的范围，取更大的
 *   - 都没填 → 默认用绝对误差5
 *
 * @param {number|null} errorValue - 绝对误差（如5V、0.5A）
 * @param {number|null} accuracyValue - 精度百分比（如1表示1%）
 * @param {number} baseValue - 基准值（用于计算精度产生的误差）
 * @param {number} defaultError - 默认绝对误差
 * @returns {{ type: 'offset'|'accuracy', value: number, effectiveError: number }}
 */
function decideErrorMode(errorValue, accuracyValue, baseValue, defaultError) {
    var hasError = errorValue != null && errorValue > 0;
    var hasAccuracy = accuracyValue != null && accuracyValue > 0;

    if (hasError && hasAccuracy) {
        // 两个都填：比较范围，取更大的
        var errorRange = errorValue;  // 绝对误差产生的范围
        var accuracyRange = baseValue * accuracyValue / 100;  // 精度产生的范围

        if (accuracyRange > errorRange) {
            // 精度范围更大，用精度
            return { type: 'accuracy', value: accuracyValue, effectiveError: accuracyRange };
        } else {
            // 绝对误差范围更大或相等，用绝对误差
            return { type: 'offset', value: errorValue, effectiveError: errorValue };
        }
    } else if (hasAccuracy) {
        // 只填了精度
        return { type: 'accuracy', value: accuracyValue, effectiveError: baseValue * accuracyValue / 100 };
    } else if (hasError) {
        // 只填了绝对误差
        return { type: 'offset', value: errorValue, effectiveError: errorValue };
    } else {
        // 都没填，用默认绝对误差
        return { type: 'offset', value: defaultError, effectiveError: defaultError };
    }
}

/**
 * 根据误差模式生成 Offset 或 Accuracy 字段
 * 只填赢的那个，互斥
 *
 * @param {string} fieldPrefix - 字段前缀（如 'OBCInVoltOffsetMinL1' 或 'OBCOutVoltOffsetMin'）
 * @param {{ type: string, value: number, effectiveError: number }} mode
 * @returns {object}
 */
function buildErrorFields(fieldPrefix, mode) {
    var fields = {};
    if (mode.type === 'offset') {
        fields[fieldPrefix + 'OffsetMin'] = String(r2(-mode.value));
        fields[fieldPrefix + 'OffsetMax'] = String(r2(mode.value));
    } else {
        fields[fieldPrefix + 'AccuracyMin'] = String(r2(-mode.value));
        fields[fieldPrefix + 'AccuracyMax'] = String(r2(mode.value));
    }
    return fields;
}

/**
 * 生成单组 Min/Max + Offset/Accuracy 字段（单相版，带Prod/Mach前缀）
 * @param {string} prodPrefix - 如 'ProdOBCInVolt'
 * @param {string} machPrefix - 如 'MachOBCInVolt'
 * @param {number} baseValue - 基准值
 * @param {{ type: string, value: number, effectiveError: number }} mode
 * @param {boolean} protectNegative - 是否保护负电流（默认false）
 * @returns {object}
 */
function buildSinglePhaseFields(prodPrefix, machPrefix, baseValue, mode, protectNegative) {
    var fields = {};
    var bounds = { min: r2(baseValue - mode.effectiveError), max: r2(baseValue + mode.effectiveError) };
    if (protectNegative && bounds.min < 0.1) bounds.min = 0.1;

    // 产品端 Min/Max
    fields[prodPrefix + 'Min'] = String(bounds.min);
    fields[prodPrefix + 'Max'] = String(bounds.max);

    // 工装端 Min/Max
    fields[machPrefix + 'Min'] = String(bounds.min);
    fields[machPrefix + 'Max'] = String(bounds.max);

    // Offset 或 Accuracy（互斥）
    // Offset/Accuracy字段不带Prod/Mach前缀，只用OBCXxx
    var errorPrefix = prodPrefix.replace(/^Prod/, '');
    var errorFields = buildErrorFields(errorPrefix, mode);
    for (var k in errorFields) { fields[k] = errorFields[k]; }

    return { fields: fields, bounds: bounds };
}

// ============================================================
// 1. 单相 PowerResult（步骤10）
// ============================================================

/**
 * @param {object} pointData - {vin, vout, iout, pout, iin, freq}
 * @param {object} calcResult
 * @param {object} sharedParams
 * @returns {object}
 */
function buildPowerResultSingle(pointData, calcResult, sharedParams) {
    var p = sharedParams || {};
    var cfg = params.get('obc');
    var vin = pointData.vin || 0;
    var vout = pointData.vout || 0;
    var iout = pointData.iout || 0;
    var pout = pointData.pout || 0;
    var freq = pointData.freq;
    var eff = p.efficiency || 96;

    // 用户没填iout时从pout/vout推算
    if ((!iout || iout <= 0) && vout > 0 && pout > 0) {
        iout = pout / vout;
    }

    // 输入电流（用户不提供时推算）
    var iin = pointData.iin;
    if (!iin || iin <= 0) {
        iin = calc.estimateInputCurrent(pout, eff, vin);
    }

    // 误差模式决策（用新的互斥逻辑）
    var vinMode = decideErrorMode(p.vinError, p.vinAccuracy, vin, 5);
    var iinMode = decideErrorMode(p.iinError, p.iinAccuracy, iin, 0.5);
    var voutMode = decideErrorMode(p.voutError, p.voutAccuracy, vout, 5);
    var ioutMode = decideErrorMode(p.ioutError, p.ioutAccuracy, iout, 0.5);

    var fields = {};

    // 基础设置
    fields.InvMode = 'False';
    fields.ThreeMode = 'False';
    fields.ResetDecode = 'False';
    fields.DecodeDelayTime = '100';
    fields.ReTestCount = String(cfg.reTestCount);
    fields.ReTestTime = String(cfg.reTestTime);

    // ---- 输入侧 ----
    var vinResult = buildSinglePhaseFields('ProdOBCInVolt', 'MachOBCInVolt', vin, vinMode);
    for (var k in vinResult.fields) { fields[k] = vinResult.fields[k]; }

    var iinResult = buildSinglePhaseFields('ProdOBCInCurr', 'MachOBCInCurr', iin, iinMode, true);
    for (var k in iinResult.fields) { fields[k] = iinResult.fields[k]; }

    // 输入功率
    fields.MachOBCInPowerMin = String(r2(vinResult.bounds.min * Math.max(0.1, iinResult.bounds.min)));
    fields.MachOBCInPowerMax = String(r2(vinResult.bounds.max * Math.max(0.1, iinResult.bounds.max)));

    // ---- 输出侧 ----
    var voutResult = buildSinglePhaseFields('ProdOBCOutVolt', 'MachOBCOutVolt', vout, voutMode);
    for (var k in voutResult.fields) { fields[k] = voutResult.fields[k]; }

    var ioutResult = buildSinglePhaseFields('ProdOBCOutCurr', 'MachOBCOutCurr', iout, ioutMode, true);
    for (var k in ioutResult.fields) { fields[k] = ioutResult.fields[k]; }

    // 输出功率
    fields.MachOBCOutPowerMin = String(r2(voutResult.bounds.min * Math.max(0.1, ioutResult.bounds.min)));
    fields.MachOBCOutPowerMax = String(r2(voutResult.bounds.max * Math.max(0.1, ioutResult.bounds.max)));

    // ---- 频率（有频率且填了频率误差才写）----
    if (freq != null && freq > 0 && p.freqError != null) {
        var freqBounds = calc.calcMinMax(freq, p.freqError);
        fields.MachOBCFrequencyMin = String(freqBounds.min);
        fields.MachOBCFrequencyMax = String(freqBounds.max);
    }

    // ---- 转换效率（用户填了才写）----
    if (pointData.efficiencyMin != null || pointData.efficiencyMax != null) {
        fields.OBCConversionEfficiencyMin = String(pointData.efficiencyMin != null ? pointData.efficiencyMin : eff);
        fields.OBCConversionEfficiencyMax = String(pointData.efficiencyMax != null ? pointData.efficiencyMax : eff);
    }

    // ---- 功率因数PF（用户填了才写）----
    if (pointData.pfMin != null) {
        fields.MachOBCPFMin = String(pointData.pfMin);
    }
    if (pointData.pfMax != null) {
        fields.MachOBCPFMax = String(pointData.pfMax);
    }

    // 保存 ioutMin 供步骤9 DelayConfig 使用
    fields._ioutMin = ioutResult.bounds.min;

    return fields;
}

// ============================================================
// 2. 三相 TriphasePowerResult（步骤10 — L1/L2/L3输入侧）
// ============================================================

/**
 * @param {object} pointData - {vin, pout, freq}
 * @param {object} calcResult
 * @param {object} sharedParams - {vinError, vinAccuracy, iinError, iinAccuracy, efficiency, freqError, vinType, poutType}
 * @returns {object}
 */
function buildTriphasePowerResult(pointData, calcResult, sharedParams) {
    var p = sharedParams || {};
    var cfg = params.get('obc');
    var vin = pointData.vin || 0;
    var pout = pointData.pout || 0;
    var freq = pointData.freq;
    // 三相输入电流计算用误差参数区的效率（没填默认96%）
    var calcEff = p.efficiency || 96;

    // R4-1: 根据用户选择的电压类型决定是否除以√3
    var phaseVoltage;
    if (p.vinType === 'phase') {
        phaseVoltage = vin;
    } else {
        phaseVoltage = calc.calcPhaseVoltage(vin);
    }

    // R6-1: 用户给了输入电流就直接用，没填才推算
    var phaseCurrent;
    var userIin = pointData.iin;
    if (userIin && userIin > 0) {
        phaseCurrent = userIin;
    } else {
        phaseCurrent = calc.calcThreePhaseCurrent(pout, calcEff, phaseVoltage);
    }

    var fields = {};

    // 基础
    fields.ReTestCount = String(cfg.reTestCount);
    fields.ReTestTime = String(cfg.reTestTime);

    // 误差模式决策
    var vinMode = decideErrorMode(p.vinError, p.vinAccuracy, phaseVoltage, 5);
    var iinMode = decideErrorMode(p.iinError, p.iinAccuracy, phaseCurrent, 0.5);

    var vinBounds = { min: r2(phaseVoltage - vinMode.effectiveError), max: r2(phaseVoltage + vinMode.effectiveError) };
    var iinBounds = { min: r2(phaseCurrent - iinMode.effectiveError), max: r2(phaseCurrent + iinMode.effectiveError) };
    // 负电流保护
    if (iinBounds.min < 0.1) iinBounds.min = 0.1;

    // 频率
    var freqErr = p.freqError;

    var phases = ['L1', 'L2', 'L3'];
    for (var i = 0; i < phases.length; i++) {
        var ph = phases[i];

        // 产品端输入电压 Min/Max
        fields['ProdOBCInVoltMin' + ph] = String(vinBounds.min);
        fields['ProdOBCInVoltMax' + ph] = String(vinBounds.max);

        // 产品端输入电流 Min/Max
        fields['ProdOBCInCurrMin' + ph] = String(iinBounds.min);
        fields['ProdOBCInCurrMax' + ph] = String(iinBounds.max);

        // 工装端输入电压 Min/Max
        fields['MachOBCInVoltMin' + ph] = String(vinBounds.min);
        fields['MachOBCInVoltMax' + ph] = String(vinBounds.max);

        // 工装端输入电流 Min/Max
        fields['MachOBCInCurrMin' + ph] = String(iinBounds.min);
        fields['MachOBCInCurrMax' + ph] = String(iinBounds.max);

        // 工装端输入功率 Min/Max
        fields['MachOBCInPowerMin' + ph] = String(r2(vinBounds.min * Math.max(0.1, iinBounds.min)));
        fields['MachOBCInPowerMax' + ph] = String(r2(vinBounds.max * Math.max(0.1, iinBounds.max)));

        // 频率 Min/Max（有频率且填了频率误差才写）
        if (freq != null && freq > 0 && freqErr != null) {
            var freqBounds = calc.calcMinMax(freq, freqErr);
            fields['MachOBCFrequencyMin' + ph] = String(r2(freqBounds.min));
            fields['MachOBCFrequencyMax' + ph] = String(r2(freqBounds.max));
        }

        // Offset 或 Accuracy（互斥，只填赢的那个）
        // 字段名格式：OBCInVoltOffsetMinL1 / OBCInVoltAccuracyMinL1
        if (vinMode.type === 'offset') {
            fields['OBCInVoltOffsetMin' + ph] = String(r2(-vinMode.value));
            fields['OBCInVoltOffsetMax' + ph] = String(r2(vinMode.value));
        } else {
            fields['OBCInVoltAccuracyMin' + ph] = String(r2(-vinMode.value));
            fields['OBCInVoltAccuracyMax' + ph] = String(r2(vinMode.value));
        }

        if (iinMode.type === 'offset') {
            fields['OBCInCurrOffsetMin' + ph] = String(r2(-iinMode.value));
            fields['OBCInCurrOffsetMax' + ph] = String(r2(iinMode.value));
        } else {
            fields['OBCInCurrAccuracyMin' + ph] = String(r2(-iinMode.value));
            fields['OBCInCurrAccuracyMax' + ph] = String(r2(iinMode.value));
        }
    }

    // 转换效率属于输出，不在步骤10

    return fields;
}

// ============================================================
// 3. 三相 PowerResult（步骤11 — 输出侧 + ThreeMode=True）
// ============================================================

/**
 * @param {object} pointData - {vout, iout, pout}
 * @param {object} calcResult
 * @param {object} sharedParams
 * @returns {object}
 */
function buildPowerResultThreePhase(pointData, calcResult, sharedParams) {
    var p = sharedParams || {};
    var cfg = params.get('obc');
    var vout = pointData.vout || 0;
    var iout = pointData.iout || 0;
    var pout = pointData.pout || 0;
    var eff = p.efficiency || 96;

    // 用户没填iout时从pout/vout推算（输出是直流，不除以3）
    if ((!iout || iout <= 0) && vout > 0 && pout > 0) {
        iout = pout / vout;
    }

    // 误差模式决策（输出侧是直流，不涉及√3）
    var voutMode = decideErrorMode(p.voutError, p.voutAccuracy, vout, 5);
    var ioutMode = decideErrorMode(p.ioutError, p.ioutAccuracy, iout, 0.5);

    var voutBounds = { min: r2(vout - voutMode.effectiveError), max: r2(vout + voutMode.effectiveError) };
    var ioutBounds = { min: r2(iout - ioutMode.effectiveError), max: r2(iout + ioutMode.effectiveError) };
    // 负电流保护
    if (ioutBounds.min < 0.1) ioutBounds.min = 0.1;

    var fields = {};

    // 基础设置
    fields.InvMode = 'False';
    fields.ThreeMode = 'True';
    fields.ResetDecode = 'False';
    fields.DecodeDelayTime = '100';
    fields.ReTestCount = String(cfg.reTestCount);
    fields.ReTestTime = String(cfg.reTestTime);

    // ---- 只管输出侧（直流，不除√3）----
    // 产品端输出电压 Min/Max
    fields.ProdOBCOutVoltMin = String(voutBounds.min);
    fields.ProdOBCOutVoltMax = String(voutBounds.max);

    // 产品端输出电流 Min/Max
    fields.ProdOBCOutCurrMin = String(ioutBounds.min);
    fields.ProdOBCOutCurrMax = String(ioutBounds.max);

    // 工装端输出电压 Min/Max
    fields.MachOBCOutVoltMin = String(voutBounds.min);
    fields.MachOBCOutVoltMax = String(voutBounds.max);

    // 工装端输出电流 Min/Max
    fields.MachOBCOutCurrMin = String(ioutBounds.min);
    fields.MachOBCOutCurrMax = String(ioutBounds.max);

    // 输出功率
    fields.MachOBCOutPowerMin = String(r2(voutBounds.min * Math.max(0.1, ioutBounds.min)));
    fields.MachOBCOutPowerMax = String(r2(voutBounds.max * Math.max(0.1, ioutBounds.max)));

    // Offset 或 Accuracy（互斥，只填赢的那个）
    var voutErrorFields = buildErrorFields('OBCOutVolt', voutMode);
    for (var k in voutErrorFields) { fields[k] = voutErrorFields[k]; }

    var ioutErrorFields = buildErrorFields('OBCOutCurr', ioutMode);
    for (var k in ioutErrorFields) { fields[k] = ioutErrorFields[k]; }

    // 转换效率（用户填了才写）
    if (pointData.efficiencyMin != null || pointData.efficiencyMax != null) {
        fields.OBCConversionEfficiencyMin = String(pointData.efficiencyMin != null ? pointData.efficiencyMin : eff);
        fields.OBCConversionEfficiencyMax = String(pointData.efficiencyMax != null ? pointData.efficiencyMax : eff);
    }

    // 功率因数PF（用户填了才写）
    if (pointData.pfMin != null) {
        fields.MachOBCPFMin = String(pointData.pfMin);
    }
    if (pointData.pfMax != null) {
        fields.MachOBCPFMax = String(pointData.pfMax);
    }

    // 保存 ioutMin
    fields._ioutMin = ioutBounds.min;

    return fields;
}

// ============================================================
// 4. DCDC PowerResult（步骤9 — 跟单相逻辑一样，字段名换成DCDC）
// ============================================================

/**
 * @param {object} pointData - {vin, vout, iout, pout, iin, efficiencyMin, efficiencyMax}
 * @param {object} calcResult
 * @param {object} sharedParams - DCDC误差参数
 * @returns {object}
 */
function buildDcdcPowerResult(pointData, calcResult, sharedParams) {
    var p = sharedParams || {};
    var cfg = params.get('dcdc');
    var vin = pointData.vin || 0;
    var vout = pointData.vout || 0;
    var iout = pointData.iout || 0;
    var pout = pointData.pout || 0;
    var eff = p.efficiency || 96;

    // 用户没填iout时从pout/vout推算
    if ((!iout || iout <= 0) && vout > 0 && pout > 0) {
        iout = pout / vout;
    }

    // 输入电流（用户不提供时推算）
    var iin = pointData.iin;
    if (!iin || iin <= 0) {
        iin = calc.estimateInputCurrent(pout, eff, vin);
    }

    // 误差模式决策
    var vinMode = decideErrorMode(p.vinError, p.vinAccuracy, vin, 5);
    var iinMode = decideErrorMode(p.iinError, p.iinAccuracy, iin, 0.5);
    var voutMode = decideErrorMode(p.voutError, p.voutAccuracy, vout, 5);
    var ioutMode = decideErrorMode(p.ioutError, p.ioutAccuracy, iout, 0.5);

    var fields = {};

    // 基础设置
    fields.InvMode = 'False';
    fields.ThreeMode = 'False';
    fields.ResetDecode = 'False';
    fields.DecodeDelayTime = '100';
    fields.ReTestCount = String(cfg.reTestCount);
    fields.ReTestTime = String(cfg.reTestTime);

    // ---- 输入侧 ----
    var vinResult = buildSinglePhaseFields('ProdDCDCInVolt', 'MachDCDCInVolt', vin, vinMode);
    for (var k in vinResult.fields) { fields[k] = vinResult.fields[k]; }

    var iinResult = buildSinglePhaseFields('ProdDCDCInCurr', 'MachDCDCInCurr', iin, iinMode, true);
    for (var k in iinResult.fields) { fields[k] = iinResult.fields[k]; }

    // 输入功率
    fields.MachDCDCInPowerMin = String(r2(vinResult.bounds.min * Math.max(0.1, iinResult.bounds.min)));
    fields.MachDCDCInPowerMax = String(r2(vinResult.bounds.max * Math.max(0.1, iinResult.bounds.max)));

    // ---- 输出侧 ----
    var voutResult = buildSinglePhaseFields('ProdDCDCOutVolt', 'MachDCDCOutVolt', vout, voutMode);
    for (var k in voutResult.fields) { fields[k] = voutResult.fields[k]; }

    var ioutResult = buildSinglePhaseFields('ProdDCDCOutCurr', 'MachDCDCOutCurr', iout, ioutMode, true);
    for (var k in ioutResult.fields) { fields[k] = ioutResult.fields[k]; }

    // 输出功率
    fields.MachDCDCOutPowerMin = String(r2(voutResult.bounds.min * Math.max(0.1, ioutResult.bounds.min)));
    fields.MachDCDCOutPowerMax = String(r2(voutResult.bounds.max * Math.max(0.1, ioutResult.bounds.max)));

    // ---- 转换效率（用户填了才写）----
    if (pointData.efficiencyMin != null || pointData.efficiencyMax != null) {
        fields.DCDCConversionEfficiencyMin = String(pointData.efficiencyMin != null ? pointData.efficiencyMin : eff);
        fields.DCDCConversionEfficiencyMax = String(pointData.efficiencyMax != null ? pointData.efficiencyMax : eff);
    }

    // 保存 ioutMin 供步骤8 DelayConfig 使用
    fields._ioutMin = ioutResult.bounds.min;

    return fields;
}

// ============================================================
// 5. 逆变 PowerResult（步骤8 — InvMode=True，OBC字段名）
// ============================================================

/**
 * 逆变功率结果
 *
 * 字段映射：
 *   逆变输出(AC) = OBC输入侧 → OBCInVolt, OBCInCurr
 *   逆变输入(DC) = OBC输出侧 → OBCOutVolt, OBCOutCurr
 *
 * 功率计算：
 *   输入功率(17,18) = MachOBCInPower = 输入电压Min/Max × 输入电流Min/Max
 *   输出功率(19,20) = MachOBCOutPower = 输出电压Min/Max × 输出电流Min/Max
 *
 * 输入电流推算：point.pout / efficiency / point.vin
 *
 * @param {object} pointData - {vout, iout, vin, pout, freq, thdvMin, thdvMax, pfMin, pfMax, efficiencyMin, efficiencyMax}
 * @param {object} calcResult
 * @param {object} sharedParams - 逆变误差参数
 * @returns {object}
 */
function buildInvertPowerResult(pointData, calcResult, sharedParams) {
    var p = sharedParams || {};
    var cfg = params.get('invert');
    var vout = pointData.vout || 0;   // 逆变输出电压（AC）
    var iout = pointData.iout || 0;   // 逆变输出电流（AC）
    var vin = pointData.vin || 0;     // 逆变输入电压（DC）
    var pout = pointData.pout || 0;   // 逆变输出功率
    var freq = pointData.freq;
    var eff = p.efficiency || 94;

    // 推算输入电流（逆变输入DC侧）
    // 输入电流 = 输出功率 / 效率 / 输入电压
    var iin = 0;
    if (vin > 0 && eff > 0) {
        iin = pout / (eff / 100) / vin;
    }

    // 误差模式决策
    // 注意：逆变的输出侧误差用 voutError/voutAccuracy，对应OBCIn字段
    //       逆变的输入侧误差用 vinError/vinAccuracy，对应OBCOut字段
    var voutMode = decideErrorMode(p.voutError, p.voutAccuracy, vout, 5);
    var ioutMode = decideErrorMode(p.ioutError, p.ioutAccuracy, iout, 0.5);
    var vinMode = decideErrorMode(p.vinError, p.vinAccuracy, vin, 5);
    var iinMode = decideErrorMode(p.iinError, p.iinAccuracy, iin, 0.5);

    var fields = {};

    // 基础设置
    fields.InvMode = 'True';
    fields.ThreeMode = 'False';
    fields.ResetDecode = 'False';
    fields.DecodeDelayTime = '100';
    fields.ReTestCount = String(cfg.reTestCount);
    fields.ReTestTime = String(cfg.reTestTime);

    // ---- 逆变输出侧（AC，对应OBC输入侧字段名）----
    var voutResult = buildSinglePhaseFields('ProdOBCInVolt', 'MachOBCInVolt', vout, voutMode);
    for (var k in voutResult.fields) { fields[k] = voutResult.fields[k]; }

    var ioutResult = buildSinglePhaseFields('ProdOBCInCurr', 'MachOBCInCurr', iout, ioutMode, true);
    for (var k in ioutResult.fields) { fields[k] = ioutResult.fields[k]; }

    // ---- 逆变输入侧（DC，对应OBC输出侧字段名）----
    var vinResult = buildSinglePhaseFields('ProdOBCOutVolt', 'MachOBCOutVolt', vin, vinMode);
    for (var k in vinResult.fields) { fields[k] = vinResult.fields[k]; }

    var iinResult = buildSinglePhaseFields('ProdOBCOutCurr', 'MachOBCOutCurr', iin, iinMode, true);
    for (var k in iinResult.fields) { fields[k] = iinResult.fields[k]; }

    // ---- 功率 ----
    // 逆变输入功率(17,18) = MachOBCInPower = 输入电压 × 输入电流
    fields.MachOBCInPowerMin = String(r2(vinResult.bounds.min * Math.max(0.1, iinResult.bounds.min)));
    fields.MachOBCInPowerMax = String(r2(vinResult.bounds.max * Math.max(0.1, iinResult.bounds.max)));

    // 逆变输出功率(19,20) = MachOBCOutPower = 输出电压 × 输出电流
    fields.MachOBCOutPowerMin = String(r2(voutResult.bounds.min * Math.max(0.1, ioutResult.bounds.min)));
    fields.MachOBCOutPowerMax = String(r2(voutResult.bounds.max * Math.max(0.1, ioutResult.bounds.max)));

    // ---- 功率因数PF（用户填了才写）----
    if (pointData.pfMin != null) {
        fields.MachOBCPFMin = String(pointData.pfMin);
    }
    if (pointData.pfMax != null) {
        fields.MachOBCPFMax = String(pointData.pfMax);
    }

    // ---- 总谐波电压THDV（用户填了才写）----
    if (pointData.thdvMin != null) {
        fields.MachOBCTHDVMin = String(pointData.thdvMin);
    }
    if (pointData.thdvMax != null) {
        fields.MachOBCTHDVMax = String(pointData.thdvMax);
    }

    // ---- 总谐波电流THDI — 不写 ----

    // ---- 频率（有频率且填了频率误差才写）----
    if (freq != null && freq > 0 && p.freqError != null) {
        var freqBounds = calc.calcMinMax(freq, p.freqError);
        fields.MachOBCFrequencyMin = String(freqBounds.min);
        fields.MachOBCFrequencyMax = String(freqBounds.max);
    }

    // ---- 转换效率（用户填了才写）----
    if (pointData.efficiencyMin != null || pointData.efficiencyMax != null) {
        fields.OBCConversionEfficiencyMin = String(pointData.efficiencyMin != null ? pointData.efficiencyMin : eff);
        fields.OBCConversionEfficiencyMax = String(pointData.efficiencyMax != null ? pointData.efficiencyMax : eff);
    }

    // 保存逆变输出电流下限供步骤7 DelayConfig 使用
    // MachineTriggerValue1 = 逆变输出电流下限 - 1 = ioutResult.bounds.min - 1
    fields._ioutMin = ioutResult.bounds.min;

    return fields;
}

export { buildPowerResultSingle, buildTriphasePowerResult, buildPowerResultThreePhase, buildDcdcPowerResult, buildInvertPowerResult };
