// =========================
// KONFIGURASI APLIKASI
// =========================
const SHEETS = ['PENGUMUMAN', 'UANG KAS', 'IURAN BULANAN', 'JADWAL RONDA'];
// Pastikan URL ini benar dan sesuai dengan URL Deploy Apps Script Anda
const API_URL = 'https://script.google.com/macros/s/AKfycbwTb1EtfcKgqKhIDJypTLrw7Iju9SerYf7ynabqT_U7h1IkiVa-IXQgdScEJRxnidK9/exec';
// Sheet yang akan menggunakan ikon toggle untuk nilai boolean
const BOOLEAN_SHEETS = ['IURAN BULANAN', 'JADWAL RONDA'];

// =========================
// VARIABEL GLOBAL
// =========================
let currentHeaders = [];
let currentAction = 'create';
let currentRowNumber = null;
let currentSheet = SHEETS[0];
// Objek untuk menyimpan perubahan ikon sebelum disimpan
// Format: { "rowNumber": { "columnName": booleanValue } }
let booleanChanges = {};

// =========================
// INISIALISASI APLIKASI
// =========================
document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    loadData(currentSheet);
    
    document.getElementById('dataForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
});

// =========================
// FUNGSI TAB MANAGEMENT
// =========================
function initializeTabs() {
    const tabList = document.getElementById('sheetTabs');
    SHEETS.forEach((sheetName, index) => {
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.setAttribute('role', 'presentation');

        const button = document.createElement('button');
        button.className = `nav-link ${index === 0 ? 'active' : ''}`;
        button.setAttribute('type', 'button');
        button.setAttribute('role', 'tab');
        button.textContent = sheetName;
        button.onclick = () => switchSheet(sheetName, button);

        li.appendChild(button);
        tabList.appendChild(li);
    });
}

function switchSheet(sheetName, buttonElement) {
    document.querySelectorAll('#sheetTabs .nav-link').forEach(btn => btn.classList.remove('active'));
    buttonElement.classList.add('active');
    
    currentSheet = sheetName;
    document.getElementById('sheetTitle').innerText = currentSheet;
    
    resetBooleanChanges();
    loadData(currentSheet);
}

// =========================
// FUNGSI LOAD DATA
// =========================
async function loadData(sheetName) {
    showLoader(true);
    try {
        const response = await fetch(`${API_URL}?sheet=${sheetName}`);
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        currentHeaders = result.headers;
        renderTable(result.headers, result.rows);
        
    } catch (error) {
        showAlert('Gagal memuat data: ' + error.message, 'danger');
        document.querySelector('#dataTable thead').innerHTML = '';
        document.querySelector('#dataTable tbody').innerHTML = '';
    } finally {
        showLoader(false);
    }
}

// =========================
// FUNGSI RENDER TABEL (MENGGUNAKAN IKON)
// =========================
function renderTable(headers, rows) {
    const tableHead = document.querySelector('#dataTable thead');
    const tableBody = document.querySelector('#dataTable tbody');
    
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';

    if (headers.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = "100%";
        td.className = "text-center text-muted py-4";
        td.textContent = "Tidak ada data atau sheet kosong.";
        tr.appendChild(td);
        tableBody.appendChild(tr);
        return;
    }

    // Buat Header
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        th.title = header;
        headerRow.appendChild(th);
    });
    
    const thAction = document.createElement('th');
    thAction.className = 'action-cell';
    if (BOOLEAN_SHEETS.includes(currentSheet)) {
        thAction.innerHTML = `
            <button id="saveBooleanChanges" class="btn btn-success btn-sm" style="display: none;">
                <i class="bi bi-check-square"></i> Simpan Perubahan
            </button>
        `;
    } else {
        thAction.textContent = 'Aksi';
    }
    headerRow.appendChild(thAction);
    tableHead.appendChild(headerRow);

    // Buat Body Tabel
    rows.forEach(row => {
        const tr = document.createElement('tr');
        
        headers.forEach(header => {
            const td = document.createElement('td');
            const cellValue = row[header];

            // Jika sheet boolean dan nilai sel adalah boolean, gunakan ikon
            if (BOOLEAN_SHEETS.includes(currentSheet) && typeof cellValue === 'boolean') {
                td.className = 'icon-cell';
                const icon = document.createElement('i');
                icon.className = 'clickable-icon bi ';
                
                // Set ikon awal berdasarkan nilai dari server
                if (cellValue) {
                    icon.className += 'bi-check-circle-fill text-success';
                    icon.title = 'Selesai. Klik untuk ubah.';
                } else {
                    icon.className += 'bi-x-circle-fill text-danger';
                    icon.title = 'Belum Selesai. Klik untuk ubah.';
                }
                
                // Simpan data pelacak pada elemen ikon
                icon.dataset.row = row._row;
                icon.dataset.column = header;
                icon.dataset.original = cellValue; // 'true' atau 'false'
                
                // Pasang event listener untuk klik
                icon.onclick = () => handleIconClick(icon);
                
                td.appendChild(icon);
            } else if (cellValue instanceof Date) {
                td.textContent = cellValue.toLocaleDateString('id-ID');
            } else if (cellValue === true || cellValue === false) {
                td.textContent = cellValue ? 'Ya' : 'Tidak';
            } else {
                td.textContent = cellValue || '';
            }
            tr.appendChild(td);
        });
        
        // Kolom Aksi
        const tdAction = document.createElement('td');
        tdAction.className = 'action-cell';
        if (BOOLEAN_SHEETS.includes(currentSheet)) {
            tdAction.innerHTML = `
                <button class="btn btn-danger btn-sm w-100" onclick="openDeleteModal(${row._row})">
                    <i class="bi bi-trash"></i> Hapus
                </button>
            `;
        } else {
            tdAction.innerHTML = `
                <div class="btn-group" role="group">
                    <button class="btn btn-warning btn-sm" onclick="openUpdateModal(${row._row}, ${JSON.stringify(row).replace(/"/g, '&quot;')})">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="openDeleteModal(${row._row})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `;
        }
        tr.appendChild(tdAction);
        tableBody.appendChild(tr);
    });
}

// =========================
// FUNGSI UNTUK MENANGANI KLIK IKON (LOGIKA UTAMA TOGGLE)
// =========================
function handleIconClick(iconElement) {
    const rowNum = iconElement.dataset.row;
    const colName = iconElement.dataset.column;
    const originalValue = iconElement.dataset.original === 'true';
    
    // LOGIKA TOGGLE: nilai baru adalah kebalikan dari nilai asli
    const newValue = !originalValue;

    // 1. Update visual ikon secara instan
    if (newValue) {
        iconElement.className = 'clickable-icon bi bi-check-circle-fill text-success';
        iconElement.title = 'Selesai. Klik untuk ubah.';
    } else {
        iconElement.className = 'clickable-icon bi bi-x-circle-fill text-danger';
        iconElement.title = 'Belum Selesai. Klik untuk ubah.';
    }

    // 2. Lacak perubahan dalam objek global
    if (!booleanChanges[rowNum]) {
        booleanChanges[rowNum] = {};
    }

    // Jika nilai baru sama dengan nilai asli, ini bukan perubahan lagi
    if (newValue === originalValue) {
        delete booleanChanges[rowNum][colName];
        if (Object.keys(booleanChanges[rowNum]).length === 0) {
            delete booleanChanges[rowNum];
        }
        iconElement.style.opacity = '1'; // Kembalikan opacity normal
    } else {
        // Ini adalah perubahan, simpan nilainya
        booleanChanges[rowNum][colName] = newValue;
        iconElement.style.opacity = '0.7'; // Berikan tanda visual bahwa ada perubahan tertunda
    }
    
    // 3. Perbarui tombol simpan
    updateSaveButton();
}

function updateSaveButton() {
    const saveBtn = document.getElementById('saveBooleanChanges');
    const hasChanges = Object.keys(booleanChanges).length > 0;
    
    if (saveBtn) {
        saveBtn.style.display = hasChanges ? 'block' : 'none';
        
        let changeCount = 0;
        Object.values(booleanChanges).forEach(colChanges => {
            changeCount += Object.keys(colChanges).length;
        });
        
        saveBtn.innerHTML = `<i class="bi bi-check-square"></i> Simpan ${changeCount} Perubahan`;
        
        if (!saveBtn.hasEventListener) {
            saveBtn.addEventListener('click', saveBooleanChanges);
            saveBtn.hasEventListener = true;
        }
    }
}

async function saveBooleanChanges() {
    if (Object.keys(booleanChanges).length === 0) {
        showAlert('Tidak ada perubahan untuk disimpan', 'warning');
        return;
    }
    
    showLoader(true);
    
    try {
        const updates = [];
        Object.keys(booleanChanges).forEach(rowNum => {
            Object.keys(booleanChanges[rowNum]).forEach(colName => {
                updates.push({
                    row: parseInt(rowNum),
                    column: colName,
                    value: booleanChanges[rowNum][colName]
                });
            });
        });
        
        const payload = {
            sheet: currentSheet,
            action: 'updateBatch',
            updates: updates
        };
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        showAlert(`Berhasil menyimpan ${result.successCount || updates.length} perubahan!`, 'success');
        resetBooleanChanges();
        loadData(currentSheet); // Muat ulang untuk sinkronisasi final
        
    } catch (error) {
        showAlert('Gagal menyimpan perubahan: ' + error.message, 'danger');
        loadData(currentSheet); // Muat ulang untuk reset ke kondisi server
    } finally {
        showLoader(false);
    }
}

function resetBooleanChanges() {
    booleanChanges = {};
    const saveBtn = document.getElementById('saveBooleanChanges');
    if (saveBtn) {
        saveBtn.style.display = 'none';
    }
    // Reset opacity semua ikon
    document.querySelectorAll('.icon-cell i').forEach(icon => {
        icon.style.opacity = '1';
    });
}

// =========================
// FUNGSI MODAL & CRUD (TIDAK BERUBAH)
// =========================
function openCreateModal() {
    currentAction = 'create';
    document.getElementById('formModalLabel').innerText = `Tambah Data Baru ke ${currentSheet}`;
    generateFormFields();
    new bootstrap.Modal(document.getElementById('formModal')).show();
}

function openUpdateModal(rowNumber, rowData) {
    currentAction = 'update';
    currentRowNumber = rowNumber;
    document.getElementById('formModalLabel').innerText = `Edit Data di ${currentSheet}`;
    generateFormFields(rowData);
    new bootstrap.Modal(document.getElementById('formModal')).show();
}

function openDeleteModal(rowNumber) {
    currentRowNumber = rowNumber;
    new bootstrap.Modal(document.getElementById('deleteModal')).show();
}

function generateFormFields(data = {}) {
    const formBody = document.getElementById('formModalBody');
    formBody.innerHTML = '';
    if (currentHeaders.length === 0) {
        formBody.innerHTML = '<p class="text-muted">Tidak ada kolom untuk diisi.</p>';
        return;
    }
    currentHeaders.forEach(header => {
        const formGroup = document.createElement('div');
        const isBooleanField = BOOLEAN_SHEETS.includes(currentSheet) && (typeof data[header] === 'boolean' || data[header] === undefined);
        
        if (isBooleanField) {
            formGroup.className = 'mb-3 form-check';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox'; checkbox.className = 'form-check-input'; checkbox.id = `input-${header}`; checkbox.name = header; checkbox.checked = data[header] || false;
            const label = document.createElement('label'); label.htmlFor = `input-${header}`; label.className = 'form-check-label'; label.textContent = header;
            formGroup.appendChild(checkbox); formGroup.appendChild(label);
        } else {
            formGroup.className = 'mb-3';
            const label = document.createElement('label'); label.htmlFor = `input-${header}`; label.className = 'form-label'; label.textContent = header;
            const input = document.createElement('input'); input.type = 'text'; input.className = 'form-control'; input.id = `input-${header}`; input.name = header; input.value = (data[header] !== undefined && data[header] !== null) ? data[header] : '';
            formGroup.appendChild(label); formGroup.appendChild(input);
        }
        formBody.appendChild(formGroup);
    });
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const form = event.target; const formData = new FormData(form);
    const values = currentHeaders.map(header => {
        const val = formData.get(header); const input = form.elements[`input-${header}`];
        if (input && input.type === 'checkbox') { return input.checked; }
        return val || '';
    });
    showLoader(true);
    let payload = { sheet: currentSheet, action: currentAction, values: values };
    if (currentAction === 'update') { payload.row = currentRowNumber; }
    try {
        const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (result.error) { throw new Error(result.error); }
        showAlert(`Data berhasil ${currentAction === 'create' ? 'ditambahkan' : 'diperbarui'}!`, 'success');
        bootstrap.Modal.getInstance(document.getElementById('formModal')).hide(); form.reset(); loadData(currentSheet);
    } catch (error) { showAlert('Terjadi kesalahan: ' + error.message, 'danger'); } finally { showLoader(false); }
}

async function confirmDelete() {
    showLoader(true);
    const payload = { sheet: currentSheet, action: 'delete', row: currentRowNumber };
    try {
        const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (result.error) { throw new Error(result.error); }
        showAlert('Data berhasil dihapus!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide(); loadData(currentSheet);
    } catch (error) { showAlert('Terjadi kesalahan: ' + error.message, 'danger'); } finally { showLoader(false); }
}

// =========================
// FUNGSI UTILITY
// =========================
function showLoader(show) { document.getElementById('loader').style.display = show ? 'flex' : 'none'; }

function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer'); alertContainer.innerHTML = '';
    const alertDiv = document.createElement('div'); alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`;
    alertContainer.appendChild(alertDiv);
    setTimeout(() => { if (alertDiv.parentNode === alertContainer) { alertDiv.remove(); } }, 5000);
}

// =========================
// EKSPOR FUNGSI
// =========================
window.openCreateModal = openCreateModal;
window.openUpdateModal = openUpdateModal;
window.openDeleteModal = openDeleteModal;
window.saveBooleanChanges = saveBooleanChanges;
