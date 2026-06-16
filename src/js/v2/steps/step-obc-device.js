/**
 * OBC设备配置步骤 (OBCDeviceConfig)
 *
 * 涵盖步骤: 2(上辅电), 4(HVAC), 5(模拟电池), 6(负载),
 *           8(关模拟电池), 12(降载), 13(关载), 14(关HVAC), 15(关辅电)
 *
 * 三相模式下步骤编号+1（降载=13, 关载=14, 关HVAC=15, 关辅电=16）
 *
 * 函数签名: buildStep{N}(pointData, calcResult, sharedParams)
 * 返回 plain JS 对象，后续由 step-builder 组装成 ConfigPara
 */

import * as params from '../config/default-params.js';

// ===== 步骤2: 上辅电 =====

/**
 * @param {object} pointData - {vin, vout, iout, pout}
 * @param {object} calcResult - 计算器结果（本步骤不需要）
 * @param {object} sharedParams - {kl30Volt, lowVoltLimitCurr, dcOutPoint}
 *   kl30Volt: 用户填写的KL30电压，不填时不写这个字段
 *   dcOutPoint: 用户填写的DCOutPoint，不填时不写这个字段
 */
function buildStep2(pointData, calcResult, sharedParams) {
    var cfg = params.get('obc');
    var p = sharedParams || {};
    var result = {};

    // KL30电压：用户提供了就写，否则用配置中的默认值
    if (p.kl30Volt != null) {
        result.KL30Volt = String(p.kl30Volt);
    } else {
        result.KL30Volt = String(cfg.kl30Volt);
    }

    result.LowVoltLimitCurr = String(cfg.lowVoltLimitCurr);

    // DCOutPoint：用户提供了就写，否则不写（让项目工具默认）
    if (p.dcOutPoint) {
        result.DCOutPoint = p.dcOutPoint;
    }

    // EnableKL15：用户选了打开就写，否则不写
    if (p.kl15Option) {
        result.EnableKL15 = p.kl15Option;
    }

    result.CcCpControl = '功能输出';
    result.CCSetValueResistance = String(cfg.ccResistance);
    result.CPSetValuePercent = String(cfg.cpPercent);

    result.MachineTriggerCondition1 = '＞';
    result.Delay = String(cfg.delay);

    return result;
}

// ===== 步骤4: HVAC =====

/**
 * @param {object} pointData - {vin, ...}
 * @param {object} sharedParams - {freq, acInputMode, vinType}
 */
function buildStep4(pointData, calcResult, sharedParams) {
    var cfg = params.get('obc');
    var p = sharedParams || {};
    var result = {};

    // 三相时AcVolt用相电压，单相时直接用vin
    var vin = pointData.vin || 0;
    var acVolt = vin;
    if (p.acInputMode === '三相模式' && vin > 0) {
        if (p.vinType === 'phase') {
            acVolt = vin; // 用户给的就是相电压
        } else {
            acVolt = Math.round(vin / Math.sqrt(3)); // 线电压→相电压
        }
    }
    result.AcVolt = String(acVolt);
    result.InputFrequency = String(p.freq || 50);
    result.AcInputMode = p.acInputMode || '单相模式';

    result.MachineTriggerCondition1 = '＞';
    result.Delay = String(cfg.delay);

    return result;
}

// ===== 步骤5: 模拟电池 =====

function buildStep5(pointData, calcResult, sharedParams) {
    var cfg = params.get('obc');
    var result = {};

    result.VBatVolt = String((pointData.vout || 0) + 3);
    result.VBatLimitCurr = String(cfg.vbatLimitCurr);
    result.VBatControlWay = '开';

    result.MachineTriggerCondition1 = '＞';
    result.Delay = String(cfg.delay);

    return result;
}

// ===== 步骤6: 负载 =====

function buildStep6(pointData, calcResult, sharedParams) {
    var cfg = params.get('obc');
    var result = {};

    result.LoadValue = String(pointData.vout || 0);
    result.LoadMode = 'CV';
    result.LoadControlWay = '开';

    // 产品触发：触发阈值 = 输出电压 - 配置的偏移量
    result.EnableTrigger = 'True';
    result.TriggerTimeOut = String(cfg.triggerTimeOut);
    result.TriggerAdjustTime = '180000';
    result.MachineTrigger1 = '输出电压';
    result.MachineTriggerCondition1 = '＞';
    result.MachineTriggerValue1 = String((pointData.vout || 0) - cfg.loadTriggerOffset);

    result.Delay = String(cfg.delay);

    return result;
}

// ===== 步骤8: 关闭模拟电池 =====

function buildStep8(pointData, calcResult, sharedParams) {
    var cfg = params.get('obc');
    return {
        VBatControlWay: '关',
        MachineTriggerCondition1: '＞',
        Delay: String(cfg.delay)
    };
}

// ===== 步骤12: 降载 =====

function buildStep12(pointData, calcResult, sharedParams) {
    var cfg = params.get('obc');
    var result = {};

    result.LoadValue = String(pointData.vout || 0);
    result.LoadMode = 'CV';
    result.LoadControlWay = '开';
    result.LoadLoop = 'True';
    result.LoadEndValue = '3';
    result.LoadStepValue = '10';
    result.LoadAdjustTime = '300';

    result.MachineTriggerCondition1 = '＞';
    result.Delay = String(cfg.delay);

    return result;
}

// ===== 步骤13: 关载 =====

function buildStep13(pointData, calcResult, sharedParams) {
    var cfg = params.get('obc');
    return {
        LoadValue: '0',
        LoadMode: 'CV',
        LoadControlWay: '关',
        MachineTriggerCondition1: '＞',
        Delay: String(cfg.delay)
    };
}

// ===== 步骤14: 关HVAC =====

function buildStep14(pointData, calcResult, sharedParams) {
    var cfg = params.get('obc');
    var result = {};
    result.AcVolt = '0';
    result.InputFrequency = '0';
    result.AcInputMode = (sharedParams && sharedParams.acInputMode) || '单相模式';
    result.MachineTriggerCondition1 = '＞';
    result.Delay = String(cfg.delay);
    return result;
}

// ===== 步骤15: 关辅电 =====

function buildStep15(pointData, calcResult, sharedParams) {
    var cfg = params.get('obc');
    var result = {};
    result.KL30Volt = '0';
    result.LowVoltLimitCurr = '0';
    var dcOutPoint = (sharedParams && sharedParams.dcOutPoint) || '';
    if (dcOutPoint === '连接') {
        result.DCOutPoint = '断开';
    }
    var kl15Option = (sharedParams && sharedParams.kl15Option) || '';
    if (kl15Option === '打开') {
        result.EnableKL15 = '关闭';
    }
    result.MachineTriggerCondition1 = '＞';
    result.Delay = String(cfg.delay);
    return result;
}

// ===== 步骤编号映射 =====

/**
 * 获取步骤编号到构建函数的映射
 * 单相15步，三相16步（步骤10后插入TriphasePowerResult，后续+1偏移）
 * @param {string} mode - 'obc-single' 或 'obc-three'
 * @returns {Array<{step: number, name: string, type: string, funcDesc: string, buildFn: Function}>}
 */
function getStepList(mode) {
    var isThree = mode === 'obc-three';

    var steps = [
        { step: 1,  name: '量程设置',  type: 'PowerMeterAdvancedConfig', funcDesc: '',    buildFn: null },
        { step: 2,  name: '上辅电',    type: 'OBCDeviceConfig',           funcDesc: '上辅电', buildFn: buildStep2 },
        // 步骤3（唤醒）由 step-product-config.js 处理，可选
        { step: 4,  name: 'HVAC',      type: 'OBCDeviceConfig',           funcDesc: 'HVAC',   buildFn: buildStep4 },
        { step: 5,  name: '模拟电池',  type: 'OBCDeviceConfig',           funcDesc: '模拟电池', buildFn: buildStep5 },
        { step: 6,  name: '负载',      type: 'OBCDeviceConfig',           funcDesc: '负载',   buildFn: buildStep6 },
        // 步骤7（启机）由 step-product-config.js 处理
        { step: 8,  name: '关闭模拟电池', type: 'OBCDeviceConfig',        funcDesc: '关闭模拟电池', buildFn: buildStep8 },
        // 步骤9（延时）由 step-delay.js 处理
        // 步骤10（功率结果）由 step-power-result.js 处理
        // 步骤11（停机）由 step-product-config.js 处理
    ];

    // 后续步骤：单相和三相编号不同
    var baseStep = isThree ? 13 : 12;
    steps.push({ step: baseStep,     name: '降载',    type: 'OBCDeviceConfig', funcDesc: '降载',   buildFn: buildStep12 });
    steps.push({ step: baseStep + 1, name: '关载',    type: 'OBCDeviceConfig', funcDesc: '关载',   buildFn: buildStep13 });
    steps.push({ step: baseStep + 2, name: '关HVAC',  type: 'OBCDeviceConfig', funcDesc: '关HVAC', buildFn: buildStep14 });
    steps.push({ step: baseStep + 3, name: '关辅电',  type: 'OBCDeviceConfig', funcDesc: '关辅电', buildFn: buildStep15 });

    return steps;
}

export { buildStep2, buildStep4, buildStep5, buildStep6, buildStep8, buildStep12, buildStep13, buildStep14, buildStep15, getStepList };
