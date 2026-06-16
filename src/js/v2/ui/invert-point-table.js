/**
 * 逆差点位表格组件
 *
 * 列：序号 | 输出电压 | 输出电流 | 输入电压 | 输出功率 | 输出频率 |
 *      总谐波电压Min | 总谐波电压Max | 功率因数Min | 功率因数Max |
 *      效率最小 | 效率最大 | 操作
 *
 * DOM 依赖：
 *   #invertPointTableBody — 表格 tbody
 *   #btnAddInvertPoint — 添加按钮
 */

var _tbody = null;
var _rowCount = 0;

function init() {
    _tbody = document.getElementById('invertPointTableBody');
    if (!_tbody) {
        console.error('[InvertPointTable] 找不到 #invertPointTableBody');
        return;
    }

    var btnAdd = document.getElementById('btnAddInvertPoint');
    if (btnAdd) {
        btnAdd.addEventListener('click', function () {
            addRow();
        });
    }

    addRow();

    // 启用行拖拽排序
    initDragSort(_tbody, renumber);
}

function addRow() {
    if (!_tbody) return;

    _rowCount++;
    var idx = _rowCount;
    var tr = document.createElement('tr');
    tr.setAttribute('data-index', idx);

    // 序号
    var tdSeq = document.createElement('td');
    tdSeq.className = 'col-seq';
    tdSeq.textContent = idx;
    tr.appendChild(tdSeq);

    // KL30电压（可选，默认14）
    tr.appendChild(createInputCell('kl30', 'number', '0.1', false));
    // 输出电压（必填）— 逆变输出AC侧
    tr.appendChild(createInputCell('vout', 'number', '1', true));
    // 输出电流（必填）— 逆变输出AC侧
    tr.appendChild(createInputCell('iout', 'number', '0.1', true));
    // 输入电压（必填）— 逆变输入DC侧
    tr.appendChild(createInputCell('vin', 'number', '1', true));
    // 输出功率（必填）— 用于推算输入电流
    tr.appendChild(createInputCell('pout', 'number', '1', true));
    // 输出频率（可选）
    tr.appendChild(createInputCell('freq', 'number', '0.1', false));
    // 总谐波电压Min（可选）
    tr.appendChild(createInputCell('thdvMin', 'number', '0.1', false));
    // 总谐波电压Max（可选）
    tr.appendChild(createInputCell('thdvMax', 'number', '0.1', false));
    // 功率因数Min（可选）
    tr.appendChild(createInputCell('pfMin', 'number', '0.01', false));
    // 功率因数Max（可选）
    tr.appendChild(createInputCell('pfMax', 'number', '0.01', false));
    // 效率最小（可选）
    tr.appendChild(createInputCell('efficiencyMin', 'number', '0.1', false));
    // 效率最大（可选）
    tr.appendChild(createInputCell('efficiencyMax', 'number', '0.1', false));

    // 操作列
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
    _tbody.dispatchEvent(new CustomEvent('rowchange'));
}

function deleteRow(index) {
    if (!_tbody) return;
    var row = _tbody.querySelector('tr[data-index="' + index + '"]');
    if (!row) return;
    _tbody.removeChild(row);
    renumber();
    _tbody.dispatchEvent(new CustomEvent('rowchange'));
}

function getData() {
    if (!_tbody) return [];
    var rows = _tbody.querySelectorAll('tr');
    var result = [];
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        result.push({
            kl30: getCellValue(row, 'kl30'),
            vout: getCellValue(row, 'vout'),
            iout: getCellValue(row, 'iout'),
            vin: getCellValue(row, 'vin'),
            pout: getCellValue(row, 'pout'),
            freq: getCellValue(row, 'freq'),
            thdvMin: getCellValue(row, 'thdvMin'),
            thdvMax: getCellValue(row, 'thdvMax'),
            pfMin: getCellValue(row, 'pfMin'),
            pfMax: getCellValue(row, 'pfMax'),
            efficiencyMin: getCellValue(row, 'efficiencyMin'),
            efficiencyMax: getCellValue(row, 'efficiencyMax')
        });
    }
    return result;
}

function validate() {
    var data = getData();
    var errors = [];

    if (data.length === 0) {
        return { valid: false, errors: ['至少需要一个逆差点位'] };
    }

    for (var i = 0; i < data.length; i++) {
        var point = data[i];
        var rowNum = i + 1;

        if (point.vout === null || point.vout <= 0) {
            errors.push('逆变第' + rowNum + '行：输出电压必须为正数');
        }
        // 输出电流必须大于等于1（逆变CR模式会用它做除数，不能为0）
        if (point.iout === null || point.iout < 1) {
            errors.push('逆变第' + rowNum + '行：输出电流必须大于等于1');
        }
        if (point.vin === null || point.vin <= 0) {
            errors.push('逆变第' + rowNum + '行：输入电压必须为正数');
        }
        if (point.pout === null || point.pout <= 0) {
            errors.push('逆变第' + rowNum + '行：输出功率必须为正数');
        }
    }

    return { valid: errors.length === 0, errors: errors };
}

// ===== 内部函数 =====

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

function getCellValue(row, field) {
    var input = row.querySelector('input[data-field="' + field + '"]');
    if (!input || input.value === '') return null;
    var val = parseFloat(input.value);
    return isNaN(val) ? null : val;
}

function renumber() {
    if (!_tbody) return;
    var rows = _tbody.querySelectorAll('tr');
    _rowCount = 0;
    for (var i = 0; i < rows.length; i++) {
        _rowCount++;
        var row = rows[i];
        row.setAttribute('data-index', _rowCount);
        row.querySelector('.col-seq').textContent = _rowCount;
        var btnDel = row.querySelector('.btn-danger');
        if (btnDel) {
            btnDel.setAttribute('data-index', _rowCount);
        }
    }
}

/**
 * 行拖拽排序（通用函数）
 */
function initDragSort(tbody, onReorder) {
    var dragRow = null;

    tbody.addEventListener('mousedown', function (e) {
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
            var targetRect = targetRow.getBoundingClientRect();
            if (e.clientY < targetRect.top + targetRect.height / 2) {
                tbody.insertBefore(dragRow, targetRow);
            } else {
                tbody.insertBefore(dragRow, targetRow.nextSibling);
            }
        } else {
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

export { init, addRow, deleteRow, getData, validate };
