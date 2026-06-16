/**
 * Step Builder - 步骤组装器
 *
 * 把测试点位数据 + 误差参数 → 调用各步骤定义 → 组装成 ConfigPara 数组。
 * 这是 V2 的核心：从"用户输入"到"CFG666 数据"的桥梁。
 *
 * 单相15步: 1→2→(3?)→4→5→6→7→8→9→10→11→12→13→14→15
 * 三相16步: 1→2→(3?)→4→5→6→7→8→9→10(Triphase)→11(PowerResult)→12→13→14→15→16
 */

import * as calc from './calculator.js';
import * as stepPowerMeter from './steps/step-power-meter.js';
import * as stepObcDevice from './steps/step-obc-device.js';
import * as stepProductConfig from './steps/step-product-config.js';
import * as stepDelay from './steps/step-delay.js';
import * as stepPowerResult from './steps/step-power-result.js';
import * as advParams from './config/default-params.js';

/**
 * 功率单位智能格式化
 * < 1000W → "500W"
 * >= 1000W → "1.5kW"（小写k，大写W）
 */
function formatPower(watts) {
    if (watts >= 1000) {
        var kw = watts / 1000;
        // 去掉多余的小数位（如 2.000 → 2）
        return (kw % 1 === 0 ? kw.toFixed(0) : String(parseFloat(kw.toFixed(3)))) + 'kW';
    }
    return watts + 'W';
}

// TempletValue 编码工具（从V1复用）
// 因为V1用ES Module，V2用CommonJS，这里内联一个简化版编码器
var SEP_ENTRY = '\u00A7';  // §
var SEP_KV = '\u2225';     // ∥
var SEP_FIELD = '\u2016';  // ‖

/**
 * 字段名 → typeCode 映射表
 * -1: 文本/布尔/下拉, 0: 整数, 2: 浮点容量（即使当前值是整数）
 * 
 * 规则：
 *   电压/电流/功率/频率/百分比/Min/Max/Offset/Accuracy → 2
 *   延时/计数/模式开关 → 0
 *   文本/布尔/下拉选项/中文值 → -1
 */
var FIELD_TYPE_MAP = {
    // === 固定整数字段 (type 0) ===
    Delay: 0,
    MultiMeterRange: 0,
    DecodeDelayTime: 0,
    OBCSendStatus: 0,
    DCDCSendStatus: 0,
    ReTestCount: 0,
    ReTestTime: 0,
    AdjustTime: 0,
    TriggerTimeOut: 0,
    TriggerAdjustTime: 0,
    LoadEndValue: 2,
    LoadStepValue: 2,
    LoadAdjustTime: 0,
    BoardNumber: 0,
    AllowReTestTimes: 0,
    ReTestTimes: 0,

    // === 浮点容量字段 (type 2) ===
    // 电压类
    KL30Volt: 2,
    AcVolt: 2,
    VBatVolt: 2,
    VBatLimitCurr: 2,
    LoadValue: 2,
    VoltRangeChannel1: 2,
    VoltRangeChannel2: 2,
    // 电流类
    CurrRangeChannel1: 2,
    CurrRangeChannel2: 2,
    LowVoltLimitCurr: 2,
    // 频率/百分比类
    InputFrequency: 2,
    CPSetValuePercent: 2,
    // 触发值
    MachineTriggerValue1: 2,
    // 预留字段
    OBCReserve1: 2,
    OBCReserve2: 2,

    // === 特殊字段（值是数字但语义是文本/下拉） ===
    CCSetValueResistance: -1,

    // === 布尔/文本字段（需覆盖模式匹配） ===
    LoadMode: -1,
    LoadControlWay: -1,
    LoadLoop: -1,
    DCOutRelay: -1,
    DCOutSwitchRelay: -1,
    DCOutPoint: -1,
    EnableKL15: -1,
    EnableTrigger: -1,
    EnableOBCTrigger: -1,
    EnableJudgeStability: -1,
    MachineTrigger1: -1,
    MachineSampleRelationship: -1,
    SampleOBCInVolt: -1,
    SampleOBCInCurr: -1,
    SampleOBCOutVolt: -1,
    SampleOBCOutCurr: -1,
    SampleDCDCInVolt: -1,
    SampleDCDCInCurr: -1,
    SampleDCDCOutVolt: -1,
    SampleDCDCOutCurr: -1,
    // 逆变专属字段
    InvertMode: -1,
    CcCpControl: -1,
    InvMode: -1,
    ThreeMode: -1,
    ResetDecode: -1
};

/**
 * 字段名模式匹配 typeCode
 * 用于匹配 Min/Max/Offset/Accuracy/Power/Frequency 等动态字段名
 */
var FIELD_PATTERN_RULES = [
    { pattern: /Min$/, typeCode: 2 },          // 所有 *Min 字段
    { pattern: /Max$/, typeCode: 2 },          // 所有 *Max 字段
    { pattern: /MinL[123]$/, typeCode: 2 },    // 三相 *MinL1/L2/L3
    { pattern: /MaxL[123]$/, typeCode: 2 },    // 三相 *MaxL1/L2/L3
    { pattern: /Volt/i, typeCode: 2 },         // 包含 Volt 的字段
    { pattern: /Curr/i, typeCode: 2 },         // 包含 Curr 的字段
    { pattern: /Power/i, typeCode: 2 },        // 包含 Power 的字段
    { pattern: /Freq/i, typeCode: 2 },         // 包含 Freq 的字段
    { pattern: /Efficiency/i, typeCode: 2 },   // 效率字段
    { pattern: /Offset/i, typeCode: 2 },       // Offset 字段
    { pattern: /Accuracy/i, typeCode: 2 },     // Accuracy 字段
    { pattern: /PF/i, typeCode: 2 },           // 功率因数
    { pattern: /Range/i, typeCode: 2 }         // 量程字段
];

/**
 * 根据字段名判断数据类型码
 * -1: 文本/布尔/下拉, 0: 整数, 2: 浮点数
 */
function getTypeCode(fieldName, value) {
    // 1. 精确匹配映射表
    if (FIELD_TYPE_MAP.hasOwnProperty(fieldName)) {
        return FIELD_TYPE_MAP[fieldName];
    }

    // 2. 模式匹配（Min/Max/Volt/Curr等动态字段）
    for (var i = 0; i < FIELD_PATTERN_RULES.length; i++) {
        if (FIELD_PATTERN_RULES[i].pattern.test(fieldName)) {
            return FIELD_PATTERN_RULES[i].typeCode;
        }
    }

    // 3. Fallback：按值格式判断
    var str = String(value);
    if (/^-?\d+$/.test(str)) return 0;
    if (/^-?\d+\.\d+$/.test(str)) return 2;
    return -1;
}

/**
 * 把参数对象编码为 TempletValue 字符串
 * @param {object} params - { key: value, ... }
 * @returns {string}
 */
function encodeTempletValue(params) {
    if (!params) return '';
    var parts = [];
    for (var key in params) {
        if (!params.hasOwnProperty(key)) continue;
        if (key.charAt(0) === '_') continue; // 跳过内部字段（如 _ioutMin）
        var val = String(params[key]);
        var typeCode = getTypeCode(key, val);
        parts.push(key + SEP_KV + val + SEP_FIELD + 'True' + SEP_FIELD + typeCode);
    }
    return parts.join(SEP_ENTRY);
}

/**
 * 估算输入电流
 */
function estimateIin(pointData, efficiency) {
    if (pointData.iin && pointData.iin > 0) return pointData.iin;
    return calc.estimateInputCurrent(pointData.pout || 0, efficiency, pointData.vin || 0);
}

// 量程格式化（跟step-power-meter.js一致）
function formatVoltRange(val) {
    if (val === '自动') return '自动';
    return String(val) + 'V';
}
function formatCurrRange(val) {
    if (val === '自动') return '自动';
    if (val === 0.5) return '500mA';
    return String(val) + 'A';
}

// 保留2位小数
// 注意：calculator.js 的 round2() 和 step-power-result.js 的 r2() 是同一个功能
// 如果将来要改精度（比如保留3位），三个地方都要一起改
function r2(v) {
    return Math.round(v * 100) / 100;
}

/**
 * 构建点位信息标签
 * 格式：输入部分&输出部分-序号
 * 输入部分：VinV/IinA/FreqHz（没填的跳过，不自动推算输入功率）
 * 输出部分：VoutV/IoutA-PoutW（没填的跳过）
 * @param {object} point - 点位数据
 * @param {number} index - 序号（从1开始，按步骤递增）
 * @returns {string}
 */
function buildPointLabel(point, index) {
    var seq = index < 10 ? '0' + index : String(index);

    // 输入部分：只取用户填了的字段，不自动推算
    var inParts = [];
    if (point.vin) inParts.push(point.vin + 'V');
    if (point.iin) inParts.push(point.iin + 'A');
    if (point.freq) inParts.push(point.freq + 'Hz');

    // 输出部分
    var outParts = [];
    var oviParts = [];
    if (point.vout) oviParts.push(point.vout + 'V');
    if (point.iout) oviParts.push(point.iout + 'A');
    if (oviParts.length > 0) outParts.push(oviParts.join('/'));
    if (point.pout) outParts.push(formatPower(point.pout));

    // 组合
    var label = '';
    if (inParts.length > 0) {
        label += inParts.join('/');
    }
    if (outParts.length > 0) {
        if (label) label += '&';
        label += outParts.join('-');
    }
    label += '-' + seq;

    return label;
}

/**
 * 主函数：构建所有步骤的 ConfigPara 数组
 *
 * @param {Array} obcPoints - OBC点位数组（可为空数组）
 * @param {Array} dcdcPoints - DCDC点位数组（可为空数组）
 * @param {Array} invertPoints - 逆差点位数组（可为空数组）
 * @param {string} mode - 测试模式（'obc-single'|'obc-three'|'obc-mixed'|...）
 * @param {object} obcEp - OBC误差参数
 * @param {object} dcdcEp - DCDC误差参数
 * @param {object} invertEp - 逆变误差参数
 * @returns {Array} ConfigPara 数组
 */
function buildAllSteps(obcPoints, dcdcPoints, invertPoints, mode, obcEp, dcdcEp, invertEp) {
    var allSteps = [];
    var hasObc = mode.indexOf('obc') !== -1;
    var hasDcdc = mode.indexOf('dcdc') !== -1;
    var hasInvert = mode === 'invert';

    // ===== OBC 部分 =====
    if (hasObc) {
        var obcSubMode = 'obc-single';
        if (mode === 'obc-three' || mode === 'obc-three-dcdc') obcSubMode = 'obc-three';
        else if (mode === 'obc-mixed' || mode === 'obc-mixed-dcdc') obcSubMode = 'obc-mixed';

        var obcResult = buildObcSteps(obcPoints, obcSubMode, obcEp || {});
        allSteps = allSteps.concat(obcResult);
    }

    // ===== DCDC 部分 =====
    if (hasDcdc) {
        var dcdcResult = buildDcdcSteps(dcdcPoints, dcdcEp || {}, hasObc);
        allSteps = allSteps.concat(dcdcResult);
    }

    // ===== 逆变 部分 =====
    if (hasInvert) {
        var invertResult = buildInvertSteps(invertPoints, invertEp || {});
        allSteps = allSteps.concat(invertResult);
    }

    return allSteps;
}

// ============================================================
// OBC 步骤构建（原有逻辑，提取为独立函数）
// ============================================================

function buildObcSteps(points, obcMode, ep) {
    var isThree = obcMode === 'obc-three';
    var isMixed = obcMode === 'obc-mixed';
    var allSteps = [];

    // ===== 全局量程步骤（只创建1个，取所有点位中最大量程） =====
    // 构造一个合并点位：取所有点位的最大vin/vout/iout/iin
    var mergedPoint = { vin: 0, vout: 0, iout: 0, pout: 0, iin: 0 };
    for (var m = 0; m < points.length; m++) {
        var pt = points[m];
        if ((pt.vin || 0) > mergedPoint.vin) mergedPoint.vin = pt.vin;
        if ((pt.vout || 0) > mergedPoint.vout) mergedPoint.vout = pt.vout;
        if ((pt.pout || 0) > mergedPoint.pout) mergedPoint.pout = pt.pout;
        if ((pt.iin || 0) > mergedPoint.iin) mergedPoint.iin = pt.iin;
        // Iout 可能为空，用 Pout/Vout 推算
        var ptIout = pt.iout || 0;
        if ((!ptIout || ptIout <= 0) && (pt.vout || 0) > 0 && (pt.pout || 0) > 0) {
            ptIout = pt.pout / pt.vout;
        }
        if (ptIout > mergedPoint.iout) mergedPoint.iout = ptIout;
    }

    var globalShared = Object.assign({}, ep, {
        efficiency: 96  // 量程步骤用默认效率即可
    });
    var step1Params = stepPowerMeter.buildStepPowerMeter(mergedPoint, {}, globalShared);
    allSteps.push(makeConfigPara(
        '', '量程设置', 'PowerMeterAdvancedConfig', '', step1Params
    ));

    // ===== 各点位的步骤2~15/16 =====
    for (var i = 0; i < points.length; i++) {
        var point = points[i];

        // 序号计数器：按步骤递增，只有有TestItem的步骤才消耗序号
        var stepSeq = 1;

        // 共享参数
        // 计算效率：用误差参数区的效率（默认96%），点位表格的效率Min/Max只用于输出结果
        var calcEfficiency = ep.efficiency || 96;

        // 混合模式下按点位勾选判断单相/三相
        var pointIsThree = isMixed ? !!point.isThreePhase : isThree;

        var shared = Object.assign({}, ep, {
            _paramGroup: 'obc',
            freq: point.freq || ep.freq || 50,
            efficiency: calcEfficiency,
            kl30Volt: point.kl30 || 14,
            acInputMode: pointIsThree ? '三相模式' : '单相模式',
            dcOutPoint: ep.dcOutPoint || '',
            kl15Option: ep.kl15Option || ''
        });

        // 计算结果容器
        var calcResult = {};

        // ===== 步骤2: 上辅电 =====
        var step2Params = stepObcDevice.buildStep2(point, calcResult, shared);
        allSteps.push(makeConfigPara(
            buildPointLabel(point, stepSeq++), 'OBC设备配置', 'OBCDeviceConfig', '上辅电', step2Params
        ));

        // ===== 步骤3: 唤醒（可选，不消耗序号）=====
        var step3Params = stepProductConfig.buildStep3(point, calcResult, shared);
        if (step3Params) {
            allSteps.push(makeConfigPara(
                '', '产品配置', 'ProductConfig', '唤醒', step3Params
            ));
        }

        // ===== 步骤4: HVAC =====
        var step4Params = stepObcDevice.buildStep4(point, calcResult, shared);
        allSteps.push(makeConfigPara(
            buildPointLabel(point, stepSeq++), 'OBC设备配置', 'OBCDeviceConfig', 'HVAC', step4Params
        ));

        // ===== 步骤5: 模拟电池 =====
        var step5Params = stepObcDevice.buildStep5(point, calcResult, shared);
        allSteps.push(makeConfigPara(
            buildPointLabel(point, stepSeq++), 'OBC设备配置', 'OBCDeviceConfig', '模拟电池', step5Params
        ));

        // ===== 步骤6: 负载 =====
        var step6Params = stepObcDevice.buildStep6(point, calcResult, shared);
        allSteps.push(makeConfigPara(
            buildPointLabel(point, stepSeq++), 'OBC设备配置', 'OBCDeviceConfig', '负载', step6Params
        ));

        // ===== 步骤7: 启机指令 =====
        var step7Params = stepProductConfig.buildStep7(point, calcResult, shared);
        allSteps.push(makeConfigPara(
            buildPointLabel(point, stepSeq++), '产品配置', 'ProductConfig', '启机指令', step7Params
        ));

        // ===== 步骤8: 关闭模拟电池（不消耗序号）=====
        var step8Params = stepObcDevice.buildStep8(point, calcResult, shared);
        allSteps.push(makeConfigPara(
            '', 'OBC设备配置', 'OBCDeviceConfig', '关闭模拟电池', step8Params
        ));

        if (pointIsThree) {
            // ===== 三相步骤9: 延时（不消耗序号）=====
            // 先算功率结果来获取 ioutMin
            var triResult = stepPowerResult.buildTriphasePowerResult(point, calcResult, shared);
            var threeResult = stepPowerResult.buildPowerResultThreePhase(point, calcResult, shared);
            calcResult.ioutMin = threeResult._ioutMin;

            var step9Params = stepDelay.buildStep9(point, calcResult, shared);
            allSteps.push(makeConfigPara(
                '', '延时配置', 'DelayConfig', '', step9Params
            ));

            // ===== 三相步骤10: TriphasePowerResult =====
            allSteps.push(makeConfigPara(
                buildPointLabel(point, stepSeq++), '功率结果', 'TriphasePowerResult', '', triResult
            ));

            // ===== 三相步骤11: PowerResult (ThreeMode=True) =====
            allSteps.push(makeConfigPara(
                buildPointLabel(point, stepSeq++), '功率结果', 'PowerResult', '', threeResult
            ));

            // ===== 三相步骤12: 停机指令 =====
            var step12Params = stepProductConfig.buildStep11(point, calcResult, shared);
            allSteps.push(makeConfigPara(
                buildPointLabel(point, stepSeq++), '产品配置', 'ProductConfig', '停机指令', step12Params
            ));

            // ===== 三相步骤13-16（不消耗序号）=====
            allSteps.push(makeConfigPara(
                '', 'OBC设备配置', 'OBCDeviceConfig', '降载',
                stepObcDevice.buildStep12(point, calcResult, shared)
            ));
            allSteps.push(makeConfigPara(
                '', 'OBC设备配置', 'OBCDeviceConfig', '关载',
                stepObcDevice.buildStep13(point, calcResult, shared)
            ));
            allSteps.push(makeConfigPara(
                '', 'OBC设备配置', 'OBCDeviceConfig', '关HVAC',
                stepObcDevice.buildStep14(point, calcResult, shared)
            ));
            allSteps.push(makeConfigPara(
                '', 'OBC设备配置', 'OBCDeviceConfig', '关辅电',
                stepObcDevice.buildStep15(point, calcResult, shared)
            ));

        } else {
            // ===== 单相步骤9: 延时（不消耗序号）=====
            // 先算功率结果来获取 ioutMin
            var singleResult = stepPowerResult.buildPowerResultSingle(point, calcResult, shared);
            calcResult.ioutMin = singleResult._ioutMin;

            var step9Params = stepDelay.buildStep9(point, calcResult, shared);
            allSteps.push(makeConfigPara(
                '', '延时配置', 'DelayConfig', '', step9Params
            ));

            // ===== 单相步骤10: PowerResult =====
            allSteps.push(makeConfigPara(
                buildPointLabel(point, stepSeq++), '功率结果', 'PowerResult', '', singleResult
            ));

            // ===== 单相步骤11: 停机指令 =====
            var step11Params = stepProductConfig.buildStep11(point, calcResult, shared);
            allSteps.push(makeConfigPara(
                buildPointLabel(point, stepSeq++), '产品配置', 'ProductConfig', '停机指令', step11Params
            ));

            // ===== 单相步骤12-15（不消耗序号）=====
            allSteps.push(makeConfigPara(
                '', 'OBC设备配置', 'OBCDeviceConfig', '降载',
                stepObcDevice.buildStep12(point, calcResult, shared)
            ));
            allSteps.push(makeConfigPara(
                '', 'OBC设备配置', 'OBCDeviceConfig', '关载',
                stepObcDevice.buildStep13(point, calcResult, shared)
            ));
            allSteps.push(makeConfigPara(
                '', 'OBC设备配置', 'OBCDeviceConfig', '关HVAC',
                stepObcDevice.buildStep14(point, calcResult, shared)
            ));
            allSteps.push(makeConfigPara(
                '', 'OBC设备配置', 'OBCDeviceConfig', '关辅电',
                stepObcDevice.buildStep15(point, calcResult, shared)
            ));
        }
    }

    return allSteps;
}

// ============================================================
// DCDC 步骤构建
// ============================================================

/**
 * DCDC点位信息标签
 */
function buildDcdcPointLabel(point, index) {
    var seq = index < 10 ? '0' + index : String(index);
    var inParts = [];
    if (point.vin) inParts.push(point.vin + 'V');
    if (point.iin) inParts.push(point.iin + 'A');

    var outParts = [];
    var oviParts = [];
    if (point.vout) oviParts.push(point.vout + 'V');
    if (point.iout) oviParts.push(point.iout + 'A');
    if (oviParts.length > 0) outParts.push(oviParts.join('/'));
    if (point.pout) outParts.push(formatPower(point.pout));

    var label = '';
    if (inParts.length > 0) label += inParts.join('/');
    if (outParts.length > 0) {
        if (label) label += '&';
        label += outParts.join('-');
    }
    label += '-' + seq;
    return label;
}

/**
 * 构建DCDC步骤（框架，待逐步填充映射）
 */
function buildDcdcSteps(points, ep, hasObc) {
    var allSteps = [];

    // 步骤0: OBC切换DCDC（仅跟OBC组合时才写）
    if (hasObc) {
        allSteps.push(makeConfigPara(
            'OBC切换DCDC', '测试类型切换', 'TestTypeChange', '',
            { LoadVoltMax: '16', TimeOut: '180000', AdjustTime: '500',
              EnableAcVolt: 'False', EnableTriphase: 'False' }
        ));
    }

    // 步骤1: DCDC量程设置（Ch3=输入侧, Ch4=输出侧）
    var VOLT_RANGES = [15, 30, 60, 100, 150, 300, 600, 1000];
    var CURR_RANGES = [0.5, 1, 2, 5, 10, 20, 40, 50];
    var dcdcMerged = { vin: 0, vout: 0, iout: 0, pout: 0, iin: 0 };
    for (var m = 0; m < points.length; m++) {
        var pt = points[m];
        if ((pt.vin || 0) > dcdcMerged.vin) dcdcMerged.vin = pt.vin;
        if ((pt.vout || 0) > dcdcMerged.vout) dcdcMerged.vout = pt.vout;
        if ((pt.pout || 0) > dcdcMerged.pout) dcdcMerged.pout = pt.pout;
        if ((pt.iin || 0) > dcdcMerged.iin) dcdcMerged.iin = pt.iin;
        var ptIout = pt.iout || 0;
        if ((!ptIout || ptIout <= 0) && (pt.vout || 0) > 0 && (pt.pout || 0) > 0) {
            ptIout = pt.pout / pt.vout;
        }
        if (ptIout > dcdcMerged.iout) dcdcMerged.iout = ptIout;
    }
    var dcdcEff = (ep && ep.efficiency) || 96;
    // 推算输入电流
    if ((!dcdcMerged.iin || dcdcMerged.iin <= 0) && dcdcMerged.vin > 0) {
        dcdcMerged.iin = calc.estimateInputCurrent(dcdcMerged.pout, dcdcEff, dcdcMerged.vin);
    }

    var dcdcRangeParams = {};
    dcdcRangeParams.LineFilteringChannel3 = '5.5kHz';
    dcdcRangeParams.LineFilteringChannel4 = '5.5kHz';
    dcdcRangeParams.VoltResponseSpeed = 'SLOW';
    dcdcRangeParams.LoadOperateMode = 'CCH';

    // Ch3: 输入侧量程
    // 量程裕量：电压+20%，电流+50%（小值精度高，大值包得住波动）
    if (dcdcMerged.vin > 0) {
        dcdcRangeParams.VoltRangeChannel3 = formatVoltRange(calc.calcRange(dcdcMerged.vin, dcdcMerged.vin * 0.2, VOLT_RANGES));
    }
    if (dcdcMerged.iin > 0) {
        dcdcRangeParams.CurrRangeChannel3 = formatCurrRange(calc.calcRange(dcdcMerged.iin, dcdcMerged.iin * 0.5, CURR_RANGES));
    }
    // Ch4: 输出侧量程
    if (dcdcMerged.vout > 0) {
        dcdcRangeParams.VoltRangeChannel4 = formatVoltRange(calc.calcRange(dcdcMerged.vout, dcdcMerged.vout * 0.2, VOLT_RANGES));
    }
    if (dcdcMerged.iout > 0) {
        dcdcRangeParams.CurrRangeChannel4 = formatCurrRange(calc.calcRange(dcdcMerged.iout, dcdcMerged.iout * 0.5, CURR_RANGES));
    }

    allSteps.push(makeConfigPara(
        '', '高级配置', 'PowerMeterAdvancedConfig', '', dcdcRangeParams
    ));

    // 各点位的DCDC步骤2-14
    for (var i = 0; i < points.length; i++) {
        var point = points[i];
        var stepSeq = 1;

        // 推算iout（多处用到）
        var dcdcIout = point.iout || 0;
        if ((!dcdcIout || dcdcIout <= 0) && (point.vout || 0) > 0 && (point.pout || 0) > 0) {
            dcdcIout = point.pout / point.vout;
        }

        var shared = Object.assign({}, ep, {
            _paramGroup: 'dcdc',
            kl30Volt: point.kl30 || 12
        });

        // ===== 步骤2: 辅电（序号1）=====
        var dcfg = advParams.get('dcdc');
        var dcdcStep2 = {};
        dcdcStep2.KL30Volt = String(shared.kl30Volt);
        dcdcStep2.LowVoltLimitCurr = '3';
        if (ep.dcOutPoint) dcdcStep2.DCOutPoint = ep.dcOutPoint;
        if (ep.kl15Option) dcdcStep2.EnableKL15 = ep.kl15Option;
        dcdcStep2.MachineTriggerCondition1 = '＞';
        dcdcStep2.Delay = String(dcfg.delay);
        allSteps.push(makeConfigPara(
            buildDcdcPointLabel(point, stepSeq++), 'DCDC设备配置', 'DCDCDeviceConfig', '辅电', dcdcStep2
        ));

        // ===== 步骤3: 唤醒（可选，不消耗序号）=====
        if (ep.includeWake) {
            allSteps.push(makeConfigPara(
                '', '产品配置', 'ProductConfig', '唤醒',
                { SendControl: '启动发送', Delay: String(dcfg.delay) }
            ));
        }

        // ===== 步骤4: HVDC（序号2）=====
        var dcdcStep4 = {};
        dcdcStep4.HvVolt = String(point.vin || 0);
        dcdcStep4.DcInputLimitCurr = String(dcfg.dcInputLimitCurr);
        dcdcStep4.MachineTriggerCondition1 = '＞';
        dcdcStep4.Delay = String(dcfg.delay);
        allSteps.push(makeConfigPara(
            buildDcdcPointLabel(point, stepSeq++), 'DCDC设备配置', 'DCDCDeviceConfig', 'HVDC', dcdcStep4
        ));

        // ===== 步骤5: 启机指令（序号3）=====
        allSteps.push(makeConfigPara(
            buildDcdcPointLabel(point, stepSeq++), '产品配置', 'ProductConfig', '启机指令',
            { SendControl: '启动发送', Delay: String(dcfg.delay) }
        ));

        // ===== 步骤6: 预拉载（序号4）=====
        var dcdcPreloadValue = '2';
        var dcdcStep6 = {};
        dcdcStep6.LoadValue = dcdcPreloadValue;
        dcdcStep6.LoadMode = 'CC';
        dcdcStep6.LoadControlWay = '开';
        if (ep.dcOutSwitchRelay) {
            dcdcStep6.DCOutSwitchRelay = ep.dcOutSwitchRelay;
            dcdcStep6.DCOutRelay = '关';
        }
        dcdcStep6.MachineTriggerCondition1 = '＞';
        dcdcStep6.Delay = String(dcfg.delay);
        allSteps.push(makeConfigPara(
            buildDcdcPointLabel(point, stepSeq++), 'DCDC设备配置', 'DCDCDeviceConfig', '预拉载', dcdcStep6
        ));

        // ===== 步骤7: 拉载（序号5）=====
        var dcdcStep7 = {};
        dcdcStep7.LoadValue = dcdcPreloadValue;
        dcdcStep7.LoadMode = 'CC';
        dcdcStep7.LoadControlWay = '开';
        dcdcStep7.LoadLoop = 'True';
        if (dcdcIout > 0) dcdcStep7.LoadEndValue = String(r2(dcdcIout));
        dcdcStep7.LoadStepValue = String(ep.loadStepValue || 10);
        dcdcStep7.LoadAdjustTime = '500';
        dcdcStep7.DCOutPoint = '断开';
        dcdcStep7.Delay = String(dcfg.delay);
        allSteps.push(makeConfigPara(
            buildDcdcPointLabel(point, stepSeq++), 'DCDC设备配置', 'DCDCDeviceConfig', '拉载', dcdcStep7
        ));

        // ===== 步骤8: 延时（不消耗序号）=====
        var dcdcResult = stepPowerResult.buildDcdcPowerResult(point, {}, shared);
        var dcdcCalcResult = { ioutMin: dcdcResult._ioutMin };

        var dcdcStep8 = {};
        dcdcStep8.Delay = String(dcfg.delay);
        dcdcStep8.EnableTrigger = 'True';
        dcdcStep8.AdjustTime = String(dcfg.adjustTime);
        dcdcStep8.TriggerTimeOut = String(dcfg.triggerTimeOut);
        dcdcStep8.EnableOBCTrigger = 'True';
        dcdcStep8.MachineTrigger1 = '输出电流';
        dcdcStep8.MachineTriggerCondition1 = '＞';
        dcdcStep8.MachineTriggerValue1 = String(r2(Math.max(0, dcdcIout - 15)));
        dcdcStep8.EnableJudgeStability = 'False';
        dcdcStep8.MachineSampleRelationship = '不操作';
        dcdcStep8.SampleOBCInVolt = 'False';
        dcdcStep8.SampleOBCInCurr = 'False';
        dcdcStep8.SampleOBCOutVolt = 'False';
        dcdcStep8.SampleOBCOutCurr = 'False';
        dcdcStep8.SampleDCDCInVolt = 'False';
        dcdcStep8.SampleDCDCInCurr = 'False';
        dcdcStep8.SampleDCDCOutVolt = 'False';
        dcdcStep8.SampleDCDCOutCurr = 'False';
        allSteps.push(makeConfigPara(
            '', '延时配置', 'DelayConfig', '', dcdcStep8
        ));

        // ===== 步骤9: 功率结果（序号6）=====
        allSteps.push(makeConfigPara(
            buildDcdcPointLabel(point, stepSeq++), '功率结果', 'PowerResult', '', dcdcResult
        ));

        // ===== 步骤10: 降载（序号7）=====
        var dcdcStep10 = {};
        if (dcdcIout > 0) dcdcStep10.LoadValue = String(r2(dcdcIout));
        dcdcStep10.LoadMode = 'CC';
        dcdcStep10.LoadControlWay = '开';
        dcdcStep10.LoadLoop = 'True';
        dcdcStep10.LoadEndValue = '0';
        dcdcStep10.LoadStepValue = '10';
        dcdcStep10.LoadAdjustTime = '300';
        dcdcStep10.Delay = String(dcfg.delay);
        allSteps.push(makeConfigPara(
            buildDcdcPointLabel(point, stepSeq++), 'DCDC设备配置', 'DCDCDeviceConfig', '降载', dcdcStep10
        ));

        // ===== 步骤11: 关载（序号8）=====
        var dcdcStep11 = {};
        dcdcStep11.LoadMode = 'CC';
        dcdcStep11.LoadControlWay = '关';
        if (ep.dcOutSwitchRelay) dcdcStep11.DCOutSwitchRelay = '关';
        dcdcStep11.Delay = String(dcfg.delay);
        allSteps.push(makeConfigPara(
            buildDcdcPointLabel(point, stepSeq++), 'DCDC设备配置', 'DCDCDeviceConfig', '关载', dcdcStep11
        ));

        // ===== 步骤12: 停机指令（不消耗序号）=====
        allSteps.push(makeConfigPara(
            '', '产品配置', 'ProductConfig', '停机指令',
            { SendControl: '启动发送', Delay: String(dcfg.delay) }
        ));

        // ===== 步骤13: 关HVDC（不消耗序号）=====
        allSteps.push(makeConfigPara(
            '', 'DCDC设备配置', 'DCDCDeviceConfig', '关HVDC',
            { HvVolt: '0', DcInputLimitCurr: '0', Delay: String(dcfg.delay) }
        ));

        // ===== 步骤14: 关辅电（不消耗序号）=====
        var dcdcStep14 = {};
        dcdcStep14.KL30Volt = '0';
        dcdcStep14.LowVoltLimitCurr = '0';
        if (ep.kl15Option) dcdcStep14.EnableKL15 = '关闭';
        if (ep.dcOutPoint) dcdcStep14.DCOutPoint = '断开';
        dcdcStep14.Delay = String(dcfg.delay);
        allSteps.push(makeConfigPara(
            '', 'DCDC设备配置', 'DCDCDeviceConfig', '关辅电', dcdcStep14
        ));
    }

    return allSteps;
}

// ============================================================
// 逆变步骤构建（14步）
// ============================================================

/**
 * 截断到小数点后1位（不四舍五入）
 */
function trunc1(v) {
    return Math.floor(v * 10) / 10;
}

/**
 * 逆差点位信息标签
 */
function buildInvertPointLabel(point, index) {
    var seq = index < 10 ? '0' + index : String(index);
    var inParts = [];
    if (point.vin) inParts.push(point.vin + 'V');
    var outParts = [];
    var oviParts = [];
    if (point.vout) oviParts.push(point.vout + 'V');
    if (point.iout) oviParts.push(point.iout + 'A');
    if (oviParts.length > 0) outParts.push(oviParts.join('/'));
    if (point.pout) outParts.push(formatPower(point.pout));

    var label = '';
    if (inParts.length > 0) label += inParts.join('/');
    if (outParts.length > 0) {
        if (label) label += '&';
        label += outParts.join('-');
    }
    label += '-' + seq;
    return label;
}

/**
 * 构建逆变步骤（14步）
 * @param {Array} points - 逆差点位数组
 * @param {object} ep - 逆变误差参数
 * @returns {Array} ConfigPara 数组
 */
function buildInvertSteps(points, ep) {
    var allSteps = [];
    var VOLT_RANGES = [15, 30, 60, 100, 150, 300, 600, 1000];
    var CURR_RANGES = [0.5, 1, 2, 5, 10, 20, 40, 50];
    var loadMode = ep.loadMode || 'CR';
    var eff = ep.efficiency || 94;

    // ===== 步骤0: 全局量程设置 =====
    var merged = { vin: 0, vout: 0, iout: 0, pout: 0 };
    for (var m = 0; m < points.length; m++) {
        var pt = points[m];
        if ((pt.vin || 0) > merged.vin) merged.vin = pt.vin;
        if ((pt.vout || 0) > merged.vout) merged.vout = pt.vout;
        if ((pt.iout || 0) > merged.iout) merged.iout = pt.iout;
        if ((pt.pout || 0) > merged.pout) merged.pout = pt.pout;
    }
    // 推算最大输入电流
    var maxIin = 0;
    if (merged.vin > 0 && eff > 0) {
        maxIin = merged.pout / (eff / 100) / merged.vin;
    }

    var rangeParams = {};
    rangeParams.LineFilteringChannel1 = '5.5kHz';
    rangeParams.LineFilteringChannel2 = '5.5kHz';
    rangeParams.VoltResponseSpeed = 'SLOW';
    rangeParams.MultiMeterRange = '0';
    // Ch1 = 逆变输出电压量程（=OBC输入电压量程）
    // 量程裕量：电压+20%，电流+50%（小值精度高，大值包得住波动）
    if (merged.vout > 0) {
        rangeParams.VoltRangeChannel1 = formatVoltRange(calc.calcRange(merged.vout, merged.vout * 0.2, VOLT_RANGES));
    }
    // Ch2 = 逆变输入电压量程（=OBC输出电压量程）
    if (merged.vin > 0) {
        rangeParams.VoltRangeChannel2 = formatVoltRange(calc.calcRange(merged.vin, merged.vin * 0.2, VOLT_RANGES));
    }
    // Curr1 = 逆变输出电流量程
    if (merged.iout > 0) {
        rangeParams.CurrRangeChannel1 = formatCurrRange(calc.calcRange(merged.iout, merged.iout * 0.5, CURR_RANGES));
    }
    // Curr2 = 逆变输入电流量程
    if (maxIin > 0) {
        rangeParams.CurrRangeChannel2 = formatCurrRange(calc.calcRange(maxIin, maxIin * 0.5, CURR_RANGES));
    }
    allSteps.push(makeConfigPara('', '高级配置', 'PowerMeterAdvancedConfig', '', rangeParams));

    // ===== 各点位步骤1-13 =====
    for (var i = 0; i < points.length; i++) {
        var point = points[i];
        var stepSeq = 1;
        var pVout = point.vout || 0;
        var pIout = point.iout || 0;
        var pVin = point.vin || 0;
        var pPout = point.pout || 0;

        var shared = Object.assign({}, ep, { _paramGroup: 'invert', efficiency: eff });

        // ===== 步骤1: 辅电（序号1）=====
        var icfg = advParams.get('invert');
        var step1 = {};
        step1.InvertMode = '单相模式';
        step1.KL30Volt = String(point.kl30 || 14);
        step1.LowVoltLimitCurr = '3';
        if (ep.dcOutPoint) step1.DCOutPoint = ep.dcOutPoint;
        step1.CcCpControl = '功能输出';
        step1.CCSetValueResistance = String(ep.ccResistance || icfg.ccResistance);
        step1.MachineTriggerCondition1 = '＞';
        step1.Delay = String(icfg.delay);
        allSteps.push(makeConfigPara(
            buildInvertPointLabel(point, stepSeq++), '逆变设备配置', 'InvertDeviceConfig', '辅电', step1
        ));

        // ===== 步骤2: 唤醒（可选，不消耗序号）=====
        if (ep.includeWake) {
            allSteps.push(makeConfigPara(
                '', '产品配置', 'ProductConfig', '唤醒',
                { SendControl: '启动发送', Delay: String(icfg.delay) }
            ));
        }

        // ===== 步骤3: HVDC（序号2）=====
        var step3 = {};
        step3.InvertMode = '不操作';
        step3.HvVolt = String(pVin);
        step3.DcInputLimitCurr = '20';
        step3.MachineTriggerCondition1 = '＞';
        step3.Delay = String(icfg.delay);
        allSteps.push(makeConfigPara(
            buildInvertPointLabel(point, stepSeq++), '逆变设备配置', 'InvertDeviceConfig', 'HVDC', step3
        ));

        // ===== 步骤4: 启机指令（序号3）=====
        allSteps.push(makeConfigPara(
            buildInvertPointLabel(point, stepSeq++), '产品配置', 'ProductConfig', '启机指令',
            { SendControl: '启动发送', Delay: String(icfg.delay) }
        ));

        // ===== LoadValue 计算（步骤5/6/9共用）=====
        var preloadValue = loadMode === 'CR' ? trunc1(pVout / 5) : 5;
        var loadEndValue = loadMode === 'CR' ? trunc1(pVout / pIout) : pIout;
        var unloadEndValue = loadMode === 'CR' ? trunc1(pVout / 1) : 1;

        // ===== 步骤5: 预拉载（序号4）=====
        var step5 = {};
        step5.InvertMode = '不操作';
        step5.LoadValue = String(preloadValue);
        step5.LoadMode = loadMode;
        step5.LoadControlWay = '开';
        step5.MachineTriggerCondition1 = '＞';
        step5.Delay = String(icfg.delay);
        allSteps.push(makeConfigPara(
            buildInvertPointLabel(point, stepSeq++), '逆变设备配置', 'InvertDeviceConfig', '预拉载', step5
        ));

        // ===== 步骤6: 拉载（序号5）=====
        var step6 = {};
        step6.InvertMode = '不操作';
        step6.LoadValue = String(preloadValue);
        step6.LoadMode = loadMode;
        step6.LoadControlWay = '开';
        step6.LoadLoop = 'True';
        step6.LoadEndValue = String(loadEndValue);
        step6.LoadStepValue = '1';
        step6.LoadAdjustTime = '300';
        step6.MachineTriggerCondition1 = '＞';
        step6.Delay = String(icfg.delay);
        allSteps.push(makeConfigPara(
            buildInvertPointLabel(point, stepSeq++), '逆变设备配置', 'InvertDeviceConfig', '拉载', step6
        ));

        // ===== 步骤7: 延时（不消耗序号）=====
        var invertResult = stepPowerResult.buildInvertPowerResult(point, {}, shared);
        var ioutMin = invertResult._ioutMin;

        var step7 = {};
        step7.Delay = String(icfg.delay);
        step7.EnableTrigger = 'True';
        step7.AdjustTime = String(icfg.adjustTime);
        step7.TriggerTimeOut = String(icfg.triggerTimeOut);
        step7.EnableOBCTrigger = 'True';
        step7.MachineTrigger1 = '输出电流';
        step7.MachineTriggerCondition1 = '＞';
        step7.MachineTriggerValue1 = String(r2(Math.max(0, ioutMin - 1)));
        step7.EnableJudgeStability = 'False';
        step7.MachineSampleRelationship = '不操作';
        step7.SampleOBCInVolt = 'False';
        step7.SampleOBCInCurr = 'False';
        step7.SampleOBCOutVolt = 'False';
        step7.SampleOBCOutCurr = 'False';
        step7.SampleDCDCInVolt = 'False';
        step7.SampleDCDCInCurr = 'False';
        step7.SampleDCDCOutVolt = 'False';
        step7.SampleDCDCOutCurr = 'False';
        allSteps.push(makeConfigPara(
            '', '延时配置', 'DelayConfig', '', step7
        ));

        // ===== 步骤8: 功率结果（序号6）=====
        allSteps.push(makeConfigPara(
            buildInvertPointLabel(point, stepSeq++), '功率结果', 'PowerResult', '', invertResult
        ));

        // ===== 步骤9: 降载（序号7）=====
        var step9 = {};
        step9.InvertMode = '不操作';
        step9.LoadValue = String(loadEndValue);
        step9.LoadMode = loadMode;
        step9.LoadControlWay = '开';
        step9.LoadLoop = 'True';
        step9.LoadEndValue = String(unloadEndValue);
        step9.LoadStepValue = '3';
        step9.LoadAdjustTime = '300';
        step9.MachineTriggerCondition1 = '＞';
        step9.Delay = String(icfg.delay);
        allSteps.push(makeConfigPara(
            buildInvertPointLabel(point, stepSeq++), '逆变设备配置', 'InvertDeviceConfig', '降载', step9
        ));

        // ===== 步骤10: 关载（序号8）=====
        var step10 = {};
        step10.InvertMode = '不操作';
        step10.LoadMode = loadMode;
        step10.LoadControlWay = '关';
        step10.MachineTriggerCondition1 = '＞';
        step10.Delay = String(icfg.delay);
        allSteps.push(makeConfigPara(
            buildInvertPointLabel(point, stepSeq++), '逆变设备配置', 'InvertDeviceConfig', '关载', step10
        ));

        // ===== 步骤11: 停机指令（不消耗序号）=====
        allSteps.push(makeConfigPara(
            '', '产品配置', 'ProductConfig', '停机指令',
            { SendControl: '启动发送', Delay: String(icfg.delay) }
        ));

        // ===== 步骤12: 关HVDC（不消耗序号）=====
        allSteps.push(makeConfigPara(
            '', '逆变设备配置', 'InvertDeviceConfig', '关HVDC',
            { InvertMode: '不操作', HvVolt: '0', DcInputLimitCurr: '0', MachineTriggerCondition1: '＞', Delay: String(icfg.delay) }
        ));

        // ===== 步骤13: 关辅电（不消耗序号）=====
        var step13 = {};
        step13.InvertMode = '不操作';
        step13.KL30Volt = '0';
        step13.LowVoltLimitCurr = '0';
        if (ep.dcOutPoint) step13.DCOutPoint = '断开';
        step13.MachineTriggerCondition1 = '＞';
        step13.Delay = String(icfg.delay);
        allSteps.push(makeConfigPara(
            '', '逆变设备配置', 'InvertDeviceConfig', '关辅电', step13
        ));
    }

    return allSteps;
}

/**
 * 创建一个 ConfigPara 对象
 */
function makeConfigPara(testItem, templetName, templetType, funcDesc, params) {
    return {
        Finally: false,
        TestItem: testItem || '',
        TempletName: templetName,
        TempletType: templetType,
        FuncDesc: funcDesc || null,
        TempletValue: encodeTempletValue(params),
        BlackList: false
    };
}

/**
 * 从 ConfigPara 数组构建完整的 CFG666 JSON 对象
 * @param {Array} configParas
 * @param {string} configName
 * @returns {object}
 */
function buildCFG666(configParas, configName) {
    return {
        ConfigName: configName || '',
        ConfigVersion: '',
        LineNumber: configParas.length,
        ProductLineCheck: false,
        ShowFailPassTip: false,
        ReTestTimes: 0,
        AllowReTestTimes: 0,
        BoardNumber: 1,
        ConfigPara: configParas
    };
}

export { buildAllSteps, buildCFG666, encodeTempletValue };
