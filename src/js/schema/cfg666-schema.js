/**
 * CFG666 结构定义 + TempletType 参数模板
 *
 * CFG666 是 FMS 测试系统的配置文件格式，存储测试流程中每一步的配置。
 * 每个配置项由 ConfigPara 数组组成，每项通过 TempletType 区分功能类型。
 *
 * TempletValue 内部格式（参数编码）:
 *   key1∥value1‖editable1‖type1§key2∥value2‖editable2‖type2
 * 其中:
 *   ∥ 分隔参数名和值
 *   ‖ 分隔值、是否可编辑、数据类型
 *   § 分隔不同的参数组
 * 数据类型: -1=文本/布尔/下拉, 0=整数, 2=浮点数
 *
 * 本文件提供:
 *   1. TEMPLET_TYPES - 13种模板类型的元数据定义
 *   2. createEmptyCFG666() - 创建空的CFG666配置结构
 *   3. createConfigPara() - 创建单个ConfigPara项
 */

// ===== 13种 TempletType 定义 =====
// 每种类型包含: name(中文名), hasFuncDesc(是否有功能描述), defaultParams(默认参数)
const TEMPLET_TYPES = {

    // 1. 功率分析仪 - 设置功率分析仪的电压/电流量程、滤波、响应速度等
    PowerMeterAdvancedConfig: {
        name: '功率分析仪',
        hasFuncDesc: false,
        defaultParams: {
            VoltRangeChannel1: '自动',
            VoltRangeChannel2: '自动',
            CurrRangeChannel1: '自动',
            CurrRangeChannel2: '自动',
            LineFilteringChannel1: '5.5kHz',
            LineFilteringChannel2: '5.5kHz',
            VoltResponseSpeed: 'SLOW',
            LoadOperateMode: 'CVH',
            MultiMeterRange: '0'
        }
    },

    // 2. OBC设备 - 控制OBC(车载充电机)的交流/直流输入、辅电等
    OBCDeviceConfig: {
        name: 'OBC设备',
        hasFuncDesc: true,
        defaultParams: {
            KL30Volt: '14',
            LowVoltLimitCurr: '3',
            MachineTriggerCondition1: '＞',
            Delay: '3000'
        }
    },

    // 3. 逆变器 - 控制逆变模式的负载、HVDC等
    InvertDeviceConfig: {
        name: '逆变器',
        hasFuncDesc: true,
        defaultParams: {
            InvertMode: '步进电机模式',
            KL30Volt: '14',
            LowVoltLimitCurr: '3',
            DCOutPoint: '连接',
            MachineTriggerCondition1: '＞',
            Delay: '3000'
        }
    },

    // 4. 产品配置 - 发送CAN报文控制产品状态（唤醒/启机/停机）
    ProductConfig: {
        name: '产品配置',
        hasFuncDesc: true,
        defaultParams: {
            SendControl: '启动发送',
            UpdateStopSend: 'False',
            DecodeDelayTime: '100',
            OBCSendStatus: '0',
            OBCVoltageEnable: 'False',
            OBCCurrentEnable: 'False',
            OBCReserveEnable1: 'False',
            OBCReserveEnable2: 'False',
            OBCReserve3: '165',
            OBCReserveEnable3: 'True',
            DCDCSendStatus: '-1',
            DCDCVoltageEnable: 'False',
            DCDCCommandEnable: 'False',
            DCDCReserveEnable1: 'False',
            DCDCReserveEnable2: 'False',
            DCDCReserveEnable3: 'False',
            DCDCReserveEnable4: 'False',
            DCDCReserveEnable7: 'False',
            DCDCReserveEnable8: 'False',
            DCDCReserveEnable9: 'False',
            DCDCReserveEnable10: 'False',
            DCDCReserveEnable11: 'False',
            DCDCReserveEnable12: 'False',
            Delay: '5000'
        }
    },

    // 5. 延时 - 等待一段时间并监测触发条件
    DelayConfig: {
        name: '延时',
        hasFuncDesc: false,
        defaultParams: {
            Delay: '3000',
            EnableTrigger: 'True',
            AdjustTime: '500',
            TriggerTimeOut: '180000',
            EnableOBCTrigger: 'True',
            MachineTrigger1: '电流',
            MachineTriggerCondition1: '＞',
            MachineTriggerValue1: '6',
            EnableJudgeStability: 'False',
            MachineSampleRelationship: '不相关',
            SampleOBCInVolt: 'False',
            SampleOBCInCurr: 'False',
            SampleOBCOutVolt: 'False',
            SampleOBCOutCurr: 'False',
            SampleDCDCInVolt: 'False',
            SampleDCDCInCurr: 'False',
            SampleDCDCOutVolt: 'False',
            SampleDCDCOutCurr: 'False'
        }
    },

    // 6. 功率结果 - 记录并判定测试结果的上下限
    PowerResult: {
        name: '功率结果',
        hasFuncDesc: false,
        defaultParams: {
            InvMode: 'False',
            ThreeMode: 'False',
            ResetDecode: 'False',
            DecodeDelayTime: '100',
            ReTestCount: '2',
            ReTestTime: '300'
        }
    },

    // 7. 全局变量配置 - 定义全局变量列表（TempletValue为JSON数组）
    GlobalVariableConfig: {
        name: '全局变量配置',
        hasFuncDesc: false,
        /*
         * TempletValue 是 JSON 数组，每项格式:
         * { Edited: true, Name: "变量名", Description: "描述", Type: 1 }
         * Type: 1=Number 数值类型
         */
        defaultParams: {}
    },

    // 8. 全局变量读取 - 从设备读取值存入全局变量
    // TempletValue格式: 变量名∥True‖读变量名‖源描述‖Number§...
    GlobalVariableRead: {
        name: '全局变量读取',
        hasFuncDesc: false,
        /*
         * 5字段格式: VariableName∥True‖ReadVarName‖SourceDesc‖DataType
         * 多个变量用 § 分隔
         */
        defaultParams: {}
    },

    // 9. 全局变量计算 - 使用RPN表达式计算新变量
    GlobalVariableCalculate: {
        name: '全局变量计算',
        hasFuncDesc: false,
        /*
         * 支持1-10个表达式
         * 每组: EnableExpressionN∥True‖-1§GlobalVariableN∥True‖变量名‖描述‖Number§RPNExpressionN∥表达式‖True‖-1
         */
        defaultParams: {}
    },

    // 10. 全局变量结果 - 判定全局变量是否在上下限范围内
    GlobalVariableResult: {
        name: '全局变量结果',
        hasFuncDesc: false,
        /*
         * 支持1-15项判定
         * 每组: DescriptionN∥描述‖True‖-1§GlobalVariableN∥True‖变量名‖描述‖Number§MinValueN∥值‖True‖2§MaxValueN∥值‖True‖2§BoardIndexN∥A板‖True‖-1
         */
        defaultParams: {}
    },

    // 11. DCDC设备 - 控制DCDC转换器的HVDC输入和负载
    DCDCDeviceConfig: {
        name: 'DCDC设备',
        hasFuncDesc: true,
        defaultParams: {
            KL30Volt: '14',
            LowVoltLimitCurr: '3',
            DCOutPoint: '连接',
            EnableKL15: '打开',
            MachineTriggerCondition1: '＞',
            Delay: '3000'
        }
    },

    // 12. 测试类型切换 - 在测试过程中切换测试类型（DCDC<->逆变）
    TestTypeChange: {
        name: '测试类型切换',
        hasFuncDesc: false,
        defaultParams: {
            LoadVoltMax: '16',
            TimeOut: '300000',
            AdjustTime: '1000',
            EnableAcVolt: 'False',
            EnableTriphase: 'False'
        }
    },

    // 13. 功率分析仪(DCDC) - 设置DCDC阶段的功率分析仪通道3/4参数
    PowerMeterAdvancedConfigDCDC: {
        name: '功率分析仪(DCDC)',
        hasFuncDesc: false,
        defaultParams: {
            VoltRangeChannel3: '自动',
            VoltRangeChannel4: '自动',
            CurrRangeChannel3: '自动',
            CurrRangeChannel4: '自动',
            LineFilteringChannel3: '5.5kHz',
            LineFilteringChannel4: '5.5kHz',
            VoltResponseSpeed: 'SLOW',
            MultiMeterRange: '0'
        }
    }
};

// ===== 辅助函数 =====

/**
 * 创建一个空的CFG666配置结构
 * @param {string} configName - 配置名称
 * @returns {object} CFG666顶层结构
 */
function createEmptyCFG666(configName) {
    return {
        ConfigName: configName || '',
        ConfigVersion: '',
        LineNumber: 1,
        ProductLineCheck: true,
        ShowFailPassTip: false,
        ReTestTimes: 0,
        AllowReTestTimes: 0,
        BoardNumber: 1,
        ConfigPara: []
    };
}

/**
 * 创建一个ConfigPara配置项
 * @param {string} templetType - TempletType键名，如 'OBCDeviceConfig'
 * @param {string|null} funcDesc - 功能描述，如 '辅电'、'唤醒'
 * @returns {object} ConfigPara项
 */
function createConfigPara(templetType, funcDesc) {
    const typeInfo = TEMPLET_TYPES[templetType];
    if (!typeInfo) {
        throw new Error(`未知的 TempletType: ${templetType}`);
    }

    // 生成TempletValue: 把defaultParams编码为标准格式
    const templetValue = encodeTempletValue(typeInfo.defaultParams);

    return {
        Finally: false,
        TestItem: '',
        TempletName: typeInfo.name,
        TempletType: templetType,
        FuncDesc: funcDesc !== undefined ? funcDesc : null,
        TempletValue: templetValue,
        BlackList: false
    };
}

/**
 * 将参数字典编码为TempletValue字符串
 * 每个参数根据值的类型自动判断数据类型码:
 *   -1: 非数字字符串（文本/布尔/下拉）
 *   0:  纯整数
 *   2:  浮点数
 * @param {object} params - 参数键值对
 * @returns {string} TempletValue编码字符串
 */
function encodeTempletValue(params) {
    if (!params || Object.keys(params).length === 0) {
        return '';
    }

    const parts = [];
    for (const [key, value] of Object.entries(params)) {
        // 判断数据类型码
        let typeCode = -1; // 默认文本/布尔/下拉
        const strValue = String(value);
        if (/^-?\d+$/.test(strValue)) {
            typeCode = 0; // 整数
        } else if (/^-?\d+\.\d+$/.test(strValue)) {
            typeCode = 2; // 浮点数
        }
        // 格式: key∥value‖editable‖typeCode
        parts.push(`${key}∥${strValue}‖True‖${typeCode}`);
    }
    return parts.join('§');
}

/**
 * 获取指定TempletType的元数据
 * @param {string} templetType - TempletType键名
 * @returns {object|null} 类型元数据 { name, hasFuncDesc, defaultParams }
 */
function getTempletTypeInfo(templetType) {
    return TEMPLET_TYPES[templetType] || null;
}

/**
 * 获取所有TempletType的键名列表
 * @returns {string[]} TempletType键名数组
 */
function getAllTempletTypeKeys() {
    return Object.keys(TEMPLET_TYPES);
}

// ===== 导出 =====
export {
    TEMPLET_TYPES,
    createEmptyCFG666,
    createConfigPara,
    encodeTempletValue,
    getTempletTypeInfo,
    getAllTempletTypeKeys
};
