/**
 * 导出按钮组件
 *
 * 文件名输入框 + "导出 CFG666" 按钮。
 * 实际的导出逻辑由外部 app.js 绑定（因为依赖 step-builder 的输出）。
 *
 * DOM 依赖：
 *   - #exportFileName — 文件名输入框
 *   - #btnExport — 导出按钮
 */

// ===== 内部状态 =====

/** 导出按钮点击回调 */
var _exportCallback = null;

// ===== 公共 API =====

/**
 * 初始化导出UI
 * 绑定导出按钮点击事件
 * @param {Function} onExport - 点击导出时的回调 function(fileName)
 */
function init(onExport) {
    _exportCallback = onExport;

    var btnExport = document.getElementById('btnExport');
    if (btnExport) {
        btnExport.addEventListener('click', function () {
            if (_exportCallback) {
                _exportCallback(getFileName());
            }
        });
    }
}

/**
 * 获取用户输入的文件名
 * @returns {string}
 */
function getFileName() {
    var el = document.getElementById('exportFileName');
    if (!el) return 'OBC-脚本';
    return el.value || 'OBC-脚本';
}

/**
 * 显示成功提示
 * @param {string} message
 */
function showSuccess(message) {
    showToast(message, 'success');
}

/**
 * 显示错误提示
 * @param {string} message
 */
function showError(message) {
    showToast(message, 'error');
}

// ===== 内部函数 =====

/**
 * Toast 消息（复用全局 showToast，如果没有则用 alert 兜底）
 * @param {string} message
 * @param {string} type
 */
function showToast(message, type) {
    // 尝试使用全局 toast 系统
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }

    // 兜底：用全局 toastContainer 手动创建
    var container = document.getElementById('toastContainer');
    if (container) {
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(function () {
            toast.classList.add('toast-exit');
            setTimeout(function () {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 3000);
        return;
    }

    // 最终兜底
    alert(message);
}

// ===== 导出 =====

export { init, getFileName, showSuccess, showError };
