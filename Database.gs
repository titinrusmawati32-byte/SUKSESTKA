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

// Cache Instance Spreadsheet dalam satu eksekusi Web App
var _cachedSpreadsheet = null;

// Cache Memori dalam satu siklus eksekusi (0ms latency)
var _executionMemoryCache = {};

/**
 * Mengambil instance Spreadsheet database (dengan in-memory singleton).
 * @return {Spreadsheet} Instance Google Spreadsheet
 */
function getSpreadsheet() {
  if (_cachedSpreadsheet) return _cachedSpreadsheet;

  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty('SPREADSHEET_ID');

  if (ssId) {
    try {
      _cachedSpreadsheet = SpreadsheetApp.openById(ssId);
      return _cachedSpreadsheet;
    } catch (e) {
      throw new Error('Gagal membuka spreadsheet dengan ID ' + ssId + ': ' + e.message);
    }
  }

  // Cek jika script terikat langsung pada spreadsheet (container-bound)
  try {
    var activeSs = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSs) {
      props.setProperty('SPREADSHEET_ID', activeSs.getId());
      _cachedSpreadsheet = activeSs;
      return _cachedSpreadsheet;
    }
  } catch (err) {}

  throw new Error('Database Spreadsheet belum dikonfigurasi. Jalankan fungsi setupLMS() terlebih dahulu.');
}

/**
 * Menginvalidasi cache lembar tertentu setelah mutasi data (tulis/edit/hapus)
 * @param {string} sheetName Nama sheet
 */
function invalidateSheetCache(sheetName) {
  if (!sheetName) return;
  delete _executionMemoryCache[sheetName];
  try {
    var scriptCache = CacheService.getScriptCache();
    scriptCache.remove('rows_' + sheetName);
  } catch (e) {}
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
 * Normalisasi URL gambar Google Drive menjadi link CDN direct lh3.googleusercontent.com
 * yang kompatibel dengan embedding web tanpa diblokir CORS / cross-origin policy.
 * @param {string} rawUrl URL asli dari database
 * @param {string} fileId File ID jika tersedia
 * @return {string} Direct image URL
 */
function normalizeDriveImageUrl(rawUrl, fileId) {
  var id = fileId || '';
  var raw = String(rawUrl || '').trim();
  if (raw.indexOf('data:image') === 0) return raw;

  if (!id && raw) {
    var m = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
            raw.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
            raw.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/) ||
            raw.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) id = m[1];
    if (!id && /^[a-zA-Z0-9_-]{20,}$/.test(raw) && raw.indexOf('/') === -1 && raw.indexOf('.') === -1) {
      id = raw;
    }
  }

  if (id) {
    return 'https://lh3.googleusercontent.com/d/' + id;
  }
  return raw;
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
 * Menggunakan memori eksekusi dan Google Apps Script CacheService untuk pembacaan instan (~5ms).
 * @param {string} sheetName Nama sheet
 * @param {boolean} skipCache Jika true, paksa baca ulang langsung dari Google Sheets
 * @return {Array<Object>} List objek data
 */
function getAllRows(sheetName, skipCache) {
  // 1. Cek cache memori eksekusi (0ms)
  if (!skipCache && _executionMemoryCache[sheetName]) {
    return _executionMemoryCache[sheetName];
  }

  // 2. Cek CacheService Google Apps Script untuk tabel referensi
  var scriptCache = CacheService.getScriptCache();
  var cacheKey = 'rows_' + sheetName;
  if (!skipCache) {
    try {
      var cachedStr = scriptCache.get(cacheKey);
      if (cachedStr) {
        var parsed = JSON.parse(cachedStr);
        _executionMemoryCache[sheetName] = parsed;
        return parsed;
      }
    } catch (eCache) {}
  }

  // 3. Baca langsung dari Google Sheets dengan pembacaan batch (getValues sekaligus)
  var sheet = getDbSheet(sheetName);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow <= 1 || lastCol === 0) {
    _executionMemoryCache[sheetName] = [];
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

  _executionMemoryCache[sheetName] = result;

  // Simpan ke CacheService jika ukuran data di bawah batas 100KB (prioritas: KELAS, PAKET, BANK_SOAL)
  try {
    var strToCache = JSON.stringify(result);
    if (strToCache.length < 95000) {
      // Simpan selama 120 detik (otomatis invalidasi saat mutasi)
      scriptCache.put(cacheKey, strToCache, 120);
    }
  } catch (errSaveCache) {}

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
  invalidateSheetCache(sheetName);
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
  invalidateSheetCache(sheetName);
}

/**
 * Memperbarui baris berdasarkan ID secara BATCH (menulis seluruh baris dalam 1 kali RPC call)
 * Menggantikan loop setValue cell-by-cell yang menyebabkan latensi tinggi.
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

  var targetStr = String(idValue);
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idColIdx]) === targetStr) {
      var rowNum = r + 1;
      var rowVals = values[r];

      // Update array di memori
      for (var key in updateFields) {
        var colIdx = headers.indexOf(key);
        if (colIdx !== -1) {
          rowVals[colIdx] = updateFields[key];
        }
      }

      // Tulis sekaligus dalam satu baris (1 Network Call!)
      sheet.getRange(rowNum, 1, 1, lastCol).setValues([rowVals]);
      invalidateSheetCache(sheetName);
      return true;
    }
  }

  return false;
}

/**
 * Memperbarui atau menambahkan baris dalam satu pemindaian (1 pass search & batch write)
 * Menghemat waktu hingga 70% pada operasi autosave berkala.
 * @param {string} sheetName Nama sheet
 * @param {Function} matcherFn Fungsi pencocokan (row) => boolean
 * @param {Object} updateFields Bidang yang diperbarui
 * @param {Object} newRecordIfNotFound Record baru jika belum ada
 */
function findAndUpdateOrAppendRow(sheetName, matcherFn, updateFields, newRecordIfNotFound) {
  var sheet = getDbSheet(sheetName);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow <= 1 || lastCol === 0) {
    if (newRecordIfNotFound) {
      appendRow(sheetName, newRecordIfNotFound);
      return { action: 'appended', rowNum: 2 };
    }
    return { action: 'none' };
  }

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];

  for (var r = 1; r < values.length; r++) {
    var rowObj = {};
    for (var c = 0; c < headers.length; c++) {
      rowObj[headers[c]] = values[r][c];
    }

    if (matcherFn(rowObj)) {
      var rowNum = r + 1;
      var rowVals = values[r];
      for (var key in updateFields) {
        var colIdx = headers.indexOf(key);
        if (colIdx !== -1) {
          rowVals[colIdx] = updateFields[key];
        }
      }
      sheet.getRange(rowNum, 1, 1, lastCol).setValues([rowVals]);
      invalidateSheetCache(sheetName);
      return { action: 'updated', rowNum: rowNum };
    }
  }

  if (newRecordIfNotFound) {
    appendRow(sheetName, newRecordIfNotFound);
    return { action: 'appended', rowNum: lastRow + 1 };
  }

  return { action: 'not_found' };
}

/**
 * Memperbarui banyak baris sekaligus dalam 1 panggilan setValues
 * Sangat optimal untuk submit quiz dengan puluhan soal.
 * @param {string} sheetName Nama sheet
 * @param {string} idColumn Nama kolom kunci ID
 * @param {Object} updatesMap Map [idValue -> Object of fields]
 */
function updateRowsBatch(sheetName, idColumn, updatesMap) {
  var sheet = getDbSheet(sheetName);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return 0;

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];
  var idColIdx = headers.indexOf(idColumn);
  if (idColIdx === -1) return 0;

  var updatedCount = 0;
  var hasModified = false;

  for (var r = 1; r < values.length; r++) {
    var rowId = String(values[r][idColIdx]);
    if (updatesMap[rowId]) {
      var fields = updatesMap[rowId];
      for (var key in fields) {
        var cIdx = headers.indexOf(key);
        if (cIdx !== -1) {
          values[r][cIdx] = fields[key];
        }
      }
      updatedCount++;
      hasModified = true;
    }
  }

  if (hasModified) {
    // Tulis kembali seluruh tabel sekaligus dalam 1 operasi RPC super cepat
    sheet.getRange(1, 1, lastRow, lastCol).setValues(values);
    invalidateSheetCache(sheetName);
  }

  return updatedCount;
}

/**
 * Menghapus banyak baris berdasarkan kriteria dalam 1 operasi batch (in-memory rewrite)
 * Menghindari pemanggilan sheet.deleteRow() berulang-ulang di dalam loop.
 * @param {string} sheetName Nama sheet
 * @param {Function} shouldDeleteFn Fungsi (rowObj) => boolean
 */
function deleteRowsBatchByCondition(sheetName, shouldDeleteFn) {
  var sheet = getDbSheet(sheetName);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return 0;

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];
  var keptRows = [headers];
  var deletedCount = 0;

  for (var r = 1; r < values.length; r++) {
    var rowObj = {};
    for (var c = 0; c < headers.length; c++) {
      rowObj[headers[c]] = values[r][c];
    }

    if (shouldDeleteFn(rowObj)) {
      deletedCount++;
    } else {
      keptRows.push(values[r]);
    }
  }

  if (deletedCount > 0) {
    sheet.clearContents();
    sheet.getRange(1, 1, keptRows.length, headers.length).setValues(keptRows);
    invalidateSheetCache(sheetName);
  }

  return deletedCount;
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
      invalidateSheetCache(sheetName);
      return true;
    }
  }

  return false;
}
