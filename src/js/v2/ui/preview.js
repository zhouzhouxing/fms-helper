/**
 * 预览组件
 *
 * 显示生成的步骤卡片列表。每个步骤显示：序号、名称、TempletType、关键字段值（只读）。
 * 多列多行布局，字段标注中文，文本可选中复制。
 *
 * DOM 依赖：
 *   - #previewContainer — 预览容器
 */

// ===== 字段中文标注映射 =====

var FIELD_LABELS = {
    // 量程
    LineFilteringChannel1: '线路滤波CH1',
    LineFilteringChannel2: '线路滤波CH2',
    VoltResponseSpeed: '电压响应速度',
    MultiMeterRange: '多量程表',
    VoltRangeChannel1: '输入电压量程',
    VoltRangeChannel2: '输出电压量程',
    CurrRangeChannel1: '输入电流量程',
    CurrRangeChannel2: '输出电流量程',

    // 上辅电
    KL30Volt: 'KL30电压',
    LowVoltLimitCurr: '低压限流',
    DCOutPoint: '直流输出点',
    CcCpControl: 'CC/CP控制',
    CCSetValueResistance: 'CC设定电阻',
    CPSetValuePercent: 'CP设定百分比',

    // 唤醒/启机/停机
    SendControl: '发送控制',
    UpdateStopSend: '停止发送更新',
    DecodeDelayTime: '解码延时(ms)',
    OBCSendStatus: 'OBC发送状态',
    OBCCurrentEnable: 'OBC电流使能',
    OBCReserve1: 'OBC预留1',
    OBCReserve2: 'OBC预留2',
    OBCReserveEnable1: 'OBC预留使能1',
    OBCReserveEnable2: 'OBC预留使能2',
    OBCReserveEnable3: 'OBC预留使能3',
    OBCReserveEnable4: 'OBC预留使能4',
    OBCReserveEnable5: 'OBC预留使能5',
    OBCReserveEnable6: 'OBC预留使能6',
    OBCReserveEnable7: 'OBC预留使能7',
    OBCReserveEnable8: 'OBC预留使能8',
    OBCReserveEnable9: 'OBC预留使能9',
    OBCReserveEnable10: 'OBC预留使能10',
    DCDCSendStatus: 'DCDC发送状态',
    DCDCVoltageEnable: 'DCDC电压使能',
    DCDCCommandEnable: 'DCDC命令使能',
    DCDCReserveEnable1: 'DCDC预留使能1',
    DCDCReserveEnable2: 'DCDC预留使能2',
    DCDCReserveEnable3: 'DCDC预留使能3',
    DCDCReserveEnable4: 'DCDC预留使能4',

    // HVAC
    AcVolt: '交流电压',
    InputFrequency: '输入频率',
    AcInputMode: '交流输入模式',

    // 模拟电池
    VBatVolt: '模拟电池电压',
    VBatLimitCurr: '电池限流',
    VBatControlWay: '电池控制方式',

    // 负载
    LoadValue: '负载值',
    LoadLoop: '负载循环',
    LoadEndValue: '负载结束值',
    LoadStepValue: '负载步进值',
    LoadControlWay: '负载控制方式',
    LoadAdjustTime: '负载调节时间',

    // 延时
    Delay: '延时(ms)',
    EnableTrigger: '使能触发',
    AdjustTime: '调节时间(ms)',
    TriggerTimeOut: '触发超时(ms)',
    EnableOBCTrigger: '使能OBC触发',
    MachineTrigger1: '触发器1',
    MachineTriggerCondition1: '触发条件1',
    MachineTriggerValue1: '触发值1',
    EnableJudgeStability: '使能稳定性判断',
    MachineSampleRelationship: '采样关系',

    // 功率结果
    InvMode: '逆变模式',
    ThreeMode: '三相模式',
    ResetDecode: '重置解码',
    ReTestCount: '重测次数',
    ReTestTime: '重测时间(ms)',
    DecodeDelayTime2: '解码延时2',

    // 通用触发
    MachineTriggerCondition: '触发条件'
};

/**
 * 模式匹配标注（用于动态字段名）
 */
var FIELD_LABEL_PATTERNS = [
    { pattern: /^ProdOBCInVolt(.*)$/, label: '产品输入电压$1' },
    { pattern: /^ProdOBCInCurr(.*)$/, label: '产品输入电流$1' },
    { pattern: /^ProdOBCOutVolt(.*)$/, label: '产品输出电压$1' },
    { pattern: /^ProdOBCOutCurr(.*)$/, label: '产品输出电流$1' },
    { pattern: /^ProdDCDCInVolt(.*)$/, label: 'DCDC输入电压$1' },
    { pattern: /^ProdDCDCInCurr(.*)$/, label: 'DCDC输入电流$1' },
    { pattern: /^ProdDCDCOutVolt(.*)$/, label: 'DCDC输出电压$1' },
    { pattern: /^ProdDCDCOutCurr(.*)$/, label: 'DCDC输出电流$1' },
    { pattern: /^MachOBCInVolt(.*)$/, label: '工装输入电压$1' },
    { pattern: /^MachOBCInCurr(.*)$/, label: '工装输入电流$1' },
    { pattern: /^MachOBCOutVolt(.*)$/, label: '工装输出电压$1' },
    { pattern: /^MachOBCOutCurr(.*)$/, label: '工装输出电流$1' },
    { pattern: /^MachOBCInPower(.*)$/, label: '工装输入功率$1' },
    { pattern: /^MachOBCOutPower(.*)$/, label: '工装输出功率$1' },
    { pattern: /^MachOBCFrequency(.*)$/, label: '工装频率$1' },
    { pattern: /^MachOBCPF(.*)$/, label: '工装功率因数$1' },
    { pattern: /^MachDCDCInVolt(.*)$/, label: 'DCDC工装输入电压$1' },
    { pattern: /^MachDCDCInCurr(.*)$/, label: 'DCDC工装输入电流$1' },
    { pattern: /^MachDCDCOutVolt(.*)$/, label: 'DCDC工装输出电压$1' },
    { pattern: /^MachDCDCOutCurr(.*)$/, label: 'DCDC工装输出电流$1' },
    { pattern: /^MachDCDCInPower(.*)$/, label: 'DCDC输入功率$1' },
    { pattern: /^MachDCDCOutPower(.*)$/, label: 'DCDC输出功率$1' },
    { pattern: /VoltOffset(.*)$/, label: '电压偏置$1' },
    { pattern: /VoltAccuracy(.*)$/, label: '电压精度$1' },
    { pattern: /CurrOffset(.*)$/, label: '电流偏置$1' },
    { pattern: /CurrAccuracy(.*)$/, label: '电流精度$1' },
    { pattern: /OBCConversionEfficiency(.*)$/, label: '转换效率$1' },
    { pattern: /SampleOBCInVolt$/, label: '采样输入电压' },
    { pattern: /SampleOBCInCurr$/, label: '采样输入电流' },
    { pattern: /SampleOBCOutVolt$/, label: '采样输出电压' },
    { pattern: /SampleOBCOutCurr$/, label: '采样输出电流' },
    { pattern: /SampleDCDCInVolt$/, label: '采样DCDC输入电压' },
    { pattern: /SampleDCDCInCurr$/, label: '采样DCDC输入电流' },
    { pattern: /SampleDCDCOutVolt$/, label: '采样DCDC输出电压' },
    { pattern: /SampleDCDCOutCurr$/, label: '采样DCDC输出电流' }
];

/**
 * 后缀标注替换
 */
var SUFFIX_LABELS = {
    Min: '最小',
    Max: '最大',
    MinL1: '最小L1',
    MaxL1: '最大L1',
    MinL2: '最小L2',
    MaxL2: '最大L2',
    MinL3: '最小L3',
    MaxL3: '最大L3'
};

/**
 * 获取字段标注
 * @param {string} fieldName
 * @returns {string}
 */
function getFieldLabel(fieldName) {
    // 1. 精确匹配
    if (FIELD_LABELS[fieldName]) {
        return FIELD_LABELS[fieldName];
    }

    // 2. 模式匹配
    for (var i = 0; i < FIELD_LABEL_PATTERNS.length; i++) {
        var rule = FIELD_LABEL_PATTERNS[i];
        var match = fieldName.match(rule.pattern);
        if (match) {
            var label = rule.label;
            // 替换后缀
            if (match[1]) {
                var suffix = SUFFIX_LABELS[match[1]];
                label = label.replace('$1', suffix ? suffix : match[1]);
            } else {
                label = label.replace('$1', '');
            }
            return label;
        }
    }

    // 3. 未知字段直接返回字段名
    return fieldName;
}

// ===== 内部状态 =====

/** 预览容器引用 */
var _container = null;

/** 空状态提示文字 */
var EMPTY_HINT = '点击"生成脚本"查看结果';

// ===== 公共 API =====

/**
 * 渲染步骤卡片列表
 * @param {Array<{step: number, name: string, type: string, fields: object, testItem?: string}>} steps
 */
function render(steps) {
    _container = document.getElementById('previewContainer');
    if (!_container) return;

    if (!steps || steps.length === 0) {
        clear();
        return;
    }

    var html = '';
    for (var i = 0; i < steps.length; i++) {
        var s = steps[i];
        html += '<div class="step-card">';

        // 步骤头部
        html += '<div class="step-header">';
        html += '<span class="step-number">步骤 ' + s.step + '</span>';
        html += '<span class="step-name">' + escapeHtml(s.name) + '</span>';
        html += '<span class="step-type">' + escapeHtml(s.type) + '</span>';
        if (s.testItem) {
            html += '<span class="step-test-item">' + escapeHtml(s.testItem) + '</span>';
        }
        html += '</div>';

        // 字段区：多列网格布局
        html += '<div class="step-fields-grid">';
        if (s.fields) {
            var keys = Object.keys(s.fields);
            for (var j = 0; j < keys.length; j++) {
                var keyName = keys[j];
                if (keyName === '...') {
                    // 摘要提示
                    html += '<div class="field-item field-more">' + escapeHtml(String(s.fields[keyName])) + '</div>';
                    continue;
                }
                var label = getFieldLabel(keyName);
                var value = String(s.fields[keyName]);
                html += '<div class="field-item">';
                html += '<span class="field-key">' + escapeHtml(keyName);
                if (label !== keyName) {
                    html += '<span class="field-label">(' + escapeHtml(label) + ')</span>';
                }
                html += ':</span> ';
                html += '<span class="field-value">' + escapeHtml(value) + '</span>';
                html += '</div>';
            }
        }
        html += '</div>';

        html += '</div>';
    }

    _container.innerHTML = html;
}

/**
 * 清空预览区，恢复空状态提示
 * @param {string} [hint] - 可选的自定义提示文字
 */
function clear(hint) {
    _container = document.getElementById('previewContainer');
    if (_container) {
        _container.innerHTML = '<p class="empty-hint">' + (hint || EMPTY_HINT) + '</p>';
    }
}

// ===== 内部函数 =====

/**
 * HTML 转义，防止 XSS
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, function (ch) {
        return map[ch];
    });
}

// ===== 导出 =====

export { render, clear };
