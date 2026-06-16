/**
 * 脚本类型模板
 *
 * 定义3种脚本类型及其预置测试项模板。
 * 当用户新建脚本时，根据选择的脚本类型预填充测试项列表，
 * 用户可在模板基础上修改参数值。
 *
 * 三种脚本类型:
 *   - obc-dcdc: OBC + DCDC 测试（充电机+直流转换器联测）
 *   - inverter: 逆变器测试（直流转交流回馈电网）
 *   - custom: 自由组合（空模板，用户自行添加）
 *
 * 每个模板项格式:
 *   { templetType: 'OBCDeviceConfig', funcDesc: '辅电', params: { KL30Volt: '14', ... } }
 * 其中 params 是可选的参数覆盖，不传则使用 TEMPLET_TYPES 中的默认值。
 */

// ===== 脚本类型常量 =====
const SCRIPT_TYPES = {
    OBC_DCDC: 'obc-dcdc',
    INVERTER: 'inverter',
    CUSTOM: 'custom'
};

// ===== 脚本类型中文标签 =====
const SCRIPT_TYPE_LABELS = {
    'obc-dcdc': 'OBC + DCDC 测试',
    'inverter': '逆变器测试',
    'custom': '自由组合'
};

// ===== OBC + DCDC 测试模板 =====
// 参考小米MX11 CFG666文件中的测试流程顺序
const OBC_DCDC_TEMPLATE = [
    /* 1. 功率分析仪量程设置 */
    { templetType: 'PowerMeterAdvancedConfig', funcDesc: null },

    /* 2. OBC辅电（给产品供KL30低压电） */
    { templetType: 'OBCDeviceConfig', funcDesc: '辅电',
        params: { KL30Volt: '14', LowVoltLimitCurr: '3', MachineTriggerCondition1: '＞', Delay: '3000' } },

    /* 3. 唤醒产品 */
    { templetType: 'ProductConfig', funcDesc: '唤醒' },

    /* 4. OBC HVAC（给产品供220V交流电） */
    { templetType: 'OBCDeviceConfig', funcDesc: 'HVAC',
        params: { AcVolt: '220', InputFrequency: '50', AcInputMode: '单相模式', MachineTriggerCondition1: '＞', Delay: '3000' } },

    /* 5. 模拟电池（给OBC输出端供高压电） */
    { templetType: 'OBCDeviceConfig', funcDesc: '模拟电池',
        params: { VBatVolt: '633', VBatLimitCurr: '0.4', MachineTriggerCondition1: '＞', Delay: '3000' } },

    /* 6. 启机指令（通知产品开始工作） */
    { templetType: 'ProductConfig', funcDesc: '启机',
        params: {
            SendControl: '启动发送', UpdateStopSend: 'False', DecodeDelayTime: '100',
            OBCSendStatus: '1', OBCVoltageEnable: 'True', OBCCurrentEnable: 'True',
            OBCReserveEnable1: 'True', OBCReserveEnable2: 'True', OBCReserveEnable3: 'True',
            OBCReserve3: '165',
            DCDCSendStatus: '1', DCDCVoltageEnable: 'True', DCDCCommandEnable: 'True',
            DCDCReserveEnable1: 'True', DCDCReserveEnable2: 'True', DCDCReserveEnable3: 'True',
            DCDCReserveEnable4: 'True', DCDCReserveEnable7: 'True', DCDCReserveEnable8: 'True',
            DCDCReserveEnable9: 'True', DCDCReserveEnable10: 'True', DCDCReserveEnable11: 'True', DCDCReserveEnable12: 'True',
            Delay: '3000'
        } },

    /* 7. OBC测试延时（等待OBC稳定） */
    { templetType: 'DelayConfig', funcDesc: null },

    /* 8. OBC功率结果 */
    { templetType: 'PowerResult', funcDesc: 'OBC' },

    /* 9. 切换至DCDC测试 */
    { templetType: 'TestTypeChange', funcDesc: '切换DCDC' },

    /* 10. 功率分析仪DCDC通道设置 */
    { templetType: 'PowerMeterAdvancedConfigDCDC', funcDesc: null },

    /* 11. DCDC辅电 */
    { templetType: 'DCDCDeviceConfig', funcDesc: '辅电',
        params: { KL30Volt: '14', LowVoltLimitCurr: '3', DCOutPoint: '连接', EnableKL15: '打开',
            MachineTriggerCondition1: '＞', Delay: '3000' } },

    /* 12. DCDC启机指令 */
    { templetType: 'ProductConfig', funcDesc: '启机指令(DCDC)',
        params: {
            SendControl: '启动发送', UpdateStopSend: 'False', DecodeDelayTime: '100',
            OBCSendStatus: '1', OBCVoltageEnable: 'True', OBCCurrentEnable: 'True',
            OBCReserveEnable1: 'True', OBCReserveEnable2: 'True', OBCReserveEnable3: 'True',
            DCDCSendStatus: '1', DCDCVoltageEnable: 'True', DCDCCommandEnable: 'True',
            DCDCReserveEnable1: 'True', DCDCReserveEnable2: 'True', DCDCReserveEnable3: 'True',
            DCDCReserveEnable4: 'True', DCDCReserve7: '44', DCDCReserve8: '1',
            DCDCReserve9: '50', DCDCReserve10: '20', DCDCReserve11: '50', DCDCReserve12: '165',
            DCDCReserveEnable7: 'True', DCDCReserveEnable8: 'True', DCDCReserveEnable9: 'True',
            DCDCReserveEnable10: 'True', DCDCReserveEnable11: 'True', DCDCReserveEnable12: 'True',
            Delay: '5000'
        } },

    /* 13. DCDC HVDC（供高压直流电） */
    { templetType: 'DCDCDeviceConfig', funcDesc: 'HVDC',
        params: { HvVolt: '628', DcInputLimitCurr: '20', MachineTriggerCondition1: '＞', Delay: '3000' } },

    /* 14. DCDC预负载 */
    { templetType: 'DCDCDeviceConfig', funcDesc: '预负载',
        params: { DCOutPoint: '断开', EnableKL15: '关闭', LoadValue: '3', LoadMode: 'CC',
            LoadControlWay: '打开', DCOutRelay: '关', DCOutSwitchRelay: '打开',
            MachineTriggerCondition1: '＞', Delay: '3000' } },

    /* 15. DCDC带载测试 */
    { templetType: 'DCDCDeviceConfig', funcDesc: '负载',
        params: { LoadValue: '3', LoadMode: 'CC', LoadControlWay: '打开', LoadLoop: 'True',
            LoadEndValue: '6.8', LoadStepValue: '1', LoadAdjustTime: '300',
            MachineTriggerCondition1: '＞', Delay: '3000' } },

    /* 16. DCDC功率结果 */
    { templetType: 'PowerResult', funcDesc: 'DCDC' },

    /* 17. DCDC卸载 */
    { templetType: 'DCDCDeviceConfig', funcDesc: '卸载',
        params: { LoadMode: 'CC', LoadControlWay: '关', DCOutSwitchRelay: '关',
            MachineTriggerCondition1: '＞', Delay: '3000' } },

    /* 18. 停机指令 */
    { templetType: 'ProductConfig', funcDesc: '停机指令' },

    /* 19. 关HVDC */
    { templetType: 'DCDCDeviceConfig', funcDesc: '关HVDC',
        params: { HvVolt: '0', DcInputLimitCurr: '0', MachineTriggerCondition1: '＞', Delay: '3000' } },

    /* 20. 复位辅电 */
    { templetType: 'DCDCDeviceConfig', funcDesc: '复位辅电',
        params: { KL30Volt: '0', LowVoltLimitCurr: '0', DCOutPoint: '断开', EnableKL15: '关闭',
            MachineTriggerCondition1: '＞', Delay: '3000' } }
];

// ===== 逆变器测试模板 =====
// 参考Renault AC3 CFG666文件中的测试流程顺序
const INVERTER_TEMPLATE = [
    /* 1. 功率分析仪量程设置 */
    { templetType: 'PowerMeterAdvancedConfig', funcDesc: null },

    /* 2. 逆变辅电（给产品供KL30低压电） */
    { templetType: 'InvertDeviceConfig', funcDesc: '辅电',
        params: { InvertMode: '步进电机模式', KL30Volt: '14', LowVoltLimitCurr: '3',
            DCOutPoint: '连接', MachineTriggerCondition1: '＞', Delay: '3000' } },

    /* 3. 唤醒产品 */
    { templetType: 'ProductConfig', funcDesc: '唤醒' },

    /* 4. HVDC（供高压直流电） */
    { templetType: 'InvertDeviceConfig', funcDesc: 'HVDC',
        params: { InvertMode: '步进电机模式', HvVolt: '275', DcInputLimitCurr: '20',
            MachineTriggerCondition1: '＞', Delay: '3000' } },

    /* 5. 启机指令（通知产品开始逆变） */
    { templetType: 'ProductConfig', funcDesc: '启机指令',
        params: {
            SendControl: '启动发送', UpdateStopSend: 'False', DecodeDelayTime: '100',
            OBCSendStatus: '1', OBCCurrentEnable: 'True',
            OBCReserve1: '3', OBCReserveEnable1: 'True',
            OBCReserve2: '6', OBCReserveEnable2: 'True',
            OBCReserveEnable3: 'True', OBCReserveEnable4: 'True',
            OBCReserveEnable5: 'True', OBCReserveEnable6: 'True',
            OBCReserveEnable7: 'True', OBCReserveEnable8: 'True',
            OBCReserve9: '0', OBCReserveEnable9: 'True',
            OBCReserve10: '32', OBCReserveEnable10: 'True',
            DCDCSendStatus: '1', DCDCVoltageEnable: 'True', DCDCCommandEnable: 'True',
            DCDCReserveEnable1: 'True', DCDCReserveEnable2: 'True',
            DCDCReserveEnable3: 'True', DCDCReserveEnable4: 'True',
            Delay: '5000'
        } },

    /* 6. 预负载（用电子负载预热） */
    { templetType: 'InvertDeviceConfig', funcDesc: '预负载',
        params: { InvertMode: '步进电机模式', LoadValue: '13', LoadMode: 'CR',
            LoadControlWay: '打开', LoadLoop: 'True', LoadEndValue: '10',
            LoadStepValue: '1', LoadAdjustTime: '500',
            MachineTriggerCondition1: '＞', Delay: '120000' } },

    /* 7. 带载测试（正式负载） */
    { templetType: 'InvertDeviceConfig', funcDesc: '负载',
        params: { InvertMode: '步进电机模式', LoadValue: '6.1', LoadMode: 'CR',
            LoadControlWay: '打开', MachineTriggerCondition1: '＞', Delay: '3000' } },

    /* 8. 延时（等待逆变稳定） */
    { templetType: 'DelayConfig', funcDesc: null },

    /* 9. 功率结果 */
    { templetType: 'PowerResult', funcDesc: null },

    /* 10. 降载（阶梯降载） */
    { templetType: 'InvertDeviceConfig', funcDesc: '降载',
        params: { InvertMode: '步进电机模式', LoadValue: '6.2', LoadMode: 'CR',
            LoadControlWay: '打开', LoadLoop: 'True', LoadEndValue: '20',
            LoadStepValue: '2', LoadAdjustTime: '300',
            MachineTriggerCondition1: '＞', Delay: '3000' } },

    /* 11. 卸载 */
    { templetType: 'InvertDeviceConfig', funcDesc: '卸载',
        params: { InvertMode: '步进电机模式', LoadMode: 'CR', LoadControlWay: '关',
            MachineTriggerCondition1: '＞', Delay: '3000' } },

    /* 12. 停机指令 */
    { templetType: 'ProductConfig', funcDesc: '停机指令' },

    /* 13. 关HVDC */
    { templetType: 'InvertDeviceConfig', funcDesc: '关HVDC',
        params: { InvertMode: '步进电机模式', HvVolt: '0', DcInputLimitCurr: '0',
            MachineTriggerCondition1: '＞', Delay: '3000' } },

    /* 14. 复位辅电 */
    { templetType: 'InvertDeviceConfig', funcDesc: '复位辅电',
        params: { InvertMode: '步进电机模式', KL30Volt: '0', LowVoltLimitCurr: '0',
            DCOutPoint: '断开', MachineTriggerCondition1: '＞', Delay: '3000' } }
];

// ===== 自由组合模板（空） =====
const CUSTOM_TEMPLATE = [];

// ===== 模板数据结构 =====
// 所有模板的映射表
const TEMPLATES = {
    [SCRIPT_TYPES.OBC_DCDC]: OBC_DCDC_TEMPLATE,
    [SCRIPT_TYPES.INVERTER]: INVERTER_TEMPLATE,
    [SCRIPT_TYPES.CUSTOM]: CUSTOM_TEMPLATE
};

// ===== 公共函数 =====

/**
 * 根据脚本类型获取预置测试项模板
 * @param {string} type - 脚本类型，使用 SCRIPT_TYPES 中的值
 * @returns {Array<{templetType: string, funcDesc: string|null, params?: object}>} 模板项数组
 */
function getScriptTemplate(type) {
    const template = TEMPLATES[type];
    if (!template) {
        console.warn(`未知的脚本类型: ${type}，返回自由组合模板`);
        return CUSTOM_TEMPLATE;
    }
    // 返回深拷贝，防止调用方修改模板原始数据
    return JSON.parse(JSON.stringify(template));
}

/**
 * 获取脚本类型的中文标签
 * @param {string} type - 脚本类型
 * @returns {string} 中文标签
 */
function getScriptTypeLabel(type) {
    return SCRIPT_TYPE_LABELS[type] || type;
}

// ===== 导出 =====
export {
    SCRIPT_TYPES,
    SCRIPT_TYPE_LABELS,
    getScriptTemplate,
    getScriptTypeLabel
};
