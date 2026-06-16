/**
 * DCDC点位表格组件
 *
 * 列：序号 | KL30(可选) | Vin | Iin(可选) | Vout | Iout(可选) | Pout | 效率最小 | 效率最大 | 操作
 *
 * DOM 依赖：
 *   #dcdcPointTableBody — 表格 tbody
 *   #btnAddDcdcPoint — 添加按钮
 */

var _tbody = null;
var _rowCount = 0;

function init() {
    _tbody = document.getElementById('dcdcPointTableBody');
    if (!_tbody) {
        console.error('[DCDCPointTable] 找不到 #dcdcPointTableBody');
        return;
    }

    var btnAdd = document.getElementById('btnAddDcdcPoint');
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

    // KL30电压（可选）
    tr.appendChild(createInputCell('kl30', 'number', '0.1', false));
    // Vin（必填）
    tr.appendChild(createInputCell('vin', 'number', '1', true));
    // Iin（可选）
    tr.appendChild(createInputCell('iin', 'number', '0.1', false));
    // Vout（必填）
    tr.appendChild(createInputCell('vout', 'number', '1', true));
    // Iout（可选）
    tr.appendChild(createInputCell('iout', 'number', '0.1', false));
    // Pout（必填）
    tr.appendChild(createInputCell('pout', 'number', '1', true));
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

    // KL30联动：vout变化时，如果KL30没被用户手动改过，自动填 KL30 = vout - 0.5
    bindKl30AutoFill(tr);
}

/**
 * DCDC点位KL30自动联动
 * 规则：用户填vout后，如果KL30为空或未被手动修改过，自动算 KL30 = vout - 0.5
 *       用户手动改过KL30后，不再自动覆盖
 */
function bindKl30AutoFill(row) {
    var kl30Input = row.querySelector('input[data-field="kl30"]');
    var voutInput = row.querySelector('input[data-field="vout"]');
    if (!kl30Input || !voutInput) return;

    // 用属性标记KL30是否被用户手动改过
    kl30Input.setAttribute('data-user-modified', 'false');

    // 监听KL30手动修改
    kl30Input.addEventListener('input', function () {
        kl30Input.setAttribute('data-user-modified', 'true');
    });

    // 监听vout变化，联动KL30
    voutInput.addEventListener('input', function () {
        var modified = kl30Input.getAttribute('data-user-modified');
        if (modified === 'true') return; // 用户改过就不覆盖

        var voutVal = parseFloat(voutInput.value);
        if (!isNaN(voutVal) && voutVal > 0) {
            kl30Input.value = Math.round((voutVal - 0.5) * 100) / 100; // 保留2位小数
        } else {
            // vout清空或无效时，KL30也清空
            kl30Input.value = '';
        }
    });
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
            vin: getCellValue(row, 'vin'),
            iin: getCellValue(row, 'iin'),
            vout: getCellValue(row, 'vout'),
            iout: getCellValue(row, 'iout'),
            pout: getCellValue(row, 'pout'),
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
        return { valid: false, errors: ['至少需要一个DCDC测试点位'] };
    }

    for (var i = 0; i < data.length; i++) {
        var point = data[i];
        var rowNum = i + 1;

        if (point.vin === null || point.vin <= 0) {
            errors.push('DCDC第' + rowNum + '行：输入电压必须为正数');
        }
        if (point.vout === null || point.vout <= 0) {
            errors.push('DCDC第' + rowNum + '行：输出电压必须为正数');
        }
        if (point.pout === null || point.pout <= 0) {
            errors.push('DCDC第' + rowNum + '行：输出功率必须为正数');
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
