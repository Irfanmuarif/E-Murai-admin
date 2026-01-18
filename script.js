// =========================
// KONFIGURASI APLIKASI
// =========================
const SHEETS = ['PENGUMUMAN', 'UANG KAS', 'IURAN BULANAN', 'JADWAL RONDA'];
// GANTI DENGAN URL DEPLOYMENT ANDA
const API_URL = 'https://script.google.com/macros/s/AKfycbyje_h9Tefl0MMnEOUmJ-wSs_OEgO7iuwjo50s5Nezo6rtCR4C9M2NHC9uKcNpqcbez/exec';
const BOOLEAN_SHEETS = ['IURAN BULANAN', 'JADWAL RONDA'];

// =========================
// VARIABEL GLOBAL
// =========================
let currentHeaders = [];
let currentAction = 'create';
let currentRowNumber = null;
let currentSheet = SHEETS[0];
let booleanChanges = {};

// =========================
// INISIALISASI APLIKASI
// =========================
document.addEventListener('DOMContentLoaded', () => {
    console.log('Aplikasi dimulai...');
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
    console.log(`Beralih ke sheet: ${sheetName}`);
    document.querySelectorAll('#sheetTabs .nav-link').forEach(btn => btn.classList.remove('active'));
    buttonElement.classList.add('active');
    currentSheet = sheetName;
    document.getElementById('sheetTitle').innerText = currentSheet;
    resetBooleanChanges();
    loadData(currentSheet);
}

// =========================
// FUNGSI LOAD DATA DARI SPREADSHEET
// =========================
async function loadData(sheetName) {
    showLoader(true);
    console.log(`Memuat data dari sheet: ${sheetName}`);
    
    try {
        const response = await fetchWithTimeout(`${API_URL}?sheet=${encodeURIComponent(sheetName)}`, {
            method: 'GET',
            timeout: 30000 // 30 detik timeout
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Data diterima:', result);
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        currentHeaders = result.headers;
        renderTable(result.headers, result.rows);
        
    } catch (error) {
        console.error('Error loading data:', error);
        showAlert('Gagal memuat data: ' + error.message, 'danger');
        document.querySelector('#dataTable thead').innerHTML = '';
        document.querySelector('#dataTable tbody').innerHTML = '';
    } finally {
        showLoader(false);
    }
}

// =========================
// FUNGSI RENDER TABEL
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

    // BUAT HEADER TABEL
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

    // BUAT BODY TABEL
    rows.forEach(row => {
        const tr = document.createElement('tr');
        
        headers.forEach(header => {
            const td = document.createElement('td');
            const cellValue = row[header];

            if (BOOLEAN_SHEETS.includes(currentSheet) && (cellValue === true || cellValue === false)) {
                td.className = 'icon-cell';
                
                const checkboxContainer = document.createElement('div');
                checkboxContainer.className = 'form-check d-flex justify-content-center';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'form-check-input boolean-checkbox';
                checkbox.checked = Boolean(cellValue);
                checkbox.dataset.row = row._row;
                checkbox.dataset.column = header;
                checkbox.dataset.original = cellValue;
                
                checkbox.onchange = function() {
                    handleCheckboxChange(this);
                };
                
                checkboxContainer.appendChild(checkbox);
                td.appendChild(checkboxContainer);
            } else {
                td.textContent = cellValue !== undefined && cellValue !== null ? String(cellValue) : '';
            }
            tr.appendChild(td);
        });
        
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
// FUNGSI HANDLE CHECKBOX
// =========================
function handleCheckboxChange(checkbox) {
    const newValue = checkbox.checked;
    const rowNum = checkbox.dataset.row;
    const colName = checkbox.dataset.column;
    
    if (!booleanChanges[rowNum]) booleanChanges[rowNum] = {};
    booleanChanges[rowNum][colName] = newValue;
    
    updateSaveButton();
    
    // Tandai checkbox yang berubah
    if (String(newValue) !== checkbox.dataset.original) {
        checkbox.classList.add('checkbox-changed');
    } else {
        checkbox.classList.remove('checkbox-changed');
        delete booleanChanges[rowNum][colName];
        if (Object.keys(booleanChanges[rowNum]).length === 0) {
            delete booleanChanges[rowNum];
        }
    }
}

function updateSaveButton() {
    const saveBtn = document.getElementById('saveBooleanChanges');
    const hasChanges = Object.keys(booleanChanges).length > 0;
    
    if (saveBtn) {
        saveBtn.style.display = hasChanges ? 'inline-block' : 'none';
        
        let changeCount = 0;
        Object.values(booleanChanges).forEach(colChanges => {
            changeCount += Object.keys(colChanges).length;
        });
        
        if (changeCount > 0) {
            saveBtn.innerHTML = `<i class="bi bi-check-square"></i> Simpan ${changeCount} Perubahan`;
            saveBtn.disabled = false;
        } else {
            saveBtn.style.display = 'none';
        }
    }
}

async function saveBooleanChanges() {
    if (Object.keys(booleanChanges).length === 0) {
        showAlert('Tidak ada perubahan untuk disimpan', 'warning');
        return;
    }
    
    const saveBtn = document.getElementById('saveBooleanChanges');
    if (saveBtn) saveBtn.disabled = true;
    
    showLoader(true);
    console.log('Menyimpan perubahan:', booleanChanges);
    
    try {
        // Format updates
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
        
        console.log('Updates to send:', updates);
        
        const payload = {
            sheet: currentSheet,
            action: 'updateBatch',
            updates: updates
        };
        
        console.log('Payload:', payload);
        
        const response = await fetchWithTimeout(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            timeout: 30000
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Save result:', result);
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        showAlert(`✅ Berhasil menyimpan ${result.successCount || updates.length} perubahan!`, 'success');
        resetBooleanChanges();
        
        // Reload data untuk sinkronisasi
        setTimeout(() => loadData(currentSheet), 1000);
        
    } catch (error) {
        console.error('Error saving changes:', error);
        showAlert(`❌ Gagal menyimpan perubahan: ${error.message}`, 'danger');
        
        // Re-enable save button
        if (saveBtn) saveBtn.disabled = false;
    } finally {
        showLoader(false);
    }
}

function resetBooleanChanges() {
    booleanChanges = {};
    const saveBtn = document.getElementById('saveBooleanChanges');
    if (saveBtn) {
        saveBtn.style.display = 'none';
        saveBtn.disabled = false;
    }
    document.querySelectorAll('.checkbox-changed').forEach(cb => {
        cb.classList.remove('checkbox-changed');
    });
}

// =========================
// FUNGSI MODAL HANDLERS
// =========================
function openCreateModal() {
    currentAction = 'create';
    document.getElementById('formModalLabel').innerText = `Tambah Data Baru ke ${currentSheet}`;
    generateFormFields();
    const modal = new bootstrap.Modal(document.getElementById('formModal'));
    modal.show();
}

function openUpdateModal(rowNumber, rowData) {
    currentAction = 'update';
    currentRowNumber = rowNumber;
    document.getElementById('formModalLabel').innerText = `Edit Data di ${currentSheet}`;
    generateFormFields(rowData);
    const modal = new bootstrap.Modal(document.getElementById('formModal'));
    modal.show();
}

function openDeleteModal(rowNumber) {
    currentRowNumber = rowNumber;
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
}

// =========================
// FUNGSI FORM GENERATOR
// =========================
function generateFormFields(data = {}) {
    const formBody = document.getElementById('formModalBody');
    formBody.innerHTML = '';

    if (currentHeaders.length === 0) {
        formBody.innerHTML = '<p class="text-muted">Tidak ada kolom untuk diisi.</p>';
        return;
    }

    currentHeaders.forEach(header => {
        const formGroup = document.createElement('div');
        const value = data[header];
        
        // Cek apakah ini field boolean
        if (BOOLEAN_SHEETS.includes(currentSheet) && 
            (value === true || value === false || 
             currentSheet.includes('IURAN') || currentSheet.includes('RONDA'))) {
            
            formGroup.className = 'mb-3 form-check';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input';
            checkbox.id = `input-${header}`;
            checkbox.name = header;
            checkbox.checked = Boolean(value);
            
            const label = document.createElement('label');
            label.htmlFor = `input-${header}`;
            label.className = 'form-check-label';
            label.textContent = header;
            
            formGroup.appendChild(checkbox);
            formGroup.appendChild(label);
        } else {
            formGroup.className = 'mb-3';
            
            const label = document.createElement('label');
            label.htmlFor = `input-${header}`;
            label.className = 'form-label';
            label.textContent = header;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-control';
            input.id = `input-${header}`;
            input.name = header;
            input.value = (value !== undefined && value !== null) ? String(value) : '';
            
            formGroup.appendChild(label);
            formGroup.appendChild(input);
        }
        formBody.appendChild(formGroup);
    });
}

// =========================
// FUNGSI CRUD OPERATIONS
// =========================
async function handleFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const values = currentHeaders.map(header => {
        const val = formData.get(header);
        const input = form.elements[`input-${header}`];
        
        if (input && input.type === 'checkbox') {
            return val === 'on';
        }
        return val || '';
    });
    
    showLoader(true);
    
    const payload = {
        sheet: currentSheet,
        action: currentAction,
        values: values
    };
    
    if (currentAction === 'update') {
        payload.row = currentRowNumber;
    }

    try {
        console.log('Sending form data:', payload);
        
        const response = await fetchWithTimeout(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            timeout: 30000
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Form submit result:', result);

        if (result.error) {
            throw new Error(result.error);
        }

        showAlert(`✅ Data berhasil ${currentAction === 'create' ? 'ditambahkan' : 'diperbarui'}!`, 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('formModal'));
        if (modal) modal.hide();
        
        form.reset();
        
        // Tunggu sebentar sebelum reload
        setTimeout(() => loadData(currentSheet), 1000);

    } catch (error) {
        console.error('Form submit error:', error);
        showAlert('❌ Terjadi kesalahan: ' + error.message, 'danger');
    } finally {
        showLoader(false);
    }
}

async function confirmDelete() {
    showLoader(true);
    
    const payload = {
        sheet: currentSheet,
        action: 'delete',
        row: currentRowNumber
    };

    try {
        console.log('Deleting row:', payload);
        
        const response = await fetchWithTimeout(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            timeout: 30000
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Delete result:', result);

        if (result.error) {
            throw new Error(result.error);
        }
        
        showAlert('✅ Data berhasil dihapus!', 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
        if (modal) modal.hide();
        
        // Tunggu sebentar sebelum reload
        setTimeout(() => loadData(currentSheet), 1000);

    } catch (error) {
        console.error('Delete error:', error);
        showAlert('❌ Terjadi kesalahan: ' + error.message, 'danger');
    } finally {
        showLoader(false);
    }
}

// =========================
// FUNGSI UTILITY
// =========================
function showLoader(show) {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        <div class="d-flex align-items-center">
            <div class="flex-grow-1">${message}</div>
            <button type="button" class="btn-close ms-2" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    alertContainer.appendChild(alertDiv);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode === alertContainer) {
            alertDiv.remove();
        }
    }, 5000);
}

// Fetch dengan timeout
async function fetchWithTimeout(url, options = {}) {
    const { timeout = 30000, ...fetchOptions } = options;
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout setelah ${timeout}ms`);
        }
        throw error;
    }
}

// =========================
// EKSPOR FUNGSI UNTUK HTML
// =========================
window.openCreateModal = openCreateModal;
window.openUpdateModal = openUpdateModal;
window.openDeleteModal = openDeleteModal;
window.saveBooleanChanges = saveBooleanChanges;

// =========================
// DEBUGGING HELPERS
// =========================
window.debugChanges = function() {
    console.log('Current booleanChanges:', booleanChanges);
    console.log('Current sheet:', currentSheet);
    console.log('Current headers:', currentHeaders);
    
    const checkboxes = document.querySelectorAll('.boolean-checkbox');
    console.log('Total checkboxes:', checkboxes.length);
    
    checkboxes.forEach((cb, index) => {
        console.log(`Checkbox ${index}:`, {
            row: cb.dataset.row,
            column: cb.dataset.column,
            checked: cb.checked,
            original: cb.dataset.original
        });
    });
    
    alert(`Debug info logged to console. Changes: ${Object.keys(booleanChanges).length}`);
};

window.clearChanges = function() {
    resetBooleanChanges();
    alert('Perubahan telah dibersihkan');
};
