const API_URL = 'https://script.google.com/macros/s/AKfycbwedrbiU38D5MyNnnWXJB8aSF9EEn8XuoyTrHD_6KZkF16YF0nXyuT5l8f04np1QeUW/exec';
const SHEETS = ['PENGUMUMAN', 'UANG KAS', 'IURAN BULANAN', 'JADWAL RONDA'];
const BOOLEAN_SHEETS = ['IURAN BULANAN', 'JADWAL RONDA'];

let currentSheet = SHEETS[0];
let currentHeaders = [];
let currentAction = 'create';
let currentRowNumber = null;
let rowCache = {};
let booleanChanges = {};

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadData(currentSheet);
    document.getElementById('dataForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
});

function initTabs() {
    const tabs = document.getElementById('sheetTabs');
    SHEETS.forEach((s, i) => {
        const btn = document.createElement('button');
        btn.className = `nav-link ${i === 0 ? 'active' : ''}`;
        btn.textContent = s;
        btn.onclick = () => switchSheet(s, btn);
        tabs.appendChild(btn);
    });
}

function switchSheet(sheet, btn) {
    document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSheet = sheet;
    document.getElementById('sheetTitle').innerText = sheet;
    loadData(sheet);
}

async function loadData(sheet) {
    showLoader(true);
    const res = await fetch(`${API_URL}?sheet=${sheet}`);
    const json = await res.json();
    currentHeaders = json.headers;
    renderTable(json.headers, json.rows);
    showLoader(false);
}

function renderTable(headers, rows) {
    rowCache = {};
    const thead = document.querySelector('#dataTable thead');
    const tbody = document.querySelector('#dataTable tbody');
    thead.innerHTML = '';
    tbody.innerHTML = '';

    const tr = document.createElement('tr');
    headers.forEach(h => tr.innerHTML += `<th>${h}</th>`);
    tr.innerHTML += `<th>Aksi</th>`;
    thead.appendChild(tr);

    rows.forEach(row => {
        rowCache[row._row] = row;
        const tr = document.createElement('tr');

        headers.forEach(h => {
            let val = row[h];
            if (BOOLEAN_SHEETS.includes(currentSheet) && typeof val === 'boolean') {
                tr.innerHTML += `
                  <td class="icon-cell">
                    <input type="checkbox" ${val ? 'checked' : ''} 
                      onchange="toggleBoolean(${row._row}, '${h}', this.checked)">
                  </td>`;
            } else {
                tr.innerHTML += `<td>${val ?? ''}</td>`;
            }
        });

        tr.innerHTML += `
          <td class="action-cell">
            <button class="btn btn-warning btn-sm" onclick="openUpdateModal(${row._row})">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-danger btn-sm" onclick="openDeleteModal(${row._row})">
              <i class="bi bi-trash"></i>
            </button>
          </td>`;
        tbody.appendChild(tr);
    });
}

function toggleBoolean(row, col, val) {
    booleanChanges[row] = booleanChanges[row] || {};
    booleanChanges[row][col] = val;
}

function openCreateModal() {
    currentAction = 'create';
    generateForm();
    new bootstrap.Modal(formModal).show();
}

function openUpdateModal(row) {
    currentAction = 'update';
    currentRowNumber = row;
    generateForm(rowCache[row]);
    new bootstrap.Modal(formModal).show();
}

function generateForm(data = {}) {
    const body = document.getElementById('formModalBody');
    body.innerHTML = '';
    currentHeaders.forEach(h => {
        body.innerHTML += `
          <div class="mb-2">
            <label>${h}</label>
            <input class="form-control" name="${h}" value="${data[h] ?? ''}">
          </div>`;
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const values = currentHeaders.map(h => e.target[h].value);
    const payload = {
        sheet: currentSheet,
        action: currentAction,
        values,
        row: currentRowNumber
    };
    await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
    bootstrap.Modal.getInstance(formModal).hide();
    loadData(currentSheet);
}

function openDeleteModal(row) {
    currentRowNumber = row;
    new bootstrap.Modal(deleteModal).show();
}

async function confirmDelete() {
    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ sheet: currentSheet, action: 'delete', row: currentRowNumber })
    });
    bootstrap.Modal.getInstance(deleteModal).hide();
    loadData(currentSheet);
}

function showLoader(show) {
    loader.style.display = show ? 'flex' : 'none';
}
