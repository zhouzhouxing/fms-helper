/**
 * V2 脚本生成器 - 应用入口
 *
 * 支持：OBC单相/OBC三相 + DCDC（可组合或单独）
 */

// ===== 引入所有模块 =====
import * as modeSelector from './ui/mode-selector.js';
import * as pointTable from './ui/point-table.js';
import * as errorParams from './ui/error-params.js';
import * as dcdcPointTable from './ui/dcdc-point-table.js';
import * as dcdcErrorParams from './ui/dcdc-error-params.js';
import * as invertPointTable from './ui/invert-point-table.js';
import * as invertErrorParams from './ui/invert-error-params.js';
import * as preview from './ui/preview.js';
import * as exportUi from './ui/export-ui.js';
import * as stepBuilder from './step-builder.js';
import * as exporter from './exporter.js';
import { initThemeSwitcher } from './ui/theme-switcher.js';
import * as advancedParams from './config/default-params.js';
import * as advancedSettings from './ui/advanced-settings.js';

// ===== 全局状态 =====

var _lastGeneratedSteps = null;
var _lastCfgData = null;
var _checkUpdateStatus = null;  // 检查更新时的状态引用（按钮、提示、超时、关闭回调）

// ===== 初始化 =====

document.addEventListener('DOMContentLoaded', function () {
    // 初始化主题系统
    try { initThemeSwitcher(); } catch (e) { console.error('[Init] 主题系统失败:', e); }

    // 初始化高级参数配置
    try { advancedParams.init(); } catch (e) { console.error('[Init] 高级参数失败:', e); }
    // 初始化高级设置弹窗
    try { advancedSettings.init(); } catch (e) { console.error('[Init] 高级设置弹窗失败:', e); }

    // 初始化 UI 组件（每个都用try-catch防阻塞）
    try { modeSelector.init(); } catch (e) { console.error('[Init] 模式选择器失败:', e); }
    try { pointTable.init(); } catch (e) { console.error('[Init] OBC点位表失败:', e); }
    try { errorParams.init(); } catch (e) { console.error('[Init] OBC误差参数失败:', e); }
    try { dcdcPointTable.init(); } catch (e) { console.error('[Init] DCDC点位表失败:', e); }
    try { dcdcErrorParams.init(); } catch (e) { console.error('[Init] DCDC误差参数失败:', e); }
    try { invertPointTable.init(); } catch (e) { console.error('[Init] 逆差点位表失败:', e); }
    try { invertErrorParams.init(); } catch (e) { console.error('[Init] 逆变误差参数失败:', e); }
    try { initModeChips(); } catch (e) { console.error('[Init] 模式芯片失败:', e); }

    // 默认：OBC单相 + DCDC，同步显示
    syncSectionVisibility();

    // 生成按钮
    var btnGenerate = document.getElementById('btnGenerate');
    if (btnGenerate) {
        btnGenerate.addEventListener('click', function () {
            handleGenerate();
        });
    }

    // 导出按钮
    exportUi.init(function (fileName) {
        handleExport(fileName);
    });

    // 关于按钮
    var btnAbout = document.getElementById('btnAbout');
    if (btnAbout) {
        btnAbout.addEventListener('click', function () {
            var modal = document.getElementById('aboutModal');
            var btnOk = document.getElementById('btnAboutOk');
            var dateEl = document.getElementById('aboutBuildDate');
            var statusEl = document.getElementById('aboutUpdateStatus');
            // 从版本号标签同步到关于弹窗
            var versionTag = document.querySelector('.version-number');
            var aboutVersion = document.getElementById('aboutVersion');
            if (versionTag && aboutVersion) aboutVersion.textContent = versionTag.textContent;
            if (!modal) return;
            if (dateEl) dateEl.textContent = '构建日期：' + new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
            if (statusEl) statusEl.textContent = '';
            modal.classList.add('active');
            function onClose() {
                modal.classList.remove('active');
                btnOk.removeEventListener('click', onClose);
            }
            btnOk.addEventListener('click', onClose);
            // 关于弹窗不响应遮罩点击关闭

            // 检查更新按钮
            var btnCheck = document.getElementById('btnCheckUpdate');
            if (btnCheck) {
                btnCheck.onclick = function () {
                    if (window.api && window.api.checkForUpdates) {
                        btnCheck.disabled = true;
                        btnCheck.textContent = '检查中...';
                        if (statusEl) statusEl.textContent = '正在检查更新...';

                        // 记录关于弹窗的状态，供initAutoUpdate里的监听器使用
                        _checkUpdateStatus = { btnCheck: btnCheck, statusEl: statusEl, timeout: null, onClose: onClose };

                        _checkUpdateStatus.timeout = setTimeout(function () {
                            btnCheck.disabled = false;
                            btnCheck.textContent = '检查更新';
                            if (statusEl) statusEl.textContent = '✓ 已是最新版本';
                            _checkUpdateStatus = null;
                        }, 5000);

                        window.api.checkForUpdates();
                    } else {
                        if (statusEl) statusEl.textContent = '此功能需要安装版';
                    }
                };
            }
        });
    }

    // 模式切换时：同步显示/隐藏 + 清空预览
    modeSelector.onModeChange(function () {
        syncSectionVisibility();
        preview.clear('测试模式已切换，请重新生成脚本');
        _lastGeneratedSteps = null;
        _lastCfgData = null;
        updatePointCounts();
    });

    // 监听点位表格的行变化，更新计数
    ['pointTableBody', 'dcdcPointTableBody', 'invertPointTableBody'].forEach(function (id) {
        var tbody = document.getElementById(id);
        if (tbody) {
            tbody.addEventListener('rowchange', function () {
                updatePointCounts();
            });
        }
    });

    // 初始计数
    updatePointCounts();

    console.log('[FMS Helper V2] 应用初始化完成');
});

// ===== 显示/隐藏控制 =====

function syncSectionVisibility() {
    var showObc = modeSelector.hasObc();
    var showDcdc = modeSelector.hasDcdc();
    var showInvert = modeSelector.isInvert();
    var mixed = modeSelector.isMixed();

    // OBC区域
    var obcSections = document.querySelectorAll('.obc-section');
    for (var i = 0; i < obcSections.length; i++) {
        obcSections[i].style.display = showObc ? '' : 'none';
    }

    // DCDC区域
    var dcdcSections = document.querySelectorAll('.dcdc-section');
    for (var j = 0; j < dcdcSections.length; j++) {
        dcdcSections[j].style.display = showDcdc ? '' : 'none';
    }

    // 逆变区域
    var invertSections = document.querySelectorAll('.invert-section');
    for (var k = 0; k < invertSections.length; k++) {
        invertSections[k].style.display = showInvert ? '' : 'none';
    }

    // OBC三相专属字段（混合模式也显示，因为可能有三相点位）
    // 同时包含mixed模式，因为混合模式下输入电压类型勾选框也需要显示
    if (showObc) {
        var obcMode = modeSelector.getObcMode();
        var obcVisMode = (obcMode === 'mixed' || obcMode === 'three') ? 'obc-three' : 'obc-single';
        errorParams.syncModeVisibility(obcVisMode);
    }

    // OBC点位表格中的"三相"勾选列（仅混合模式显示）
    var triCol = document.querySelectorAll('.tri-phase-col');
    for (var m = 0; m < triCol.length; m++) {
        triCol[m].style.display = mixed ? '' : 'none';
    }
}

// ===== 生成逻辑 =====

// ===== 格式化校验错误（多行显示，最多5条）=====
function formatErrors(prefix, errors) {
    var maxShow = 5;
    var shown = errors.slice(0, maxShow);
    var text = prefix + '：\n' + shown.map(function (e) { return '· ' + e; }).join('\n');
    if (errors.length > maxShow) {
        text += '\n（还有' + (errors.length - maxShow) + '个错误，请检查其他行）';
    }
    return text;
}

function handleGenerate() {
    var mode = modeSelector.getMode();
    var hasObc = modeSelector.hasObc();
    var hasDcdc = modeSelector.hasDcdc();
    var hasInvert = modeSelector.isInvert();

    // 校验点位数据
    if (hasObc) {
        var obcValidation = pointTable.validate();
        if (!obcValidation.valid) {
            showToast(formatErrors('OBC数据校验失败', obcValidation.errors), 'error');
            return;
        }
        // 校验OBC误差参数
        var obcEpValidation = errorParams.validate();
        if (!obcEpValidation.valid) {
            showToast(formatErrors('OBC误差参数校验失败', obcEpValidation.errors), 'error');
            return;
        }
        // 校验频率误差：如果有任意点位填了频率，则频率误差必填
        var obcPoints = pointTable.getData();
        var hasFreq = obcPoints.some(function (p) { return p.freq != null && p.freq > 0; });
        if (hasFreq) {
            var obcEp = errorParams.getData();
            if (obcEp.freqError === null) {
                showToast('OBC误差参数：测试点位中填写了频率，请填写频率误差', 'error');
                return;
            }
        }
    }

    if (hasDcdc) {
        var dcdcValidation = dcdcPointTable.validate();
        if (!dcdcValidation.valid) {
            showToast(formatErrors('DCDC数据校验失败', dcdcValidation.errors), 'error');
            return;
        }
        // 校验DCDC误差参数
        var dcdcEpValidation = dcdcErrorParams.validate();
        if (!dcdcEpValidation.valid) {
            showToast(formatErrors('DCDC误差参数校验失败', dcdcEpValidation.errors), 'error');
            return;
        }
    }

    if (hasInvert) {
        var invertValidation = invertPointTable.validate();
        if (!invertValidation.valid) {
            showToast(formatErrors('逆变数据校验失败', invertValidation.errors), 'error');
            return;
        }
        // 校验逆变误差参数
        var invertEpValidation = invertErrorParams.validate();
        if (!invertEpValidation.valid) {
            showToast(formatErrors('逆变误差参数校验失败', invertEpValidation.errors), 'error');
            return;
        }
        // 校验频率误差：如果有任意点位填了频率，则频率误差必填
        var invertPoints = invertPointTable.getData();
        var hasInvertFreq = invertPoints.some(function (p) { return p.freq != null && p.freq > 0; });
        if (hasInvertFreq) {
            var invertEp = invertErrorParams.getData();
            if (invertEp.freqError === null) {
                showToast('逆变误差参数：测试点位中填写了频率，请填写频率误差', 'error');
                return;
            }
        }
    }

    if (!hasObc && !hasDcdc && !hasInvert) {
        showToast('请选择一种测试模式', 'error');
        return;
    }

    // 收集数据
    var obcPoints = hasObc ? pointTable.getData() : [];
    var obcEp = hasObc ? errorParams.getData() : {};
    var dcdcPoints = hasDcdc ? dcdcPointTable.getData() : [];
    var dcdcEp = hasDcdc ? dcdcErrorParams.getData() : {};
    var invertPoints = hasInvert ? invertPointTable.getData() : [];
    var invertEp = hasInvert ? invertErrorParams.getData() : {};

    // 组装步骤
    try {
        var configParas = stepBuilder.buildAllSteps(
            obcPoints, dcdcPoints, invertPoints,
            mode, obcEp, dcdcEp, invertEp
        );
        var configName = generateConfigName(mode);
        var cfgData = stepBuilder.buildCFG666(configParas, configName);

        _lastGeneratedSteps = configParas;
        _lastCfgData = cfgData;

        // 渲染预览
        var previewSteps = [];
        for (var i = 0; i < configParas.length; i++) {
            var cp = configParas[i];
            var summary = extractFieldSummary(cp.TempletValue);
            previewSteps.push({
                step: i + 1,
                name: cp.TempletName,
                type: cp.TempletType,
                testItem: cp.FuncDesc || cp.TestItem,
                fields: summary
            });
        }
        preview.render(previewSteps);

        // 更新默认导出文件名
        var fileNameInput = document.getElementById('exportFileName');
        if (fileNameInput) {
            fileNameInput.value = configName;
        }

        showToast('生成成功！共 ' + configParas.length + ' 步', 'success');
        updateStepCount(configParas.length);

    } catch (err) {
        showToast('生成失败：' + err.message, 'error');
        console.error('[FMS Helper V2] 生成失败:', err);
    }
}

// ===== 导出逻辑 =====

async function handleExport(fileName) {
    if (!_lastCfgData) {
        showToast('请先点击"生成脚本"', 'warning');
        return;
    }

    // 配置名称跟输入框保持一致
    if (fileName && fileName.trim()) {
        _lastCfgData.ConfigName = fileName.trim();
    }

    var defaultName = (fileName || '配置') + '.CFG666';

    try {
        var result = await exporter.exportCFG666(_lastCfgData, defaultName);

        if (result.canceled) return;

        if (result.success) {
            showToast('导出成功！文件：' + result.filePath, 'success');
        } else {
            showToast('导出失败：' + result.error, 'error');
        }
    } catch (err) {
        showToast('导出出错：' + err.message, 'error');
        console.error('[FMS Helper V2] 导出失败:', err);
    }
}

// ===== 辅助函数 =====

function extractFieldSummary(templetValue) {
    if (!templetValue) return {};
    var summary = {};
    var entries = templetValue.split('\u00A7');
    var count = 0;
    var maxFields = 50;

    for (var i = 0; i < entries.length && count < maxFields; i++) {
        var parts = entries[i].split('\u2225');
        if (parts.length >= 2) {
            summary[parts[0]] = parts[1];
            count++;
        }
    }

    if (entries.length > maxFields) {
        summary['...'] = '共 ' + entries.length + ' 个字段';
    }

    return summary;
}

function generateConfigName(mode) {
    var names = {
        'obc-single': 'OBC单相',
        'obc-three': 'OBC三相',
        'obc-mixed': 'OBC单相+三相',
        'obc-single-dcdc': 'OBC单相-DCDC',
        'obc-three-dcdc': 'OBC三相-DCDC',
        'obc-mixed-dcdc': 'OBC单相+三相-DCDC',
        'dcdc-only': 'DCDC',
        'invert': '逆变'
    };
    return (names[mode] || '脚本') + '-脚本';
}

// ===== 全局工具函数 =====

window.showToast = function (message, type, duration) {
    type = type || 'info';
    // 错误类型默认显示6秒，其他3秒
    duration = duration || (type === 'error' ? 6000 : 3000);

    var container = document.getElementById('toastContainer');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(function () {
        toast.classList.add('toast-exit');
        setTimeout(function () {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, duration);
};

window.showConfirm = function (message, title) {
    return new Promise(function (resolve) {
        var modal = document.getElementById('confirmModal');
        var titleEl = document.getElementById('confirmTitle');
        var msgEl = document.getElementById('confirmMessage');
        var btnOk = document.getElementById('btnConfirmOk');
        var btnCancel = document.getElementById('btnConfirmCancel');

        if (!modal) { resolve(false); return; }

        titleEl.textContent = title || '确认';
        msgEl.textContent = message;
        modal.classList.add('active');

        function cleanup() {
            modal.classList.remove('active');
            btnOk.removeEventListener('click', onOk);
            btnCancel.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onOverlay);
        }

        function onOk() { cleanup(); resolve(true); }
        function onCancel() { cleanup(); resolve(false); }
        function onOverlay(e) { if (e.target === modal) { cleanup(); resolve(false); } }

        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
        modal.addEventListener('click', onOverlay);
    });
};

// ===== 模式芯片点击绑定 =====
function initModeChips() {
    var chips = document.querySelectorAll('.mode-chip');
    var select = document.getElementById('testMode');
    chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
            var mode = chip.dataset.mode;
            // 更新芯片选中状态
            chips.forEach(function (c) { c.classList.remove('active'); });
            chip.classList.add('active');
            // 同步到隐藏select
            if (select) {
                select.value = mode;
                // 触发change事件
                select.dispatchEvent(new Event('change'));
            }
        });
    });

    // 监听 select 变化，同步芯片状态
    if (select) {
        select.addEventListener('change', function () {
            chips.forEach(function (c) {
                c.classList.toggle('active', c.dataset.mode === select.value);
            });
        });
    }
}

// ===== 更新点位计数 =====
export function updatePointCounts() {
    var obcBody = document.getElementById('pointTableBody');
    var dcdcBody = document.getElementById('dcdcPointTableBody');
    var invertBody = document.getElementById('invertPointTableBody');

    var obcCount = document.getElementById('obcPointCount');
    var dcdcCount = document.getElementById('dcdcPointCount');
    var invertCount = document.getElementById('invertPointCount');

    if (obcCount && obcBody) obcCount.textContent = obcBody.children.length;
    if (dcdcCount && dcdcBody) dcdcCount.textContent = dcdcBody.children.length;
    if (invertCount && invertBody) invertCount.textContent = invertBody.children.length;
}

// ===== 更新步骤计数 =====
export function updateStepCount(count) {
    var el = document.getElementById('stepCount');
    if (el) el.textContent = count + '步';
}

// ===== 自动更新事件监听 =====
// 通过 preload.js 暴露的 window.api 接收主进程的更新事件

function initAutoUpdate() {
    if (!window.api || !window.api.onUpdateAvailable) return; // 非Electron环境跳过

    var updateBar = document.getElementById('updateBar');
    var updateText = document.getElementById('updateText');
    var updateProgress = document.getElementById('updateProgress');
    var updateProgressBar = document.getElementById('updateProgressBar');
    var btnInstall = document.getElementById('btnUpdateInstall');
    var btnDismiss = document.getElementById('btnUpdateDismiss');
    if (!updateBar) return;

    // 发现有新版本 → 显示下载中
    window.api.onUpdateAvailable(function (info) {
        updateBar.style.display = 'flex';
        updateText.textContent = '📦 发现新版本 v' + info.version + '，正在下载...';
        updateProgress.style.display = 'block';

        // 如果关于弹窗里点了"检查更新"，同步反馈
        if (_checkUpdateStatus) {
            clearTimeout(_checkUpdateStatus.timeout);
            _checkUpdateStatus.btnCheck.disabled = false;
            _checkUpdateStatus.btnCheck.textContent = '检查更新';
            if (_checkUpdateStatus.statusEl) {
                _checkUpdateStatus.statusEl.textContent = '✓ 发现新版本 v' + info.version + '，正在下载...';
            }
            var cb = _checkUpdateStatus.onClose;
            _checkUpdateStatus = null;
            // 1.5秒后自动关闭关于弹窗，让用户看到顶部更新进度条
            setTimeout(function () { cb(); }, 1500);
        }
    });

    // 下载进度
    window.api.onUpdateProgress(function (percent) {
        updateProgressBar.style.width = percent + '%';
        if (percent < 100) {
            updateText.textContent = '📦 下载中 ' + percent + '%';
        }
    });

    // 下载完成 → 显示安装按钮
    window.api.onUpdateDownloaded(function (info) {
        updateProgressBar.style.width = '100%';
        updateText.textContent = '✅ 新版本 v' + info.version + ' 已就绪';
        updateProgress.style.display = 'none';
        btnInstall.style.display = 'inline-block';
        btnDismiss.style.display = 'inline-block';
    });

    // 点"立即重启"
    if (btnInstall) {
        btnInstall.addEventListener('click', function () {
            window.api.installUpdate();
        });
    }

    // 点"稍后" → 隐藏提示条
    if (btnDismiss) {
        btnDismiss.addEventListener('click', function () {
            updateBar.style.display = 'none';
        });
    }
}

// 延迟初始化更新检查（等页面渲染完）
setTimeout(initAutoUpdate, 1000);

// ===== 更新公告弹窗 =====
// 版本号变了首次打开自动弹，点"知道了"记录版本号，不再重复弹

function initChangelog() {
    var modal = document.getElementById('changelogModal');
    if (!modal) return;

    var btnOk = document.getElementById('btnChangelogOk');
    var changelogVersion = document.getElementById('changelogVersion');

    // 弹出更新公告
    function showChangelog() {
        modal.classList.add('active');
    }

    // 关闭并记录已看过
    function closeChangelog() {
        modal.classList.remove('active');
        // 记录当前版本号到localStorage，下次不再弹
        try {
            var version = document.querySelector('.version-number');
            if (version) localStorage.setItem('fms_seen_changelog', version.textContent);
        } catch (e) {
            console.warn('[changelog] 记录版本号失败:', e);
        }
    }

    // "知道了"按钮
    if (btnOk) {
        btnOk.addEventListener('click', closeChangelog);
    }

    // 关于弹窗里的"查看更新日志"链接
    var changelogLink = document.getElementById('aboutChangelogLink');
    if (changelogLink) {
        changelogLink.addEventListener('click', function () {
            // 关闭关于弹窗，打开更新公告
            var aboutModal = document.getElementById('aboutModal');
            if (aboutModal) aboutModal.classList.remove('active');
            showChangelog();
        });
    }

    // 启动时检查是否需要弹更新公告
    // 当前版本跟localStorage记录的版本不一样就弹
    function checkAndShow() {
        var versionEl = document.querySelector('.version-number');
        if (!versionEl) return;
        var currentVersion = versionEl.textContent; // 如 "v2.3.0"

        var seenVersion = '';
        try {
            seenVersion = localStorage.getItem('fms_seen_changelog') || '';
        } catch (e) {
            // localStorage不可用，不弹
        }

        // 版本号不一样就弹（首次安装也会弹，因为seenVersion为空）
        if (currentVersion !== seenVersion) {
            // 同步版本号到弹窗标题
            if (changelogVersion) changelogVersion.textContent = currentVersion;
            // 延迟1秒弹，避免跟启动更新检查冲突
            setTimeout(showChangelog, 1000);
        }
    }

    checkAndShow();
}

setTimeout(initChangelog, 1500);
