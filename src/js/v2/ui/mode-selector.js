/**
 * 模式选择组件
 *
 * 单下拉框，8种测试模式：
 *   obc-single          — OBC单相
 *   obc-three           — OBC三相
 *   obc-mixed           — OBC单相+三相（混合，点位勾选三相）
 *   obc-single-dcdc     — OBC单相+DCDC
 *   obc-three-dcdc      — OBC三相+DCDC
 *   obc-mixed-dcdc      — OBC单相+三相+DCDC
 *   dcdc-only           — DCDC单独
 *   invert              — 逆变单独
 *
 * DOM 依赖：
 *   #testMode — 模式下拉
 */

// ===== 内部状态 =====

var _mode = 'obc-single';
var _callbacks = [];

// ===== 公共 API =====

function init() {
    var sel = document.getElementById('testMode');
    if (sel) {
        sel.addEventListener('change', function () {
            _mode = this.value;
            notifyChange();
        });
    }
}

/**
 * 获取当前模式
 * @returns {string} 模式值
 */
function getMode() {
    return _mode;
}

/**
 * 是否包含OBC
 */
function hasObc() {
    return _mode.indexOf('obc') !== -1;
}

/**
 * 是否包含DCDC
 */
function hasDcdc() {
    return _mode.indexOf('dcdc') !== -1;
}

/**
 * 是否为逆变模式
 */
function isInvert() {
    return _mode === 'invert';
}

/**
 * 是否为混合模式（OBC单相+三相）
 */
function isMixed() {
    return _mode === 'obc-mixed' || _mode === 'obc-mixed-dcdc';
}

/**
 * 获取OBC子模式（'single'|'three'|'mixed'）
 */
function getObcMode() {
    if (_mode === 'obc-three' || _mode === 'obc-three-dcdc') return 'three';
    if (_mode === 'obc-mixed' || _mode === 'obc-mixed-dcdc') return 'mixed';
    return 'single';
}

function onModeChange(callback) {
    if (typeof callback === 'function') {
        _callbacks.push(callback);
    }
}

// ===== 内部函数 =====

function notifyChange() {
    for (var i = 0; i < _callbacks.length; i++) {
        _callbacks[i](_mode);
    }
}

// ===== 导出 =====

export { init, getMode, hasObc, hasDcdc, isInvert, isMixed, getObcMode, onModeChange };
