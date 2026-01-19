// =========================
// KONFIGURASI APLIKASI
// =========================
const SHEETS = ['PENGUMUMAN', 'UANG KAS', 'IURAN BULANAN', 'JADWAL RONDA'];
// Pastikan URL ini benar dan sesuai dengan URL Deploy Apps Script Anda
const API_URL = 'https://script.google.com/macros/s/AKfycbwTb1EtfcKgqKhIDJypTLrw7Iju9SerYf7ynabqT_U7h1IkiVa-IXQgdScEJRxnidK9/exec';
// Sheet yang akan menggunakan checkbox untuk nilai boolean
const BOOLEAN_SHEETS = ['IURAN BULANAN', 'JADWAL RONDA'];

// =========================
// VARIABEL GLOBAL
// =========================
let currentHeaders = [];
let currentAction = 'create';
let currentRowNumber = null;
let currentSheet = SHEETS[0];
// Objek untuk menyimpan perubahan checkbox sebelum disimpan
// Format: { "rowNumber": { "columnName": booleanValue } }
let booleanChanges = {};

// =========================
// INISIALISASI APLIKASI
// =========================
document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    loadData(currentSheet);
    
    // Event listener untuk form submit
    document.getElementById('dataForm').addEventListener('submit', handleFormSubmit);
    // Event listener untuk tombol konfirmasi hapus
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
    // Hapus kelas 'active' dari semua tab
    document.querySelectorAll('#sheetTabs .nav-link').forEach(btn => btn.classList.remove('active'));
    // Tambahkan kelas 'active' ke tab yang diklik
    buttonElement.classList.add('active');
    
    currentSheet = sheetName;
    document.getElementById('sheetTitle').innerText = currentSheet;
    
    // Reset perubahan boolean saat pindah sheet
    resetBooleanChanges();
    // Muat data sheet baru
    loadData(currentSheet);
}

// =========================
// FUNGSI LOAD DATA DARI SPREADSHEET
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
        // Kosongkan tabel jika terjadi error
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
    
    // Kosongkan tabel sebelum render ulang
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
        th.title = header; // Tooltip untuk header panjang
        headerRow.appendChild(th);
    });
    
    // Header untuk kolom aksi
    const thAction = document.createElement('th');
    thAction.className = 'action-cell';
    
    // Jika ini sheet boolean, tampilkan tombol "Simpan Perubahan" di header
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

            // Jika sheet adalah sheet boolean dan nilai sel adalah boolean
            if (BOOLEAN_SHEETS.includes(currentSheet) && typeof cellValue === 'boolean') {
                td.className = 'icon-cell';
                
                const checkboxContainer = document.createElement('div');
                checkboxContainer.className = 'form-check d-flex justify-content-center';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'form-check-input boolean-checkbox';
                checkbox.checked = cellValue;
                
                // Data attribute untuk melacak perubahan
                checkbox.dataset.row = row._row;
                checkbox.dataset.column = header;
                // Simpan nilai asli dari server untuk perbandingan
                checkbox.dataset.original = cellValue;
                
                // Pasang event listener untuk perubahan
                checkbox.onchange = function() {
                    handleCheckboxChange(this);
                };
                
                checkboxContainer.appendChild(checkbox);
                td.appendChild(checkboxContainer);
            } else if (cellValue instanceof Date) {
                // Format tanggal agar mudah dibaca
                td.textContent = cellValue.toLocaleDateString('id-ID');
            } else if (cellValue === true || cellValue === false) {
                // Tampilkan "Ya/Tidak" untuk boolean di sheet non-khusus
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
            // Untuk sheet boolean, hanya ada tombol hapus
            tdAction.innerHTML = `
                <button class="btn btn-danger btn-sm w-100" onclick="openDeleteModal(${row._row})">
                    <i class="bi bi-trash"></i> Hapus
                </button>
            `;
        } else {
            // Untuk sheet lain, ada tombol edit dan hapus
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
// FUNGSI HANDLE CHECKBOX (LOGika PERUBAHAN BOOLEAN)
// =========================
function handleCheckboxChange(checkbox) {
    const newValue = checkbox.checked;
    const rowNum = checkbox.dataset.row;
    const colName = checkbox.dataset.column;
    const originalValue = checkbox.dataset.original === 'true'; // Konversi string ke boolean
    
    // Pastikan objek perubahan untuk baris ini ada
    if (!booleanChanges[rowNum]) {
        booleanChanges[rowNum] = {};
    }

    // LOGIKA PENTING:
    // Jika nilai baru sama dengan nilai asli, ini bukan perubahan.
    // Hapus dari objek perubahan jika ada.
    if (newValue === originalValue) {
        delete booleanChanges[rowNum][colName];
        // Jika tidak ada lagi perubahan di baris ini, hapus baris dari objek
        if (Object.keys(booleanChanges[rowNum]).length === 0) {
            delete booleanChanges[rowNum];
        }
        checkbox.classList.remove('checkbox-changed'); // Hapus tanda visual
    } else {
        // Jika nilai baru berbeda, ini adalah perubahan.
        // Simpan ke objek perubahan.
        booleanChanges[rowNum][colName] = newValue;
        checkbox.classList.add('checkbox-changed'); // Tambahkan tanda visual
    }
    
    // Perbarui tampilan tombol simpan
    updateSaveButton();
}

function updateSaveButton() {
    const saveBtn = document.getElementById('saveBooleanChanges');
    // Hitung total perubahan yang ada
    const hasChanges = Object.keys(booleanChanges).length > 0;
    
    if (saveBtn) {
        saveBtn.style.display = hasChanges ? 'block' : 'none';
        
        let changeCount = 0;
        Object.values(booleanChanges).forEach(colChanges => {
            changeCount += Object.keys(colChanges).length;
        });
        
        saveBtn.innerHTML = `<i class="bi bi-check-square"></i> Simpan ${changeCount} Perubahan`;
        
        // Tambah event listener sekali saja untuk mencegah duplikat
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
        // Ubah objek perubahan menjadi array untuk dikirim ke backend
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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        showAlert(`Berhasil menyimpan ${result.successCount || updates.length} perubahan!`, 'success');
        // Reset state dan muat ulang data untuk sinkronisasi
        resetBooleanChanges();
        loadData(currentSheet);
        
    } catch (error) {
        showAlert('Gagal menyimpan perubahan: ' + error.message, 'danger');
        // Muat ulang data untuk reset state ke kondisi terakhir di server
        loadData(currentSheet);
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
    // Hapus semua tanda visual perubahan
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
        // Tentukan apakah ini field boolean
        const isBooleanField = BOOLEAN_SHEETS.includes(currentSheet) && 
                              (typeof data[header] === 'boolean' || data[header] === undefined);
        
        if (isBooleanField) {
            formGroup.className = 'mb-3 form-check';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input';
            checkbox.id = `input-${header}`;
            checkbox.name = header;
            checkbox.checked = data[header] || false;
            
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
            input.value = (data[header] !== undefined && data[header] !== null) ? data[header] : '';
            
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
    
    // Siapkan array nilai sesuai urutan header
    const values = currentHeaders.map(header => {
        const val = formData.get(header);
        const input = form.elements[`input-${header}`];
        
        // Jika input adalah checkbox, ambil status checked-nya
        if (input && input.type === 'checkbox') {
            return input.checked;
        }
        return val || '';
    });
    
    showLoader(true);
    let payload = {
        sheet: currentSheet,
        action: currentAction,
        values: values
    };
    
    if (currentAction === 'update') {
        payload.row = currentRowNumber;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();

        if (result.error) {
            throw new Error(result.error);
        }

        showAlert(`Data berhasil ${currentAction === 'create' ? 'ditambahkan' : 'diperbarui'}!`, 'success');
        bootstrap.Modal.getInstance(document.getElementById('formModal')).hide();
        form.reset();
        loadData(currentSheet);

    } catch (error) {
        showAlert('Terjadi kesalahan: ' + error.message, 'danger');
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
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();

        if (result.error) {
            throw new Error(result.error);
        }
        
        showAlert('Data berhasil dihapus!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
        loadData(currentSheet);

    } catch (error) {
        showAlert('Terjadi kesalahan: ' + error.message, 'danger');
    } finally {
        showLoader(false);
    }
}

// =========================
// FUNGSI UTILITY
// =========================
function showLoader(show) {
    document.getElementById('loader').style.display = show ? 'flex' : 'none';
}

function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    
    // Hapus alert yang sudah ada untuk mencegah penumpukan
    alertContainer.innerHTML = '';
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    alertContainer.appendChild(alertDiv);

    // Hapus alert otomatis setelah 5 detik
    setTimeout(() => {
        if (alertDiv.parentNode === alertContainer) {
            alertDiv.remove();
        }
    }, 5000);
}

// =========================
// EKSPOR FUNGSI UNTUK HTML (agar bisa dipanggil dari onclick)
// =========================
window.openCreateModal = openCreateModal;
window.openUpdateModal = openUpdateModal;
window.openDeleteModal = openDeleteModal;
window.saveBooleanChanges = saveBooleanChanges;
