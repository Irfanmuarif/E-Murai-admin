# E-Murai-admin

this code GS from commit "harusnya_finish"
// =========================
// KONFIGURASI UTAMA
// =========================
const SPREADSHEET_ID = "1WMy-fI2Puxk5hTvum6zOfbBnjjHGZbjBZwpW4redlAc";

/* =========================
   ROUTER (PENGATUR RUTE)
   Menentukan fungsi mana yang dipanggil berdasarkan permintaan
========================= */
function doGet(e) {
  if (!e || !e.parameter) {
    return response({ error: "Tidak ada parameter yang diterima." });
  }
  const sheetName = e.parameter.sheet;
  if (!sheetName) {
    return response({ error: "Parameter 'sheet' kosong. Pastikan URL mengandung ?sheet=NamaSheet" });
  }
  return readData(sheetName);
}

function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      throw new Error("Tidak ada data POST yang diterima.");
    }

    const data = JSON.parse(e.postData.contents);
    const sheet = data.sheet;
    const action = data.action;

    if (action === "create") return createRow(sheet, data.values);
    if (action === "update") return updateRow(sheet, data.row, data.values);
    if (action === "delete") return deleteRow(sheet, data.row);
    
    // Rute untuk memperbarui satu sel (fitur ceklis)
    if (action === "updateCell") {
      const resultTextOutput = updateCell(sheet, data.row, data.column, data.value);
      
      // *** LOGIKA BARU: Periksa dan tambah kolom otomatis ***
      // Parse hasil dari updateCell untuk memeriksa keberhasilan
      const result = JSON.parse(resultTextOutput.getContent());
      
      // Jika update berhasil dan dilakukan di sheet JADWAL RONDA
      if (sheet === "JADWAL RONDA" && result.success) {
        // Jalankan fungsi untuk mengecek dan menambah kolom baru
        checkAndAddNewRondaColumn();
      }
      
      return resultTextOutput;
    }
    
    return response({ error: "Aksi tidak dikenali: " + action });
  } catch (err) {
    Logger.log("Error di doPost: " + err.message);
    return response({ error: err.message });
  }
}

/* =========================
   FUNGSI BANTUAN (HELPERS)
========================= */
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error("Sheet tidak ditemukan: " + name);
  return sheet;
}

function response(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/* =========================
   FUNGSI UTAMA: MEMBACA DATA
========================= */
function readData(sheetName) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    const timeZone = ss.getSpreadsheetTimeZone();
    
    const range = sheet.getDataRange();
    const values = range.getValues();

    if (values.length === 0) {
      return response({ headers: [], rows: [] });
    }

    const rawHeaders = values[0];
    const body = values.slice(1);

    const headers = rawHeaders.map(h => {
      if (h instanceof Date) {
        return Utilities.formatDate(h, timeZone, "dd-MMM-yyyy");
      }
      return String(h);
    });

    const rows = body.map((row, i) => {
      let obj = { _row: i + 2 };
      headers.forEach((h, idx) => {
        obj[h] = row[idx];
      });
      return obj;
    });

    return response({ headers, rows });
  } catch (err) {
    Logger.log("Error di readData: " + err.message);
    return response({ error: err.message });
  }
}

/* =========================
   FUNGSI CRUD (CREATE, READ, UPDATE, DELETE)
========================= */
function createRow(sheetName, values) {
  const sheet = getSheet(sheetName);
  
  // *** LOGIKA KHUSUS UNTUK JADWAL RONDA ***
  if (sheetName === "JADWAL RONDA") {
    // 1. Tambahkan baris baru dengan nilai yang sudah disiapkan dari frontend
    sheet.appendRow(values);
    const newRowNumber = sheet.getLastRow();
    
    // 2. Cari indeks kolom "terakhir ronda"
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    let lastRondaColIndex = -1;
    for (let i = 0; i < headers.length; i++) {
      if (String(headers[i]).toLowerCase() === "terakhir ronda") {
        lastRondaColIndex = i + 1; // +1 untuk indeks kolom spreadsheet
        break;
      }
    }
    
    // 3. Jika kolom ditemukan dan bukan baris pertama data
    if (lastRondaColIndex !== -1 && newRowNumber > 2) {
      // Ambil rumus dari sel di atasnya
      const formulaAbove = sheet.getRange(newRowNumber - 1, lastRondaColIndex).getFormula();
      
      // Jika ada rumus, modifikasi dan terapkan ke sel baru
      if (formulaAbove) {
        const oldRowNumber = newRowNumber - 1;
        let newFormula = formulaAbove;
        
        // *** PERBAIKAN AKHIR: Ganti referensi baris dalam rumus secara manual ***
        
        // 1. Ganti referensi range (contoh: 14:14)
        const rangeRegex = new RegExp(`${oldRowNumber}:${oldRowNumber}`, 'g');
        newFormula = newFormula.replace(rangeRegex, `${newRowNumber}:${newRowNumber}`);
        
        // 2. Ganti referensi sel tunggal (contoh: B14) yang tidak absolut
        // Regex ini mencari huruf (satu atau lebih) yang TIDAK diawali '$', diikuti nomor baris lama.
        const cellRegex = new RegExp(`(?<!\\$)([A-Z]+)${oldRowNumber}`, 'g');
        newFormula = newFormula.replace(cellRegex, `$1${newRowNumber}`);
        
        Logger.log(`Rumus lama: ${formulaAbove}`);
        Logger.log(`Rumus baru: ${newFormula}`);
        
        sheet.getRange(newRowNumber, lastRondaColIndex).setFormula(newFormula);
      }
    }
  } else {
    // Untuk sheet lain, gunakan logika asli
    sheet.appendRow(values);
  }
  
  return response({ success: true, message: "Baris baru berhasil ditambahkan." });
}

function updateRow(sheetName, rowNumber, values) {
  const sheet = getSheet(sheetName);
  sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
  return response({ success: true, message: "Baris berhasil diperbarui." });
}

function deleteRow(sheetName, rowNumber) {
  const sheet = getSheet(sheetName);
  sheet.deleteRow(rowNumber);
  return response({ success: true, message: "Baris berhasil dihapus." });
}

/* =========================
   FUNGSI KHUSUS: UPDATE SATU SEL
========================= */
function updateCell(sheetName, rowNumber, columnName, newValue) {
  const sheet = getSheet(sheetName);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const timeZone = ss.getSpreadsheetTimeZone();
  
  const rawHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  let columnIndex = -1;
  for (let i = 0; i < rawHeaders.length; i++) {
    let headerKey;
    if (rawHeaders[i] instanceof Date) {
      headerKey = Utilities.formatDate(rawHeaders[i], timeZone, "dd-MMM-yyyy");
    } else {
      headerKey = String(rawHeaders[i]);
    }
    
    if (headerKey === columnName) {
      columnIndex = i + 1;
      break;
    }
  }

  if (columnIndex === -1) {
    throw new Error(`Kolom "${columnName}" tidak ditemukan di sheet "${sheetName}".`);
  }
  
  sheet.getRange(rowNumber, columnIndex).setValue(newValue);
  return response({ success: true, message: "Status berhasil diperbarui." });
}

/* =========================
   *** FUNGSI OTOMATISASI TAMBAH KOLOM JADWAL RONDA (VERSI LOGIKA BARU) ***
========================= */
function checkAndAddNewRondaColumn() {
  Logger.log("=== checkAndAddNewRondaColumn DIMULAI ===");
  const sheetName = "JADWAL RONDA";
  const sheet = getSheet(sheetName);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const timeZone = ss.getSpreadsheetTimeZone();
  
  const lastCol = sheet.getLastColumn();
  Logger.log("Jumlah kolom terakhir: " + lastCol);
  
  if (lastCol < 4) { 
    Logger.log("Jumlah kolom tidak cukup untuk melakukan pengecekan otomatis. Dibutuhkan minimal 4 kolom.");
    return; 
  }
  
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let lastRondaColIndex = -1;
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i]).toLowerCase() === "terakhir ronda") {
      lastRondaColIndex = i + 1;
      break;
    }
  }

  if (lastRondaColIndex === -1) {
    Logger.log("KESALAHAN: Kolom 'terakhir ronda' tidak ditemukan. Pastikan ada kolom dengan header ini.");
    return;
  }
  Logger.log("Kolom 'terakhir ronda' ditemukan di kolom ke-" + lastRondaColIndex);
  
  const colToCheck1 = lastRondaColIndex - 2;
  const colToCheck2 = lastRondaColIndex - 1;
  
  if (colToCheck1 < 2) {
    Logger.log("KESALAHAN: Tidak cukup kolom tanggal untuk diperiksa sebelum 'terakhir ronda'. Membatalkan.");
    return;
  }
  
  Logger.log("Memeriksa kolom ke-" + colToCheck1 + " dan kolom ke-" + colToCheck2);
  
  const range = sheet.getRange(2, colToCheck1, sheet.getLastRow() - 1, 2);
  const data = range.getValues();
  Logger.log("Data yang diperiksa: " + JSON.stringify(data));
  
  let hasTrueValue = false;
  for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < data[i].length; j++) {
      if (data[i][j] == true) { 
        hasTrueValue = true;
        Logger.log(`BERHASIL: Nilai 'true' ditemukan di baris ${i+2}, kolom ${colToCheck1 + j}.`);
        break;
      }
    }
    if (hasTrueValue) {
      break;
    }
  }

  if (hasTrueValue) {
    Logger.log("BERHASIL: Ditemukan setidaknya satu nilai 'true'. Menambahkan kolom baru...");
    
    const headerValue = sheet.getRange(1, colToCheck2, 1, 1).getValue();
    const oldDate = new Date(headerValue);
    
    if (isNaN(oldDate.getTime())) {
      Logger.log("KESALAHAN: Header bukan tanggal yang valid: " + headerValue + ". Membatalkan.");
      return;
    }
    
    const newDateMs = oldDate.getTime() + (7 * 24 * 60 * 60 * 1000);
    const newDate = new Date(newDateMs);
    const newHeader = Utilities.formatDate(newDate, timeZone, "dd-MMM-yyyy");
    Logger.log("Header baru yang akan dibuat: " + newHeader);
    
    sheet.insertColumnsBefore(lastRondaColIndex, 1);
    sheet.getRange(1, lastRondaColIndex, 1, 1).setValue(newHeader);
    
    const newColumnRange = sheet.getRange(2, lastRondaColIndex, sheet.getLastRow() - 1, 1);
    newColumnRange.setValue(false);
    
    Logger.log("SUKSES: Kolom baru '" + newHeader + "' berhasil ditambahkan sebelum kolom 'terakhir ronda'");
  } else {
    Logger.log("INFO: Tidak ada nilai 'true' yang ditemukan di dua kolom sebelum 'terakhir ronda'. Tidak ada kolom baru yang ditambahkan.");
  }
  Logger.log("=== checkAndAddNewRondaColumn SELESAI ===");
}
