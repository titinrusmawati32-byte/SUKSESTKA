/**
 * ============================================================================
 * Aplikasi Latihan Soal SD - Import Service
 * File: ImportService.gs
 * Deskripsi: Template CSV/Excel, parsing, validasi baris per baris, pratinjau,
 *            dan commit penyimpanan untuk Bank Soal dan Daftar Siswa.
 * ============================================================================
 */

/**
 * Mengambil isi template CSV Bank Soal beserta baris contoh
 * @return {string} Konten CSV
 */
function getTemplateSoalCsv() {
  var headers = [
    'MataPelajaran', 'Kelas', 'Topik', 'JenisSoal',
    'Pertanyaan', 'PilihanA', 'PilihanB', 'PilihanC', 'PilihanD',
    'KunciJawaban', 'Pembahasan', 'Bobot'
  ];

  var sample1 = [
    'Matematika', '6', 'Pecahan', 'PILIHAN_GANDA',
    'Hasil dari 1/2 + 1/4 adalah...', '1/6', '2/6', '3/4', '4/4',
    'C', 'Samakan penyebut menjadi 4: 2/4 + 1/4 = 3/4', '1'
  ];

  var sample2 = [
    'IPA', '6', 'Tata Surya', 'BENAR_SALAH',
    'Matahari adalah pusat dari tata surya kita.', '', '', '', '',
    'BENAR', 'Matahari merupakan bintang pusat tata surya.', '1'
  ];

  var sample3 = [
    'Bahasa Indonesia', '6', 'Ibukota', 'ISIAN_SINGKAT',
    'Apakah nama ibukota negara Indonesia saat ini?', '', '', '', '',
    'Jakarta;DKI Jakarta', 'Ibukota saat ini masih DKI Jakarta.', '2'
  ];

  var lines = [
    headers.join(','),
    sample1.map(escapeCsvCell).join(','),
    sample2.map(escapeCsvCell).join(','),
    sample3.map(escapeCsvCell).join(',')
  ];

  return lines.join('\r\n');
}

/**
 * Mengambil isi template CSV Daftar Siswa
 * @return {string} Konten CSV
 */
function getTemplateSiswaCsv() {
  var headers = ['NamaSiswa', 'NomorAbsen', 'KodeSiswaOpsional'];
  var sample1 = ['Ahmad Dahlan', '1', 'SIS-001'];
  var sample2 = ['Budi Santoso', '2', 'SIS-002'];
  var sample3 = ['Citra Lestari', '3', 'SIS-003'];

  var lines = [
    headers.join(','),
    sample1.map(escapeCsvCell).join(','),
    sample2.map(escapeCsvCell).join(','),
    sample3.map(escapeCsvCell).join(',')
  ];

  return lines.join('\r\n');
}

/**
 * Escape sel CSV jika mengandung koma, newline, atau tanda kutip ganda
 */
function escapeCsvCell(cell) {
  var val = String(cell || '');
  if (val.indexOf(',') !== -1 || val.indexOf('"') !== -1 || val.indexOf('\n') !== -1 || val.indexOf('\r') !== -1) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

/**
 * Parser CSV sederhana namun tangguh terhadap koma di dalam tanda kutip
 * @param {string} text Konten teks CSV
 * @return {Array<Array<string>>} Matriks baris dan kolom
 */
function parseCsvContent(text) {
  if (!text) return [];
  var lines = [];
  var currentLine = [];
  var currentCell = '';
  var insideQuotes = false;

  for (var i = 0; i < text.length; i++) {
    var c = text.charAt(i);
    var nextC = text.charAt(i + 1);

    if (c === '"') {
      if (insideQuotes && nextC === '"') {
        currentCell += '"';
        i++; // lewati quote berikutnya
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (c === ',' && !insideQuotes) {
      currentLine.push(currentCell.trim());
      currentCell = '';
    } else if ((c === '\r' || c === '\n') && !insideQuotes) {
      if (c === '\r' && nextC === '\n') {
        i++;
      }
      currentLine.push(currentCell.trim());
      currentCell = '';
      if (currentLine.length > 0 && !(currentLine.length === 1 && currentLine[0] === '')) {
        lines.push(currentLine);
      }
      currentLine = [];
    } else {
      currentCell += c;
    }
  }

  if (currentCell !== '' || currentLine.length > 0) {
    currentLine.push(currentCell.trim());
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Memeriksa dan memberikan pratinjau data impor Bank Soal sebelum disimpan
 * @param {string} sessionToken Token sesi guru
 * @param {string} csvContent String teks file CSV yang diunggah
 * @return {Object} Laporan validasi dan data pratinjau
 */
function previewImportSoal(sessionToken, csvContent) {
  validateSession(sessionToken);

  if (!csvContent || csvContent.trim() === '') {
    throw new Error('File CSV kosong.');
  }

  var rawMatrix = parseCsvContent(csvContent);
  if (rawMatrix.length < 2) {
    throw new Error('File CSV harus memiliki minimal 1 baris header dan 1 baris data.');
  }

  var headers = rawMatrix[0].map(function(h) { return h.replace(/\s+/g, ''); });
  var colMap = {};
  for (var h = 0; h < headers.length; h++) {
    colMap[headers[h]] = h;
  }

  var requiredCols = ['MataPelajaran', 'JenisSoal', 'Pertanyaan', 'KunciJawaban'];
  for (var r = 0; r < requiredCols.length; r++) {
    if (colMap[requiredCols[r]] === undefined) {
      throw new Error('Kolom wajib "' + requiredCols[r] + '" tidak ditemukan pada header CSV.');
    }
  }

  var validRows = [];
  var errors = [];

  for (var i = 1; i < rawMatrix.length; i++) {
    var row = rawMatrix[i];
    var rowNum = i + 1;

    // Abaikan baris kosong
    var isBlank = row.every(function(cell) { return cell === ''; });
    if (isBlank) continue;

    var mapel = row[colMap['MataPelajaran']] || '';
    var kelas = row[colMap['Kelas']] || '6';
    var topik = row[colMap['Topik']] || '';
    var jenis = (row[colMap['JenisSoal']] || '').toUpperCase().trim();
    var pertanyaan = row[colMap['Pertanyaan']] || '';
    var pilA = (colMap['PilihanA'] !== undefined ? row[colMap['PilihanA']] : '') || '';
    var pilB = (colMap['PilihanB'] !== undefined ? row[colMap['PilihanB']] : '') || '';
    var pilC = (colMap['PilihanC'] !== undefined ? row[colMap['PilihanC']] : '') || '';
    var pilD = (colMap['PilihanD'] !== undefined ? row[colMap['PilihanD']] : '') || '';
    var kunci = row[colMap['KunciJawaban']] || '';
    var pembahasan = (colMap['Pembahasan'] !== undefined ? row[colMap['Pembahasan']] : '') || '';
    var bobotStr = (colMap['Bobot'] !== undefined ? row[colMap['Bobot']] : '1') || '1';

    var rowErrors = [];

    if (!mapel) rowErrors.push('Mata pelajaran tidak boleh kosong');
    if (!pertanyaan) rowErrors.push('Pertanyaan tidak boleh kosong');
    if (!kunci) rowErrors.push('Kunci jawaban tidak boleh kosong');

    var validJenis = ['PILIHAN_GANDA', 'BENAR_SALAH', 'ISIAN_SINGKAT'];
    if (validJenis.indexOf(jenis) === -1) {
      rowErrors.push('JenisSoal harus salah satu dari: PILIHAN_GANDA, BENAR_SALAH, ISIAN_SINGKAT');
    }

    if (jenis === 'PILIHAN_GANDA') {
      var kUpper = kunci.toUpperCase().trim();
      if (['A', 'B', 'C', 'D'].indexOf(kUpper) === -1) {
        rowErrors.push('Kunci jawaban pilihan ganda harus berupa A, B, C, atau D');
      }
      if (!pilA || !pilB) {
        rowErrors.push('Pilihan A dan B wajib diisi untuk pilihan ganda');
      }
    } else if (jenis === 'BENAR_SALAH') {
      var bsUpper = kunci.toUpperCase().trim();
      if (['BENAR', 'SALAH', 'B', 'S', 'TRUE', 'FALSE'].indexOf(bsUpper) === -1) {
        rowErrors.push('Kunci jawaban benar/salah harus BENAR atau SALAH');
      }
    }

    var bobot = Number(bobotStr);
    if (isNaN(bobot) || bobot <= 0) {
      rowErrors.push('Bobot harus berupa angka positif');
    }

    if (rowErrors.length > 0) {
      errors.push({
        baris: rowNum,
        alasan: rowErrors.join(', ')
      });
    } else {
      validRows.push({
        MataPelajaran: mapel,
        Tingkat: kelas,
        Topik: topik,
        JenisSoal: jenis,
        Pertanyaan: pertanyaan,
        PilihanA: pilA,
        PilihanB: pilB,
        PilihanC: pilC,
        PilihanD: pilD,
        KunciJawaban: kunci,
        Pembahasan: pembahasan,
        Bobot: bobot
      });
    }
  }

  return {
    success: true,
    totalBaris: rawMatrix.length - 1,
    jumlahValid: validRows.length,
    jumlahGagal: errors.length,
    previewData: validRows.slice(0, 10), // Tampilkan 10 baris pertama untuk pratinjau
    validRowsPayload: validRows, // Digunakan saat konfirmasi commit
    errors: errors
  };
}

/**
 * Menyimpan data impor Bank Soal yang telah dikonfirmasi guru
 * @param {string} sessionToken Token sesi
 * @param {Array<Object>} validRows Array baris valid hasil preview
 * @return {Object} Status hasil simpan
 */
function commitImportSoal(sessionToken, validRows) {
  var session = validateSession(sessionToken);
  if (!validRows || !Array.isArray(validRows) || validRows.length === 0) {
    throw new Error('Tidak ada data valid yang dapat disimpan.');
  }

  return withScriptLock(function() {
    var now = getJakartaTimestamp();
    var recordsToInsert = [];

    for (var i = 0; i < validRows.length; i++) {
      var item = validRows[i];
      recordsToInsert.push({
        SoalID: generateId('SOAL'),
        GuruID: session.guruId,
        MataPelajaran: item.MataPelajaran,
        Tingkat: item.Tingkat || '6',
        Topik: item.Topik || '',
        JenisSoal: item.JenisSoal,
        Pertanyaan: item.Pertanyaan,
        PilihanA: item.PilihanA || '',
        PilihanB: item.PilihanB || '',
        PilihanC: item.PilihanC || '',
        PilihanD: item.PilihanD || '',
        KunciJawaban: item.KunciJawaban,
        Pembahasan: item.Pembahasan || '',
        Bobot: item.Bobot || 1,
        GambarFileID: '',
        GambarURL: '',
        Status: 'AKTIF',
        DibuatPada: now,
        DiperbaruiPada: now
      });
    }

    appendRowsBatch(SHEETS.BANK_SOAL, recordsToInsert);

    return {
      success: true,
      message: 'Berhasil mengimpor ' + recordsToInsert.length + ' soal ke Bank Soal.',
      totalDiimpor: recordsToInsert.length
    };
  });
}

/**
 * Pratinjau data impor Siswa ke Kelas
 * @param {string} sessionToken Token sesi
 * @param {string} kelasId ID Kelas tujuan
 * @param {string} csvContent Isi CSV siswa
 * @return {Object} Pratinjau dan laporan validasi
 */
function previewImportSiswa(sessionToken, kelasId, csvContent) {
  validateSession(sessionToken);
  if (!kelasId) throw new Error('Kelas tujuan belum dipilih.');
  if (!csvContent || csvContent.trim() === '') throw new Error('File CSV kosong.');

  var rawMatrix = parseCsvContent(csvContent);
  if (rawMatrix.length < 2) {
    throw new Error('File CSV harus memiliki minimal 1 baris header dan 1 baris data.');
  }

  var headers = rawMatrix[0].map(function(h) { return h.replace(/\s+/g, ''); });
  var colMap = {};
  for (var h = 0; h < headers.length; h++) {
    colMap[headers[h]] = h;
  }

  if (colMap['NamaSiswa'] === undefined) {
    throw new Error('Kolom "NamaSiswa" wajib ada pada header CSV.');
  }

  var validRows = [];
  var errors = [];
  var existingSiswa = getAllRows(SHEETS.SISWA).filter(function(s) {
    return s.KelasID === kelasId && (s.Aktif === true || String(s.Aktif).toUpperCase() === 'TRUE');
  });

  var existingNames = {};
  for (var e = 0; e < existingSiswa.length; e++) {
    existingNames[String(existingSiswa[e].NamaSiswa).toLowerCase().trim()] = true;
  }

  for (var i = 1; i < rawMatrix.length; i++) {
    var row = rawMatrix[i];
    var rowNum = i + 1;
    var isBlank = row.every(function(cell) { return cell === ''; });
    if (isBlank) continue;

    var nama = (row[colMap['NamaSiswa']] || '').trim();
    var absen = (colMap['NomorAbsen'] !== undefined ? row[colMap['NomorAbsen']] : '') || '';
    var kode = (colMap['KodeSiswaOpsional'] !== undefined ? row[colMap['KodeSiswaOpsional']] : '') || '';

    if (!nama) {
      errors.push({ baris: rowNum, alasan: 'Nama siswa tidak boleh kosong' });
      continue;
    }

    if (existingNames[nama.toLowerCase()]) {
      errors.push({ baris: rowNum, alasan: 'Siswa dengan nama "' + nama + '" sudah terdaftar di kelas ini' });
      continue;
    }

    validRows.push({
      NamaSiswa: nama,
      NomorAbsen: absen,
      KodeSiswaOpsional: kode
    });
  }

  return {
    success: true,
    totalBaris: rawMatrix.length - 1,
    jumlahValid: validRows.length,
    jumlahGagal: errors.length,
    previewData: validRows.slice(0, 10),
    validRowsPayload: validRows,
    errors: errors
  };
}

/**
 * Menyimpan data impor siswa yang telah dikonfirmasi
 * @param {string} sessionToken Token sesi
 * @param {string} kelasId ID Kelas tujuan
 * @param {Array<Object>} validRows Array data siswa
 * @return {Object} Status simpan
 */
function commitImportSiswa(sessionToken, kelasId, validRows) {
  var session = validateSession(sessionToken);
  if (!kelasId) throw new Error('Kelas tujuan belum dipilih.');
  if (!validRows || validRows.length === 0) throw new Error('Tidak ada data siswa yang valid.');

  return withScriptLock(function() {
    var now = getJakartaTimestamp();
    var recordsToInsert = [];

    for (var i = 0; i < validRows.length; i++) {
      var item = validRows[i];
      recordsToInsert.push({
        SiswaID: generateId('SIS'),
        GuruID: session.guruId,
        KelasID: kelasId,
        NamaSiswa: item.NamaSiswa,
        NomorAbsen: item.NomorAbsen || '',
        KodeSiswaOpsional: item.KodeSiswaOpsional || '',
        Aktif: true,
        DibuatPada: now
      });
    }

    appendRowsBatch(SHEETS.SISWA, recordsToInsert);

    return {
      success: true,
      message: 'Berhasil mengimpor ' + recordsToInsert.length + ' siswa.',
      totalDiimpor: recordsToInsert.length
    };
  });
}
