/**
 * ============================================================================
 * Aplikasi Latihan Soal SD - Database Management
 * File: Database.gs
 * Deskripsi: Setup skema database Google Sheets, header otomatis, helper CRUD,
 *            penguncian (LockService), dan zona waktu Asia/Jakarta.
 * ============================================================================
 */

// Konstanta Nama Sheet
var SHEETS = {
  GURU: 'GURU',
  KELAS: 'KELAS',
  SISWA: 'SISWA',
  BANK_SOAL: 'BANK_SOAL',
  PAKET_LATIHAN: 'PAKET_LATIHAN',
  PAKET_SOAL: 'PAKET_SOAL',
  TOKEN_AKSES: 'TOKEN_AKSES',
  SESI_LATIHAN: 'SESI_LATIHAN',
  JAWABAN_SISWA: 'JAWABAN_SISWA',
  PENGATURAN: 'PENGATURAN'
};

// Skema Kolom Database sesuai PRD
var SCHEMA = {};
SCHEMA[SHEETS.GURU] = [
  'GuruID', 'Username', 'PasswordHash', 'NamaGuru', 'Aktif', 'DibuatPada', 'DiperbaruiPada'
];
SCHEMA[SHEETS.KELAS] = [
  'KelasID', 'GuruID', 'NamaKelas', 'Tingkat', 'TahunAjaran', 'Aktif', 'DibuatPada'
];
SCHEMA[SHEETS.SISWA] = [
  'SiswaID', 'GuruID', 'KelasID', 'NamaSiswa', 'NomorAbsen', 'KodeSiswaOpsional', 'Aktif', 'DibuatPada'
];
SCHEMA[SHEETS.BANK_SOAL] = [
  'SoalID', 'GuruID', 'MataPelajaran', 'Tingkat', 'Topik', 'JenisSoal',
  'Pertanyaan', 'PilihanA', 'PilihanB', 'PilihanC', 'PilihanD',
  'KunciJawaban', 'Pembahasan', 'Bobot', 'GambarFileID', 'GambarURL',
  'Status', 'DibuatPada', 'DiperbaruiPada'
];
SCHEMA[SHEETS.PAKET_LATIHAN] = [
  'PaketID', 'GuruID', 'Judul', 'Deskripsi', 'Petunjuk', 'MataPelajaran',
  'Tingkat', 'DurasiMenit', 'MaksPercobaan', 'AcakSoal', 'AcakPilihan',
  'TampilkanNilai', 'TampilkanKunci', 'TampilkanPembahasan', 'MulaiPada',
  'SelesaiPada', 'Status', 'DibuatPada', 'DiperbaruiPada'
];
SCHEMA[SHEETS.PAKET_SOAL] = [
  'PaketSoalID', 'PaketID', 'SoalID', 'Urutan', 'BobotOverride'
];
SCHEMA[SHEETS.TOKEN_AKSES] = [
  'TokenID', 'PaketID', 'TokenHash', 'KelasIDOpsional', 'BerlakuSampai',
  'BatasPeserta', 'Aktif', 'DibuatPada', 'TokenKode'
];
SCHEMA[SHEETS.SESI_LATIHAN] = [
  'SesiID', 'PaketID', 'TokenID', 'SiswaIDOpsional', 'NamaSiswaSnapshot',
  'KelasIDSnapshot', 'PercobaanKe', 'MulaiPada', 'TerakhirAktif',
  'BatasWaktu', 'DikirimPada', 'Status', 'NilaiAkhir', 'SkorMaksimal'
];
SCHEMA[SHEETS.JAWABAN_SISWA] = [
  'JawabanID', 'SesiID', 'SoalID', 'Jawaban', 'Skor', 'Benar', 'DiperbaruiPada'
];
SCHEMA[SHEETS.PENGATURAN] = [
  'Kunci', 'Nilai', 'DiperbaruiPada'
];

var TIMEZONE = 'Asia/Jakarta';

/**
 * Mengambil instance Spreadsheet database.
 * Memeriksa Script Properties SPREADSHEET_ID atau spreadsheet aktif jika container-bound.
 * @return {Spreadsheet} Instance Google Spreadsheet
 */
function getSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty('SPREADSHEET_ID');

  if (ssId) {
    try {
      return SpreadsheetApp.openById(ssId);
    } catch (e) {
      throw new Error('Gagal membuka spreadsheet dengan ID ' + ssId + ': ' + e.message);
    }
  }

  // Cek jika script terikat langsung pada spreadsheet (container-bound)
  try {
    var activeSs = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSs) {
      props.setProperty('SPREADSHEET_ID', activeSs.getId());
      return activeSs;
    }
  } catch (err) {
    // Abaikan jika standalone script
  }

  throw new Error('Database Spreadsheet belum dikonfigurasi. Jalankan fungsi setupLMS() terlebih dahulu.');
}

/**
 * Mengambil sheet tertentu berdasarkan nama
 * @param {string} sheetName Nama sheet
 * @return {Sheet} Instance sheet
 */
function getDbSheet(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet ' + sheetName + ' tidak ditemukan di database.');
  }
  return sheet;
}

/**
 * Format tanggal sekarang dalam zona waktu Asia/Jakarta
 * @param {Date} dateObj Objek Date (default sekarang)
 * @return {string} String waktu yyyy-MM-dd HH:mm:ss
 */
function getJakartaTimestamp(dateObj) {
  var d = dateObj || new Date();
  return Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Menghasilkan ID unik dengan prefix
 * @param {string} prefix Awalan ID (misal: 'GUR', 'SOAL', 'PKT')
 * @return {string} ID unik
 */
function generateId(prefix) {
  var uuid = Utilities.getUuid().replace(/-/g, '').substring(0, 8);
  var timestamp = Utilities.formatDate(new Date(), TIMEZONE, 'yyMMddHHmm');
  return (prefix ? prefix + '-' : '') + timestamp + '-' + uuid;
}

/**
 * Eksekusi dengan LockService untuk mencegah tabrakan data (race condition)
 * @param {Function} callback Fungsi yang akan dijalankan
 * @param {number} timeoutMs Waktu tunggu lock dalam milidetik (default 30000)
 * @return {*} Hasil pengembalian dari callback
 */
function withScriptLock(callback, timeoutMs) {
  var timeout = timeoutMs || 30000;
  var lock = LockService.getScriptLock();
  var hasLock = false;
  try {
    hasLock = lock.tryLock(timeout);
    if (!hasLock) {
      throw new Error('Sistem sedang sibuk memproses permintaan lain. Silakan coba beberapa saat lagi.');
    }
    return callback();
  } finally {
    if (hasLock) {
      try {
        lock.releaseLock();
      } catch (e) {
        // Abaikan error pelepasan lock
      }
    }
  }
}

/**
 * Setup database idempoten.
 * Membuat spreadsheet dan folder Google Drive jika belum ada,
 * membuat seluruh sheet beserta header kolom tanpa membuat duplikasi atau menghapus data lama.
 * @return {Object} Status hasil setup dan ID yang terkonfigurasi
 */
function setupLMS() {
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty('SPREADSHEET_ID');
  var ss = null;

  if (ssId) {
    try {
      ss = SpreadsheetApp.openById(ssId);
    } catch (e) {
      ss = null;
    }
  }

  // Jika belum ada, buat spreadsheet baru
  if (!ss) {
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch (e) {
      ss = null;
    }
  }

  if (!ss) {
    ss = SpreadsheetApp.create('Database Latihan Soal SD');
    ssId = ss.getId();
    props.setProperty('SPREADSHEET_ID', ssId);
  }

  // Setup Folder Google Drive untuk media soal
  var folderId = props.getProperty('DRIVE_FOLDER_ID');
  var folder = null;
  if (folderId) {
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      folder = null;
    }
  }

  if (!folder) {
    folder = DriveApp.createFolder('LatihanSoalSD_Media');
    // Set permission agar gambar dapat ditampilkan ke siswa via URL
    try {
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (errShare) {
      // Abaikan jika dibatasi kebijakan organisasi
    }
    folderId = folder.getId();
    props.setProperty('DRIVE_FOLDER_ID', folderId);
  }

  // Buat dan validasi setiap sheet dan header
  var sheetNames = Object.keys(SCHEMA);
  for (var i = 0; i < sheetNames.length; i++) {
    var name = sheetNames[i];
    var expectedHeaders = SCHEMA[name];
    var currentSheet = ss.getSheetByName(name);

    if (!currentSheet) {
      currentSheet = ss.insertSheet(name);
    }

    // Periksa header di baris 1
    var lastCol = currentSheet.getLastColumn();
    var lastRow = currentSheet.getLastRow();

    if (lastRow === 0 || lastCol === 0) {
      // Sheet masih kosong, tulis header
      currentSheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      // Format header
      currentSheet.getRange(1, 1, 1, expectedHeaders.length)
        .setFontWeight('bold')
        .setBackground('#1a73e8')
        .setFontColor('#ffffff');
      currentSheet.setFrozenRows(1);
    } else {
      // Sheet sudah ada, pastikan semua kolom yang diharapkan tersedia
      var existingHeaders = currentSheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var missingHeaders = [];
      for (var h = 0; h < expectedHeaders.length; h++) {
        if (existingHeaders.indexOf(expectedHeaders[h]) === -1) {
          missingHeaders.push(expectedHeaders[h]);
        }
      }
      if (missingHeaders.length > 0) {
        var startCol = lastCol + 1;
        currentSheet.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]);
        currentSheet.getRange(1, startCol, 1, missingHeaders.length)
          .setFontWeight('bold')
          .setBackground('#1a73e8')
          .setFontColor('#ffffff');
      }
    }
  }

  // Hapus sheet default bawaan (Sheet1) jika masih ada dan kosong
  var defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1');
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {
      // Abaikan
    }
  }

  return {
    success: true,
    message: 'Setup database dan folder media selesai dengan sukses.',
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    driveFolderId: folderId
  };
}

/**
 * Membaca seluruh data dari sheet sebagai array of object
 * Header baris 1 digunakan sebagai kunci object
 * @param {string} sheetName Nama sheet
 * @return {Array<Object>} List objek data
 */
function getAllRows(sheetName) {
  var sheet = getDbSheet(sheetName);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow <= 1 || lastCol === 0) {
    return [];
  }

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];
  var result = [];

  for (var r = 1; r < values.length; r++) {
    var rowData = values[r];
    var obj = { _rowIndex: r + 1 };
    var hasContent = false;

    for (var c = 0; c < headers.length; c++) {
      var headerName = headers[c];
      var cellVal = rowData[c];
      obj[headerName] = cellVal;
      if (cellVal !== '' && cellVal !== null && cellVal !== undefined) {
        hasContent = true;
      }
    }

    if (hasContent) {
      result.push(obj);
    }
  }

  return result;
}

/**
 * Menambahkan 1 baris baru ke sheet
 * @param {string} sheetName Nama sheet
 * @param {Object} rowData Objek dengan key sesuai header
 * @return {Object} Objek yang disimpan
 */
function appendRow(sheetName, rowData) {
  var sheet = getDbSheet(sheetName);
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    throw new Error('Sheet ' + sheetName + ' belum memiliki header.');
  }

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var newRow = [];

  for (var c = 0; c < headers.length; c++) {
    var h = headers[c];
    var val = (rowData[h] !== undefined && rowData[h] !== null) ? rowData[h] : '';
    newRow.push(val);
  }

  sheet.appendRow(newRow);
  return rowData;
}

/**
 * Menambahkan banyak baris sekaligus (batch append)
 * @param {string} sheetName Nama sheet
 * @param {Array<Object>} rowsArray Kumpulan objek data
 */
function appendRowsBatch(sheetName, rowsArray) {
  if (!rowsArray || rowsArray.length === 0) return;
  var sheet = getDbSheet(sheetName);
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var rowsToInsert = [];
  for (var i = 0; i < rowsArray.length; i++) {
    var rowData = rowsArray[i];
    var rowVals = [];
    for (var c = 0; c < headers.length; c++) {
      var h = headers[c];
      var val = (rowData[h] !== undefined && rowData[h] !== null) ? rowData[h] : '';
      rowVals.push(val);
    }
    rowsToInsert.push(rowVals);
  }

  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rowsToInsert.length, headers.length).setValues(rowsToInsert);
}

/**
 * Memperbarui baris berdasarkan ID
 * @param {string} sheetName Nama sheet
 * @param {string} idColumn Nama kolom ID (misal: 'SoalID')
 * @param {string} idValue Nilai ID yang dicari
 * @param {Object} updateFields Objek bidang yang ingin diperbarui
 * @return {boolean} True jika berhasil
 */
function updateRow(sheetName, idColumn, idValue, updateFields) {
  var sheet = getDbSheet(sheetName);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return false;

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];
  var idColIdx = headers.indexOf(idColumn);
  if (idColIdx === -1) {
    throw new Error('Kolom ' + idColumn + ' tidak ditemukan di sheet ' + sheetName);
  }

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idColIdx]) === String(idValue)) {
      var rowNum = r + 1;
      for (var key in updateFields) {
        var colIdx = headers.indexOf(key);
        if (colIdx !== -1) {
          sheet.getRange(rowNum, colIdx + 1).setValue(updateFields[key]);
        }
      }
      return true;
    }
  }

  return false;
}

/**
 * Menghapus baris berdasarkan ID
 * @param {string} sheetName Nama sheet
 * @param {string} idColumn Nama kolom ID
 * @param {string} idValue Nilai ID
 * @return {boolean} True jika berhasil dihapus
 */
function deleteRow(sheetName, idColumn, idValue) {
  var sheet = getDbSheet(sheetName);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return false;

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];
  var idColIdx = headers.indexOf(idColumn);
  if (idColIdx === -1) return false;

  for (var r = values.length - 1; r >= 1; r--) {
    if (String(values[r][idColIdx]) === String(idValue)) {
      sheet.deleteRow(r + 1);
      return true;
    }
  }

  return false;
}
