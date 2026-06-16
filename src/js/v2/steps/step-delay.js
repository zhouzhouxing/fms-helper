/**
 * 步骤9: 延时配置 (DelayConfig) — OBC用
 *
 * EnableTrigger=True, AdjustTime/TriggerTimeOut/Delay 从高级配置读取（OBC组）
 */

import * as params from '../config/default-params.js';

function buildStep9(pointData, calcResult, sharedParams) {
    var cfg = params.get('obc');
    var result = {};

    result.Delay = String(cfg.delay);
    result.EnableTrigger = 'True';
    result.AdjustTime = String(cfg.adjustTime);
    result.TriggerTimeOut = String(cfg.triggerTimeOut);
    result.EnableOBCTrigger = 'True';
    result.MachineTrigger1 = '输出电流';
    result.MachineTriggerCondition1 = '＞';

    if (calcResult && calcResult.ioutMin != null) {
        result.MachineTriggerValue1 = String(Math.max(0.1, Math.round((calcResult.ioutMin - 1) * 100) / 100));
    } else {
        var triggerVal = (pointData.iout || 6) * 0.5 - 1;
        result.MachineTriggerValue1 = String(Math.max(0.1, Math.round(triggerVal * 100) / 100));
    }

    result.EnableJudgeStability = 'False';
    result.MachineSampleRelationship = '不操作';
    result.SampleOBCInVolt = 'False';
    result.SampleOBCInCurr = 'False';
    result.SampleOBCOutVolt = 'False';
    result.SampleOBCOutCurr = 'False';
    result.SampleDCDCInVolt = 'False';
    result.SampleDCDCInCurr = 'False';
    result.SampleDCDCOutVolt = 'False';
    result.SampleDCDCOutCurr = 'False';

    return result;
}

export { buildStep9 };
