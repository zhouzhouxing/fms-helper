/**
 * 自动计算工具 — Min/Max 上下限计算
 *
 * 根据标称值（基准值）和误差百分比，自动计算允许的上下限范围。
 * 典型场景：测试规范中要求"220V ±5%"，将 220 和 5 传入即可得到 [209, 231]。
 *
 * 计算结果保留2位小数，与 FMS 测试仪器的显示精度一致。
 *
 * 使用方式:
 *   import { calcMinMax } from '../lib/auto-calc.js';
 *   const { min, max } = calcMinMax(220, 5);
 *   // → { min: 209, max: 231 }
 *
 *   // 小数精度示例
 *   calcMinMax(215.8, 3.8);
 *   // → { min: 207.6, max: 223.99 }
 */

/**
 * 计算上下限范围
 *
 * 公式（简单百分比法）：
 *   min = nominal × ( 1 − tolerancePercent / 100 )
 *   max = nominal × ( 1 + tolerancePercent / 100 )
 *
 * 举例（生活中类比）：
 *   老板说预算 100 块，允许 ±10% 浮动 →
 *   最少花 90 块，最多花 110 块。
 *   这就是本函数做的事，只不过对象是电压/电流的测试值。
 *
 * @param {number} nominal         - 标称值（基准值，如 220 表示 220V）
 * @param {number} tolerancePercent - 误差百分比（如 5 表示 ±5%，不是 0.05）
 * @returns {{ min: number, max: number }} 计算后的下限和上限
 */
export function calcMinMax(nominal, tolerancePercent) {
    // 百分比转小数因子（5% → 0.05）
    const factor = tolerancePercent / 100;

    const min = nominal * (1 - factor);
    const max = nominal * (1 + factor);

    // 保留2位小数，用 Math.round 避免浮点数精度问题
    // 比如 220 * 0.95 = 209.00000000000003，需要修正为 209
    return {
        min: Math.round(min * 100) / 100,
        max: Math.round(max * 100) / 100
    };
}
