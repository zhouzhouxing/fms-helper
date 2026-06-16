/**
 * V2 脚本生成器 - 核心计算引擎
 *
 * 纯数学函数模块，零DOM依赖，零npm包依赖。
 * 负责所有FMS测试脚本中的数学计算逻辑：
 * 量程选择、相电压换算、电流推算、误差模式决策等。
 *
 * 使用方式（CommonJS）:
 *   const { calcRange, calcPhaseVoltage } = require('./v2/calculator.js');
 *   const range = calcRange(220, 20, [150, 300, 600, 1000]);
 */

// ─── 通用工具 ────────────────────────────────────────────

/**
 * 保留2位小数（四舍五入）
 * 用 Math.round 避免浮点数精度问题
 * 比如 47.3 * 0.95 = 44.935 → 44.94（而非 44.93）
 */
function round2(value) {
    // 保留2位小数（四舍五入）
    // 注意：step-builder.js 和 step-power-result.js 里也有同功能的 r2() 函数
    // 如果将来要改精度（比如保留3位），三个地方都要一起改
    return Math.round(value * 100) / 100;
}

// ─── 公开函数 ────────────────────────────────────────────

/**
 * 1. 量程选择
 *
 * 根据实际测量值 + 安全余量，从候选量程列表中选出合适的档位。
 *
 * 规则：
 *   - 在 rangeList 中找第一个 ≥ (actualValue + margin) 的档位
 *   - 如果 (actualValue + margin) 超过最大档位 → 返回 '自动'
 *
 * 类比：买鞋要留一指宽余量。脚长230mm+余量15mm=245mm，
 * 鞋码表[240,245,250...] → 选245。如果脚长+余量超过最大码 → 不够穿，得定制（自动）。
 *
 * @param {number} actualValue - 实际测量值（如220V）
 * @param {number} margin       - 安全余量（如20V，表示需要留20V缓冲）
 * @param {number[]} rangeList  - 候选量程列表，必须从小到大排序
 * @returns {number|string} 选中的量程档位值，或 '自动'（超出最大量程）
 */
function calcRange(actualValue, margin, rangeList) {
    // 目标值 = 实际值 + 余量
    const target = actualValue + margin;

    // 在量程列表中找第一个 ≥ 目标值的档位
    for (let i = 0; i < rangeList.length; i++) {
        if (rangeList[i] >= target) {
            return rangeList[i];
        }
    }

    // 目标值超过所有档位 → 无法覆盖，返回自动量程
    return '自动';
}

/**
 * 2. 三相相电压计算
 *
 * 三相交流电中，线电压 ÷ √3 = 相电压。
 * 例如三相380V系统，相电压 ≈ 380 ÷ 1.732 ≈ 219.4 → 四舍五入得 219V。
 *
 * 类比：三根水管共用一个水源，每根管子的实际水压（相电压）=
 * 总管水压（线电压）÷ √3。√3 ≈ 1.732 是因为三相之间相位差120°。
 *
 * @param {number} lineVoltage - 线电压（如380表示380V）
 * @returns {number} 相电压，四舍五入取整
 */
function calcPhaseVoltage(lineVoltage) {
    return Math.round(lineVoltage / Math.sqrt(3));
}

/**
 * 3. 三相每相电流计算
 *
 * 已知总功率、效率和相电压，算出每条相线上流过的电流。
 *
 * 公式推导（一步一步来）：
 *   输入功率 = 总功率 ÷ 效率（因为电源有损耗）
 *   每相功率 = 输入功率 ÷ 3（三相均分）
 *   每相电流 = 每相功率 ÷ 相电压
 *   合并：每相电流 = (Pout ÷ efficiency ÷ 3) ÷ 相电压
 *
 * 类比：公司总共要发10000元奖金（Pout），但财务扣了4%手续费（效率96%），
 * 实际要准备10000÷0.96≈10417元。三个部门平分各3472元。
 * 每个部门按人数（相电压）算每人拿多少 → 就是每相电流。
 *
 * @param {number} totalPower   - 总输出功率（W）
 * @param {number} efficiency   - 效率百分比（如96表示96%，不是0.96）
 * @param {number} phaseVoltage - 相电压（V）
 * @returns {number} 每相电流（A），保留2位小数
 */
function calcThreePhaseCurrent(totalPower, efficiency, phaseVoltage) {
    // 效率从百分比转为小数（96 → 0.96）
    const efficiencyDecimal = efficiency / 100;

    // 防止除以零
    if (efficiencyDecimal === 0 || phaseVoltage === 0) {
        return 0;
    }

    const inputPower = totalPower / efficiencyDecimal;      // 输入总功率
    const perPhasePower = inputPower / 3;                    // 每相功率
    const perPhaseCurrent = perPhasePower / phaseVoltage;    // 每相电流

    return round2(perPhaseCurrent);
}

/**
 * 4. 计算 Min / Max 上下限
 *
 * V2版本使用绝对误差（与V1的百分比误差不同）。
 * Min = 基准值 − 误差值
 * Max = 基准值 + 误差值
 *
 * 举例：基准值 220V，误差 ±5V → min=215, max=225
 *
 * @param {number} value - 基准值
 * @param {number} error - 误差值（绝对值，如5表示±5）
 * @returns {{ min: number, max: number }} 上下限
 */
function calcMinMax(value, error) {
    return {
        min: round2(value - error),
        max: round2(value + error)
    };
}

/**
 * 5. 输出电压误差模式决策
 *
 * 根据输出电压大小，自动决定用哪种误差描述方式。
 *
 * 规则：
 *   - Vout × 1% > 5V → 电压较大，用精度百分比（Accuracy）
 *   - 否则 → 电压较小，用固定偏置（Offset），即 ±5V
 *
 * 类比：称体重。如果你100kg，秤误差1%就是±1kg，够用了。
 * 但如果你只5kg（小孩），1%才±0.05kg没意义，
 * 不如直接说"误差±0.5kg"更实用。这里的5V就是那个"最小有意义误差"。
 *
 * @param {number} vout - 输出电压（V）
 * @returns {{ type: 'offset'|'accuracy', value: number }}
 *   - type='accuracy': value=1（表示1%精度）
 *   - type='offset':   value=5（表示±5V偏置）
 */
function decideVoltageErrorMode(vout) {
    // Vout × 1% 是否大于 5V 阈值
    const onePercentOfVout = vout * 0.01;

    if (onePercentOfVout > 5) {
        // 电压较大，1%精度已经超过5V → 用百分比
        return { type: 'accuracy', value: 1 };
    } else {
        // 电压较小，1%不够用 → 用固定±5V
        return { type: 'offset', value: 5 };
    }
}

/**
 * 6. 输出电流误差模式决策
 *
 * 根据输出电流大小，自动决定用哪种误差描述方式。
 *
 * 规则：
 *   - Iout > 10A → 电流较大，用精度百分比（Accuracy）
 *   - 否则 → 电流较小，用绝对值（Offset）
 *
 * 参数 errorValue 是用户输入的误差值：
 *   - 当电流大时，errorValue 被当作百分比（如2表示±2%）
 *   - 当电流小时，errorValue 被当作绝对值（如0.1表示±0.1A）
 *
 * @param {number} iout       - 输出电流（A）
 * @param {number} errorValue - 用户输入的误差值（可能是百分比也可能是绝对值，取决于决策结果）
 * @returns {{ type: 'offset'|'accuracy', value: number }}
 *   - type='accuracy': value=误差百分比（用户输入）
 *   - type='offset':   value=误差绝对值（用户输入）
 */
function decideCurrentErrorMode(iout, errorValue) {
    if (iout > 10) {
        // 电流 > 10A，用精度百分比
        return { type: 'accuracy', value: errorValue };
    } else {
        // 电流 ≤ 10A，用绝对值
        return { type: 'offset', value: errorValue };
    }
}

/**
 * 7. 输入电流推算
 *
 * 根据输出功率、效率和输入电压，反推输入端的电流。
 *
 * 公式：Iin = (Pout ÷ 效率) ÷ Vin
 *
 * 为什么需要这个？测试电源时，需要知道输入端会拉多大电流，
 * 以选择合适的输入线缆和保险丝规格。
 *
 * 类比：电热水器输出2kW热量，但效率90%，实际从电网拉2÷0.9≈2.22kW。
 * 如果电网电压220V，电流就是2220÷220≈10.09A。
 *
 * @param {number} pout       - 输出功率（W）
 * @param {number} efficiency - 效率百分比（如96表示96%）
 * @param {number} vin        - 输入电压（V）
 * @returns {number} 输入电流（A），保留2位小数
 */
function estimateInputCurrent(pout, efficiency, vin) {
    // 效率从百分比转为小数
    const efficiencyDecimal = efficiency / 100;

    // 防止除以零
    if (efficiencyDecimal === 0 || vin === 0) {
        return 0;
    }

    const inputPower = pout / efficiencyDecimal;   // 输入端实际功率
    const inputCurrent = inputPower / vin;           // 输入电流

    return round2(inputCurrent);
}

/**
 * 8. 功率计算
 *
 * 基础物理公式：功率 = 电压 × 电流
 *
 * 这是最底层的计算单元，上面的函数都会间接用到它。
 *
 * @param {number} voltage - 电压（V）
 * @param {number} current - 电流（A）
 * @returns {number} 功率（W）
 */
function calcPower(voltage, current) {
    return voltage * current;
}

// ─── 导出 ────────────────────────────────────────────────

export {
    calcRange,
    calcPhaseVoltage,
    calcThreePhaseCurrent,
    calcMinMax,
    decideVoltageErrorMode,
    decideCurrentErrorMode,
    estimateInputCurrent,
    calcPower
};
