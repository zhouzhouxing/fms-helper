/**
 * 产品配置步骤 (ProductConfig)
 *
 * 步骤3(唤醒): 用户选加不加
 * 步骤7(启机): 一定加
 * 步骤11(停机): 一定加（三相为步骤12）
 *
 * Delay 从高级配置读取（根据当前模式选 OBC/DCDC/逆变组）
 */

import * as params from '../config/default-params.js';

/**
 * 步骤3: 唤醒（用户可选）
 * @param {object} pointData
 * @param {object} calcResult
 * @param {object} sharedParams - { includeWake: boolean }
 * @returns {object|null}
 */
function buildStep3(pointData, calcResult, sharedParams) {
    if (!(sharedParams && sharedParams.includeWake)) {
        return null;
    }
    var group = sharedParams._paramGroup || 'obc';
    var cfg = params.get(group);
    return {
        SendControl: '启动发送',
        Delay: String(cfg.delay)
    };
}

/**
 * 步骤7: 启机指令（一定加）
 */
function buildStep7(pointData, calcResult, sharedParams) {
    var group = (sharedParams && sharedParams._paramGroup) || 'obc';
    var cfg = params.get(group);
    return {
        SendControl: '启动发送',
        Delay: String(cfg.delay)
    };
}

/**
 * 步骤11/12: 停机指令（一定加）
 */
function buildStep11(pointData, calcResult, sharedParams) {
    var group = (sharedParams && sharedParams._paramGroup) || 'obc';
    var cfg = params.get(group);
    return {
        SendControl: '启动发送',
        Delay: String(cfg.delay)
    };
}

export { buildStep3, buildStep7, buildStep11 };
