/**
 * 高级设置弹窗组件
 *
 * 功能：
 *   - 打开弹窗时，把当前配置值填入输入框
 *   - 标签页切换（OBC / DCDC / 逆变）
 *   - 保存：读取所有输入框的值 → 存到 localStorage
 *   - 恢复默认：清空 localStorage → 输入框还原为默认值
 *   - 取消：关闭弹窗不保存
 *
 * DOM 依赖：
 *   #btnAdvancedSettings — 工具栏触发按钮
 *   #advancedSettingsModal — 弹窗
 *   .settings-tab — 标签按钮
 *   .settings-panel — 标签内容面板
 *   #set_{group}_{key} — 各参数输入框（如 set_obc_delay）
 *   #btnSettingsSave / #btnSettingsCancel / #btnSettingsReset
 */

import * as params from '../config/default-params.js';

// 参数定义：跟 default-params.js 的字段名一一对应
var PARAM_KEYS = {
    obc: ['delay', 'triggerTimeOut', 'adjustTime', 'reTestCount', 'reTestTime',
          'kl30Volt', 'lowVoltLimitCurr', 'vbatLimitCurr', 'ccResistance', 'cpPercent', 'loadTriggerOffset'],
    dcdc: ['delay', 'triggerTimeOut', 'adjustTime', 'reTestCount', 'reTestTime', 'dcInputLimitCurr'],
    invert: ['delay', 'triggerTimeOut', 'adjustTime', 'reTestCount', 'reTestTime', 'ccResistance']
};

function init() {
    var modal = document.getElementById('advancedSettingsModal');
    if (!modal) return;

    // 标签页切换
    var tabs = modal.querySelectorAll('.settings-tab');
    tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            var target = tab.getAttribute('data-tab');
            tabs.forEach(function (t) { t.classList.remove('active'); });
            tab.classList.add('active');
            modal.querySelectorAll('.settings-panel').forEach(function (panel) {
                panel.classList.toggle('active', panel.getAttribute('data-panel') === target);
            });
        });
    });

    // 打开按钮
    var btnOpen = document.getElementById('btnAdvancedSettings');
    if (btnOpen) {
        btnOpen.addEventListener('click', function () {
            fillForm();
            modal.classList.add('active');
        });
    }

    // 保存
    var btnSave = document.getElementById('btnSettingsSave');
    if (btnSave) {
        btnSave.addEventListener('click', function () {
            saveFromForm();
            closeModal(modal);
        });
    }

    // 取消
    var btnCancel = document.getElementById('btnSettingsCancel');
    if (btnCancel) {
        btnCancel.addEventListener('click', function () {
            closeModal(modal);
        });
    }

    // 恢复默认（只更新表单显示，不动内存参数；点保存才真正生效）
    var btnReset = document.getElementById('btnSettingsReset');
    if (btnReset) {
        btnReset.addEventListener('click', function () {
            fillFormWithDefaults();
        });
    }
    // 注意：高级设置弹窗不响应遮罩点击关闭
    // 因为用户可能填了一半参数，误点空白处丢失修改
}

function closeModal(modal) {
    modal.classList.remove('active');
}

/**
 * 把当前配置值填入所有输入框
 */
function fillForm() {
    var current = params.get();
    var defaults = params.getDefaults();

    for (var group in PARAM_KEYS) {
        var keys = PARAM_KEYS[group];
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var input = document.getElementById('set_' + group + '_' + key);
            if (input) {
                input.value = current[group][key];
                input.placeholder = '默认 ' + defaults[group][key];
            }
        }
    }
}

/**
 * 把所有输入框恢复为默认值（只改显示，不动内存参数）
 * 用户点保存才真正写入，点取消则放弃
 */
function fillFormWithDefaults() {
    var defaults = params.getDefaults();
    for (var group in PARAM_KEYS) {
        var keys = PARAM_KEYS[group];
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var input = document.getElementById('set_' + group + '_' + key);
            if (input) {
                input.value = defaults[group][key];
                input.placeholder = '默认 ' + defaults[group][key];
            }
        }
    }
}

/**
 * 从输入框读取值并保存
 */
function saveFromForm() {
    var config = { obc: {}, dcdc: {}, invert: {} };

    for (var group in PARAM_KEYS) {
        var keys = PARAM_KEYS[group];
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var input = document.getElementById('set_' + group + '_' + key);
            if (input) {
                var val = parseFloat(input.value);
                // 填了有效数字就用，否则用默认值
                if (!isNaN(val) && input.value.trim() !== '') {
                    config[group][key] = val;
                } else {
                    config[group][key] = params.getDefaults(group)[key];
                }
            }
        }
    }

    params.save(config);
}

export { init };
