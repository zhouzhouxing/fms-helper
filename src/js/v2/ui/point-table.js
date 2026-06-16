/**
 * 点位表格组件
 *
 * 管理测试点位数据的增删改查。
 * 用户在这里输入 N 个点位（Vin/Vout/Iout/Pout 等），
 * 后续交给 calculator 推算所有步骤。
 *
 * DOM 依赖：
 *   - #pointTableBody — 表格 tbody
 *   - #btnAddPoint — "添加点位"按钮
 */

// ===== 内部状态 =====

/** 表格引用 */
var _tbody = null;

/** 当前行数（用于序号） */
var _rowCount = 0;

// ===== 公共 API =====

/**
 * 初始化表格
 * 绑定"添加点位"按钮，添加一行默认空行
 */
function init() {
    _tbody = document.getElementById('pointTableBody');
    if (!_tbody) {
        console.error('[PointTable] 找不到 #pointTableBody');
        return;
    }

    // 绑定"添加点位"按钮
    var btnAdd = document.getElementById('btnAddPoint');
    if (btnAdd) {
        btnAdd.addEventListener('click', function () {
            addRow();
        });
    }

    // 默认添加一行空行
    addRow();

    // 启用行拖拽排序
    initDragSort(_tbody, renumber);
}

/**
 * 添加一行空行
 * 序号自动递增
 */
function addRow() {
    if (!_tbody) return;

    _rowCount++;
    var idx = _rowCount;
    var tr = document.createElement('tr');
    tr.setAttribute('data-index', idx);

    // 序号（只读）
    var tdSeq = document.createElement('td');
    tdSeq.className = 'col-seq';
    tdSeq.textContent = idx;
    tr.appendChild(tdSeq);

    // KL30电压（可选）
    tr.appendChild(createInputCell('kl30', 'number', '0.1', false));
    // Vin（必填）
    tr.appendChild(createInputCell('vin', 'number', '1', true));
    // Freq（可选）
    tr.appendChild(createInputCell('freq', 'number', '0.1', false));
    // Vout（必填）
    tr.appendChild(createInputCell('vout', 'number', '1', true));
    // Iout（可选）
    tr.appendChild(createInputCell('iout', 'number', '0.1', false));
    // Pout（必填）
    tr.appendChild(createInputCell('pout', 'number', '1', true));
    // PF 功率因数最小（可选）
    tr.appendChild(createInputCell('pfMin', 'number', '0.01', false));
    // PF 功率因数最大（可选）
    tr.appendChild(createInputCell('pfMax', 'number', '0.01', false));
    // 效率最小（可选）
    tr.appendChild(createInputCell('efficiencyMin', 'number', '0.1', false));
    // 效率最大（可选）
    tr.appendChild(createInputCell('efficiencyMax', 'number', '0.1', false));
    // Iin（可选）
    tr.appendChild(createInputCell('iin', 'number', '0.1', false));

    // 三相勾选（可选，默认不勾选）
    // 如果当前是混合模式，需要显示这一列
    var tdTri = document.createElement('td');
    tdTri.className = 'tri-phase-col';
    // 检查是否已有可见的三相列（即当前处于混合模式）
    var existingTriCols = document.querySelectorAll('.tri-phase-col');
    var triVisible = existingTriCols.length > 0 && existingTriCols[0].style.display !== 'none';
    tdTri.style.display = triVisible ? '' : 'none';
    var cbTri = document.createElement('input');
    cbTri.type = 'checkbox';
    cbTri.setAttribute('data-field', 'isThreePhase');
    tdTri.appendChild(cbTri);
    tr.appendChild(tdTri);

    // 操作列（删除按钮）
    var tdAction = document.createElement('td');
    tdAction.className = 'col-action';
    var btnDel = document.createElement('button');
    btnDel.className = 'btn btn-danger btn-sm';
    btnDel.textContent = '删除';
    btnDel.setAttribute('data-index', idx);
    btnDel.addEventListener('click', function () {
        deleteRow(parseInt(this.getAttribute('data-index'), 10));
    });
    tdAction.appendChild(btnDel);
    tr.appendChild(tdAction);

    _tbody.appendChild(tr);
    // 通知外部更新点位计数
    _tbody.dispatchEvent(new CustomEvent('rowchange'));
}

/**
 * 删除指定行
 * 删除后重新编号
 * @param {number} index - 要删除的行序号
 */
function deleteRow(index) {
    if (!_tbody) return;

    // 找到要删除的行
    var row = _tbody.querySelector('tr[data-index="' + index + '"]');
    if (!row) return;

    _tbody.removeChild(row);

    // 重新编号
    renumber();
    // 通知外部更新点位计数
    _tbody.dispatchEvent(new CustomEvent('rowchange'));
}

/**
 * 获取所有点位数据
 * @returns {Array<{vin: number|null, freq: number|null, vout: number|null, iout: number|null, pout: number|null, pf: number|null, efficiencyMin: number|null, efficiencyMax: number|null, iin: number|null}>}
 */
function getData() {
    if (!_tbody) return [];

    var rows = _tbody.querySelectorAll('tr');
    var result = [];

    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        result.push({
            kl30: getCellValue(row, 'kl30'),
            vin: getCellValue(row, 'vin'),
            freq: getCellValue(row, 'freq'),
            vout: getCellValue(row, 'vout'),
            iout: getCellValue(row, 'iout'),
            pout: getCellValue(row, 'pout'),
            pfMin: getCellValue(row, 'pfMin'),
            pfMax: getCellValue(row, 'pfMax'),
            efficiencyMin: getCellValue(row, 'efficiencyMin'),
            efficiencyMax: getCellValue(row, 'efficiencyMax'),
            iin: getCellValue(row, 'iin'),
            isThreePhase: getCheckboxValue(row, 'isThreePhase')
        });
    }

    return result;
}

/**
 * 校验所有点位
 * 必填字段：Vin, Vout, Pout
 * 数值必须是正数
 * 效率范围 0~100，min ≤ max
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validate() {
    var data = getData();
    var errors = [];

    if (data.length === 0) {
        return { valid: false, errors: ['至少需要一个测试点位'] };
    }

    for (var i = 0; i < data.length; i++) {
        var point = data[i];
        var rowNum = i + 1;

        if (point.vin === null || point.vin <= 0) {
            errors.push('第' + rowNum + '行：输入电压必须为正数');
        }
        if (point.vout === null || point.vout <= 0) {
            errors.push('第' + rowNum + '行：输出电压必须为正数');
        }
        if (point.pout === null || point.pout <= 0) {
            errors.push('第' + rowNum + '行：输出功率必须为正数');
        }

        // 效率范围可选校验：填了就验，不填跳过
        if (point.efficiencyMin !== null) {
            if (point.efficiencyMin <= 0 || point.efficiencyMin > 100) {
                errors.push('第' + rowNum + '行：效率最小必须在 0~100 之间');
            }
        }
        if (point.efficiencyMax !== null) {
            if (point.efficiencyMax <= 0 || point.efficiencyMax > 100) {
                errors.push('第' + rowNum + '行：效率最大必须在 0~100 之间');
            }
        }
        if (point.efficiencyMin !== null && point.efficiencyMax !== null
            && point.efficiencyMin > point.efficiencyMax) {
            errors.push('第' + rowNum + '行：效率最小不能大于效率最大');
        }
    }

    return { valid: errors.length === 0, errors: errors };
}

// ===== 内部函数 =====

/**
 * 创建一个带 input 的 td 单元格
 * @param {string} field - 字段名（如 'vin'）
 * @param {string} type - input type（如 'number'）
 * @param {string} step - 步进值
 * @param {boolean} required - 是否必填
 * @returns {HTMLTableCellElement}
 */
function createInputCell(field, type, step, required) {
    var td = document.createElement('td');
    var input = document.createElement('input');
    input.type = type;
    input.step = step;
    input.setAttribute('data-field', field);
    if (required) {
        input.setAttribute('data-required', 'true');
    }
    td.appendChild(input);
    return td;
}

/**
 * 从行中获取指定字段的数值
 * @param {HTMLTableRowElement} row
 * @param {string} field
 * @returns {number|null}
 */
function getCellValue(row, field) {
    var input = row.querySelector('input[data-field="' + field + '"]');
    if (!input || input.value === '') return null;
    var val = parseFloat(input.value);
    return isNaN(val) ? null : val;
}

/**
 * 从行中获取指定字段的勾选状态
 */
function getCheckboxValue(row, field) {
    var cb = row.querySelector('input[type="checkbox"][data-field="' + field + '"]');
    if (!cb) return false;
    return cb.checked;
}

/**
 * 重新编号所有行
 * 删除行后序号会乱，需要重新排列
 */
function renumber() {
    if (!_tbody) return;

    var rows = _tbody.querySelectorAll('tr');
    _rowCount = 0;

    for (var i = 0; i < rows.length; i++) {
        _rowCount++;
        var row = rows[i];
        row.setAttribute('data-index', _rowCount);

        // 更新序号
        row.querySelector('.col-seq').textContent = _rowCount;

        // 更新删除按钮的 data-index
        var btnDel = row.querySelector('.btn-danger');
        if (btnDel) {
            btnDel.setAttribute('data-index', _rowCount);
        }
    }
}

/**
 * 行拖拽排序（通用函数）
 * 按住序号列拖拽行进行上下移动，松开后重新编号
 */
function initDragSort(tbody, onReorder) {
    var dragRow = null;

    tbody.addEventListener('mousedown', function (e) {
        // 只有点击序号列才能拖拽
        var td = e.target.closest('.col-seq');
        if (!td) return;
        var tr = td.closest('tr');
        if (!tr) return;

        dragRow = tr;
        dragRow.classList.add('dragging');
        e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
        if (!dragRow) return;

        // 找到鼠标下方的行
        var rows = Array.from(tbody.querySelectorAll('tr:not(.dragging)'));
        var targetRow = null;

        for (var i = rows.length - 1; i >= 0; i--) {
            var rect = rows[i].getBoundingClientRect();
            if (e.clientY > rect.top) {
                targetRow = rows[i];
                break;
            }
        }

        if (targetRow) {
            // 判断在目标行上方还是下方
            var targetRect = targetRow.getBoundingClientRect();
            var midY = targetRect.top + targetRect.height / 2;
            if (e.clientY < midY) {
                tbody.insertBefore(dragRow, targetRow);
            } else {
                tbody.insertBefore(dragRow, targetRow.nextSibling);
            }
        } else {
            // 移到最前面
            tbody.insertBefore(dragRow, tbody.firstChild);
        }
    });

    document.addEventListener('mouseup', function () {
        if (!dragRow) return;
        dragRow.classList.remove('dragging');
        dragRow = null;
        if (onReorder) onReorder();
    });
}

// ===== 导出 =====

export { init, addRow, deleteRow, getData, validate };
