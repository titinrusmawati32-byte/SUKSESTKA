/**
 * ============================================================================
 * Aplikasi Latihan Soal SD - Teacher Service
 * File: TeacherService.gs
 * Deskripsi: Modul backend khusus guru mencakup Dashboard, Kelas, Siswa,
 *            Bank Soal, Upload Media, Paket Latihan, Token Akses, dan Hasil/Rekap.
 * ============================================================================
 */

/**
 * Mengambil ringkasan data statistik untuk Dashboard Guru
 * @param {string} sessionToken Token sesi guru
 * @return {Object} Data statistik dashboard
 */
function getTeacherDashboard(sessionToken) {
  var session = validateSession(sessionToken);
  var guruId = session.guruId;

  var allKelas = getAllRows(SHEETS.KELAS).filter(function(k) {
    return k.GuruID === guruId && (k.Aktif === true || String(k.Aktif).toUpperCase() === 'TRUE');
  });

  var allPaket = getAllRows(SHEETS.PAKET_LATIHAN).filter(function(p) {
    return p.GuruID === guruId && p.Status !== 'ARSIP';
  });
  var paketAktif = allPaket.filter(function(p) { return p.Status === 'TERBIT'; });

  var allSoal = getAllRows(SHEETS.BANK_SOAL).filter(function(s) {
    return s.GuruID === guruId && s.Status !== 'ARSIP';
  });

  // Ambil data pengerjaan dari sesi latihan milik paket guru ini
  var paketIdMap = {};
  for (var i = 0; i < allPaket.length; i++) {
    paketIdMap[allPaket[i].PaketID] = allPaket[i].Judul;
  }

  var allSesi = getAllRows(SHEETS.SESI_LATIHAN).filter(function(s) {
    return paketIdMap[s.PaketID] && s.Status === 'SELESAI';
  });

  var totalPengerjaan = allSesi.length;
  var sumNilai = 0;
  for (var j = 0; j < allSesi.length; j++) {
    sumNilai += Number(allSesi[j].NilaiAkhir) || 0;
  }
  var rataRataNilai = totalPengerjaan > 0 ? (sumNilai / totalPengerjaan).toFixed(1) : 0;

  // 5 Sesi pengerjaan terbaru
  allSesi.sort(function(a, b) {
    return new Date(b.DikirimPada) - new Date(a.DikirimPada);
  });
  var recentAttempts = allSesi.slice(0, 5).map(function(s) {
    return {
      sesiId: s.SesiID,
      namaSiswa: s.NamaSiswaSnapshot,
      judulPaket: paketIdMap[s.PaketID] || 'Paket Soal',
      nilaiAkhir: s.NilaiAkhir,
      dikirimPada: s.DikirimPada
    };
  });

  return {
    success: true,
    data: {
      totalKelas: allKelas.length,
      totalPaketAktif: paketAktif.length,
      totalPaket: allPaket.length,
      totalSoal: allSoal.length,
      totalPengerjaan: totalPengerjaan,
      rataRataNilai: rataRataNilai,
      recentAttempts: recentAttempts
    }
  };
}

/* ============================================================================
 * MANAJEMEN KELAS & SISWA
 * ============================================================================ */

/**
 * Mengambil daftar kelas milik guru
 * @param {string} sessionToken Token sesi
 * @return {Object} List kelas
 */
function getTeacherKelas(sessionToken) {
  var session = validateSession(sessionToken);
  var list = getAllRows(SHEETS.KELAS).filter(function(k) {
    return k.GuruID === session.guruId;
  });

  // Hitung jumlah siswa per kelas
  var allSiswa = getAllRows(SHEETS.SISWA).filter(function(s) {
    return s.GuruID === session.guruId && (s.Aktif === true || String(s.Aktif).toUpperCase() === 'TRUE');
  });

  var siswaCountMap = {};
  for (var i = 0; i < allSiswa.length; i++) {
    siswaCountMap[allSiswa[i].KelasID] = (siswaCountMap[allSiswa[i].KelasID] || 0) + 1;
  }

  for (var j = 0; j < list.length; j++) {
    list[j].jumlahSiswa = siswaCountMap[list[j].KelasID] || 0;
  }

  return { success: true, data: list };
}

/**
 * Menyimpan atau memperbarui kelas
 * @param {string} sessionToken Token sesi
 * @param {Object} kelasData Data kelas
 * @return {Object} Status simpan
 */
function saveKelas(sessionToken, kelasData) {
  var session = validateSession(sessionToken);
  if (!kelasData.NamaKelas || kelasData.NamaKelas.trim() === '') {
    throw new Error('Nama kelas wajib diisi.');
  }

  var now = getJakartaTimestamp();
  var isEdit = Boolean(kelasData.KelasID);

  if (isEdit) {
    // Validasi kepemilikan
    var rows = getAllRows(SHEETS.KELAS);
    var target = rows.find(function(k) { return k.KelasID === kelasData.KelasID && k.GuruID === session.guruId; });
    if (!target) throw new Error('Data kelas tidak ditemukan atau bukan milik Anda.');

    updateRow(SHEETS.KELAS, 'KelasID', kelasData.KelasID, {
      NamaKelas: kelasData.NamaKelas.trim(),
      Tingkat: kelasData.Tingkat || '6',
      TahunAjaran: kelasData.TahunAjaran || '',
      Aktif: kelasData.Aktif !== undefined ? kelasData.Aktif : true
    });

    return { success: true, message: 'Kelas berhasil diperbarui.' };
  } else {
    var newId = generateId('KLS');
    appendRow(SHEETS.KELAS, {
      KelasID: newId,
      GuruID: session.guruId,
      NamaKelas: kelasData.NamaKelas.trim(),
      Tingkat: kelasData.Tingkat || '6',
      TahunAjaran: kelasData.TahunAjaran || '',
      Aktif: true,
      DibuatPada: now
    });

    return { success: true, message: 'Kelas baru berhasil ditambahkan.', kelasId: newId };
  }
}

/**
 * Mengarsipkan kelas
 * @param {string} sessionToken Token sesi
 * @param {string} kelasId ID Kelas
 * @return {Object} Status arsip
 */
function archiveKelas(sessionToken, kelasId) {
  var session = validateSession(sessionToken);
  updateRow(SHEETS.KELAS, 'KelasID', kelasId, { Aktif: false });
  return { success: true, message: 'Kelas berhasil diarsipkan.' };
}

/**
 * Mengambil daftar siswa berdasarkan kelas
 * @param {string} sessionToken Token sesi
 * @param {string} kelasId ID Kelas
 * @return {Object} List siswa
 */
function getTeacherSiswa(sessionToken, kelasId) {
  var session = validateSession(sessionToken);
  var list = getAllRows(SHEETS.SISWA).filter(function(s) {
    return s.GuruID === session.guruId &&
           (kelasId ? s.KelasID === kelasId : true) &&
           (s.Aktif === true || String(s.Aktif).toUpperCase() === 'TRUE');
  });

  list.sort(function(a, b) {
    return (Number(a.NomorAbsen) || 999) - (Number(b.NomorAbsen) || 999);
  });

  return { success: true, data: list };
}

/**
 * Menyimpan data siswa
 * @param {string} sessionToken Token sesi
 * @param {Object} siswaData Data siswa
 * @return {Object} Status simpan
 */
function saveSiswa(sessionToken, siswaData) {
  var session = validateSession(sessionToken);
  if (!siswaData.NamaSiswa || siswaData.NamaSiswa.trim() === '') {
    throw new Error('Nama siswa wajib diisi.');
  }
  if (!siswaData.KelasID) {
    throw new Error('Kelas wajib dipilih.');
  }

  var now = getJakartaTimestamp();
  var isEdit = Boolean(siswaData.SiswaID);

  if (isEdit) {
    updateRow(SHEETS.SISWA, 'SiswaID', siswaData.SiswaID, {
      KelasID: siswaData.KelasID,
      NamaSiswa: siswaData.NamaSiswa.trim(),
      NomorAbsen: siswaData.NomorAbsen || '',
      KodeSiswaOpsional: siswaData.KodeSiswaOpsional || ''
    });
    return { success: true, message: 'Data siswa berhasil diperbarui.' };
  } else {
    var newId = generateId('SIS');
    appendRow(SHEETS.SISWA, {
      SiswaID: newId,
      GuruID: session.guruId,
      KelasID: siswaData.KelasID,
      NamaSiswa: siswaData.NamaSiswa.trim(),
      NomorAbsen: siswaData.NomorAbsen || '',
      KodeSiswaOpsional: siswaData.KodeSiswaOpsional || '',
      Aktif: true,
      DibuatPada: now
    });
    return { success: true, message: 'Siswa berhasil ditambahkan.', siswaId: newId };
  }
}

/**
 * Menghapus siswa (soft delete / set Aktif = false)
 * @param {string} sessionToken Token sesi
 * @param {string} siswaId ID Siswa
 * @return {Object} Status hapus
 */
function deleteSiswa(sessionToken, siswaId) {
  var session = validateSession(sessionToken);
  updateRow(SHEETS.SISWA, 'SiswaID', siswaId, { Aktif: false });
  return { success: true, message: 'Siswa berhasil dihapus.' };
}

/* ============================================================================
 * BANK SOAL & UPLOAD MEDIA
 * ============================================================================ */

/**
 * Mengambil daftar soal di Bank Soal milik guru dengan filter
 * @param {string} sessionToken Token sesi
 * @param {Object} filters Filter pencarian (MataPelajaran, Tingkat, JenisSoal, Status, Search)
 * @return {Object} List soal
 */
function getBankSoal(sessionToken, filters) {
  var session = validateSession(sessionToken);
  var f = filters || {};

  var list = getAllRows(SHEETS.BANK_SOAL).filter(function(s) {
    if (s.GuruID !== session.guruId) return false;
    if (f.MataPelajaran && s.MataPelajaran !== f.MataPelajaran) return false;
    if (f.Tingkat && String(s.Tingkat) !== String(f.Tingkat)) return false;
    if (f.JenisSoal && s.JenisSoal !== f.JenisSoal) return false;
    if (f.Status && s.Status !== f.Status) return false;
    if (f.search && f.search.trim()) {
      var kw = f.search.toLowerCase();
      var qText = (s.Pertanyaan || '').toLowerCase();
      var topicText = (s.Topik || '').toLowerCase();
      if (qText.indexOf(kw) === -1 && topicText.indexOf(kw) === -1) return false;
    }
    return true;
  });

  list.sort(function(a, b) {
    return new Date(b.DiperbaruiPada || b.DibuatPada) - new Date(a.DiperbaruiPada || a.DibuatPada);
  });

  for (var k = 0; k < list.length; k++) {
    list[k].GambarURL = normalizeDriveImageUrl(list[k].GambarURL, list[k].GambarFileID);
  }

  return { success: true, data: list };
}

/**
 * Mengunggah gambar dari base64 ke folder Google Drive Media
 * @param {string} base64Data Data gambar base64
 * @param {string} fileName Nama file
 * @return {Object} { fileId, fileUrl }
 */
function uploadImageToDrive(base64Data, fileName) {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('DRIVE_FOLDER_ID');
  var folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();

  // Bersihkan data URL jika ada prefix (misal: "data:image/png;base64,")
  var cleanBase64 = base64Data;
  var mimeType = 'image/png';
  if (base64Data.indexOf(';base64,') !== -1) {
    var parts = base64Data.split(';base64,');
    cleanBase64 = parts[1];
    var mimeMatch = parts[0].match(/data:(.*)/);
    if (mimeMatch) mimeType = mimeMatch[1];
  }

  var decodedBytes = Utilities.base64Decode(cleanBase64);
  var blob = Utilities.newBlob(decodedBytes, mimeType, fileName || ('soal_' + Date.now() + '.png'));
  var file = folder.createFile(blob);
  var fileId = file.getId();

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    try {
      file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    } catch (e2) {
      Logger.log('Set sharing warning: ' + e2);
    }
  }

  // Gunakan Google usercontent CDN direct link untuk embedding web tanpa blokir CORS
  var directUrl = 'https://lh3.googleusercontent.com/d/' + fileId;

  return {
    fileId: fileId,
    fileUrl: directUrl
  };
}

/**
 * Menyimpan atau memperbarui soal di Bank Soal
 * @param {string} sessionToken Token sesi
 * @param {Object} soalData Data soal lengkap
 * @return {Object} Status simpan
 */
function saveSoal(sessionToken, soalData) {
  var session = validateSession(sessionToken);
  if (!soalData.Pertanyaan || soalData.Pertanyaan.trim() === '') {
    throw new Error('Pertanyaan soal wajib diisi.');
  }
  if (!soalData.KunciJawaban || String(soalData.KunciJawaban).trim() === '') {
    throw new Error('Kunci jawaban wajib diisi.');
  }

  var now = getJakartaTimestamp();
  var imageFileId = soalData.GambarFileID || '';
  var imageUrl = soalData.GambarURL || '';

  // Handle upload gambar jika disertakan base64
  if (soalData.imageBase64 && soalData.imageBase64.length > 50) {
    try {
      var uploadRes = uploadImageToDrive(soalData.imageBase64, soalData.imageFileName || 'gambar_soal.png');
      imageFileId = uploadRes.fileId;
      imageUrl = uploadRes.fileUrl;
    } catch (eImg) {
      throw new Error('Gagal mengunggah gambar ke Google Drive: ' + eImg.message);
    }
  }

  var isEdit = Boolean(soalData.SoalID);
  var jenis = soalData.JenisSoal || 'PILIHAN_GANDA';

  var record = {
    MataPelajaran: soalData.MataPelajaran || 'Umum',
    Tingkat: soalData.Tingkat || '6',
    Topik: soalData.Topik || '',
    JenisSoal: jenis,
    Pertanyaan: soalData.Pertanyaan.trim(),
    PilihanA: jenis === 'PILIHAN_GANDA' ? (soalData.PilihanA || '') : '',
    PilihanB: jenis === 'PILIHAN_GANDA' ? (soalData.PilihanB || '') : '',
    PilihanC: jenis === 'PILIHAN_GANDA' ? (soalData.PilihanC || '') : '',
    PilihanD: jenis === 'PILIHAN_GANDA' ? (soalData.PilihanD || '') : '',
    KunciJawaban: String(soalData.KunciJawaban).trim(),
    Pembahasan: soalData.Pembahasan || '',
    Bobot: Number(soalData.Bobot) || 1,
    GambarFileID: imageFileId,
    GambarURL: imageUrl,
    Status: soalData.Status || 'AKTIF',
    DiperbaruiPada: now
  };

  if (isEdit) {
    var rows = getAllRows(SHEETS.BANK_SOAL);
    var target = rows.find(function(s) { return s.SoalID === soalData.SoalID && s.GuruID === session.guruId; });
    if (!target) throw new Error('Soal tidak ditemukan atau bukan milik Anda.');

    updateRow(SHEETS.BANK_SOAL, 'SoalID', soalData.SoalID, record);
    return { success: true, message: 'Soal berhasil diperbarui.', soalId: soalData.SoalID };
  } else {
    var newSoalId = generateId('SOAL');
    record.SoalID = newSoalId;
    record.GuruID = session.guruId;
    record.DibuatPada = now;

    appendRow(SHEETS.BANK_SOAL, record);
    return { success: true, message: 'Soal berhasil disimpan ke Bank Soal.', soalId: newSoalId };
  }
}

/**
 * Menduplikasi soal yang sudah ada
 * @param {string} sessionToken Token sesi
 * @param {string} soalId ID Soal yang ingin diduplikasi
 * @return {Object} Status duplikasi
 */
function duplicateSoal(sessionToken, soalId) {
  var session = validateSession(sessionToken);
  var rows = getAllRows(SHEETS.BANK_SOAL);
  var target = rows.find(function(s) { return s.SoalID === soalId && s.GuruID === session.guruId; });
  if (!target) throw new Error('Soal tidak ditemukan.');

  var newSoal = JSON.parse(JSON.stringify(target));
  var newId = generateId('SOAL');
  var now = getJakartaTimestamp();

  newSoal.SoalID = newId;
  newSoal.Pertanyaan = target.Pertanyaan + ' (Salinan)';
  newSoal.DibuatPada = now;
  newSoal.DiperbaruiPada = now;
  delete newSoal._rowIndex;

  appendRow(SHEETS.BANK_SOAL, newSoal);
  return { success: true, message: 'Soal berhasil diduplikasi.', soalId: newId };
}

/**
 * Mengarsipkan atau menghapus soal
 * @param {string} sessionToken Token sesi
 * @param {string} soalId ID Soal
 * @return {Object} Status
 */
function archiveSoal(sessionToken, soalId) {
  var session = validateSession(sessionToken);
  updateRow(SHEETS.BANK_SOAL, 'SoalID', soalId, {
    Status: 'ARSIP',
    DiperbaruiPada: getJakartaTimestamp()
  });
  return { success: true, message: 'Soal berhasil diarsipkan.' };
}

/* ============================================================================
 * PAKET LATIHAN & PENYUSUNAN SOAL
 * ============================================================================ */

/**
 * Mengambil daftar paket latihan milik guru
 * @param {string} sessionToken Token sesi
 * @return {Object} List paket
 */
function getPaketLatihan(sessionToken) {
  var session = validateSession(sessionToken);
  var paketList = getAllRows(SHEETS.PAKET_LATIHAN).filter(function(p) {
    return p.GuruID === session.guruId && p.Status !== 'ARSIP';
  });

  // Hitung jumlah soal per paket
  var allPaketSoal = getAllRows(SHEETS.PAKET_SOAL);
  var countMap = {};
  for (var i = 0; i < allPaketSoal.length; i++) {
    countMap[allPaketSoal[i].PaketID] = (countMap[allPaketSoal[i].PaketID] || 0) + 1;
  }

  for (var j = 0; j < paketList.length; j++) {
    paketList[j].jumlahSoal = countMap[paketList[j].PaketID] || 0;
  }

  paketList.sort(function(a, b) {
    return new Date(b.DiperbaruiPada || b.DibuatPada) - new Date(a.DiperbaruiPada || a.DibuatPada);
  });

  return { success: true, data: paketList };
}

/**
 * Mengambil detail paket latihan beserta daftar soal yang dipilih
 * @param {string} sessionToken Token sesi
 * @param {string} paketId ID Paket
 * @return {Object} Detail paket dan daftar soal
 */
function getPaketDetail(sessionToken, paketId) {
  var session = validateSession(sessionToken);
  var paket = getAllRows(SHEETS.PAKET_LATIHAN).find(function(p) {
    return p.PaketID === paketId && p.GuruID === session.guruId;
  });
  if (!paket) throw new Error('Paket latihan tidak ditemukan.');

  var paketSoalRows = getAllRows(SHEETS.PAKET_SOAL).filter(function(ps) {
    return ps.PaketID === paketId;
  });

  var soalIds = paketSoalRows.map(function(ps) { return ps.SoalID; });
  var bankSoalRows = getAllRows(SHEETS.BANK_SOAL).filter(function(s) {
    return soalIds.indexOf(s.SoalID) !== -1;
  });

  var bankMap = {};
  for (var i = 0; i < bankSoalRows.length; i++) {
    bankMap[bankSoalRows[i].SoalID] = bankSoalRows[i];
  }

  paketSoalRows.sort(function(a, b) { return (Number(a.Urutan) || 0) - (Number(b.Urutan) || 0); });

  var combinedSoal = [];
  for (var j = 0; j < paketSoalRows.length; j++) {
    var ps = paketSoalRows[j];
    var s = bankMap[ps.SoalID];
    if (s) {
      combinedSoal.push({
        paketSoalId: ps.PaketSoalID,
        soalId: s.SoalID,
        urutan: ps.Urutan,
        bobot: ps.BobotOverride || s.Bobot,
        pertanyaan: s.Pertanyaan,
        gambarUrl: normalizeDriveImageUrl(s.GambarURL, s.GambarFileID),
        jenisSoal: s.JenisSoal,
        topik: s.Topik,
        kunciJawaban: s.KunciJawaban
      });
    }
  }

  return {
    success: true,
    data: {
      paket: paket,
      soalList: combinedSoal
    }
  };
}

/**
 * Menyimpan atau memperbarui paket latihan beserta relasi soalnya
 * @param {string} sessionToken Token sesi
 * @param {Object} paketData Data paket latihan
 * @param {Array<Object>} selectedSoal Array { soalId, urutan, bobotOverride }
 * @return {Object} Status simpan
 */
function savePaketLatihan(sessionToken, paketData, selectedSoal) {
  var session = validateSession(sessionToken);
  if (!paketData.Judul || paketData.Judul.trim() === '') {
    throw new Error('Judul paket latihan wajib diisi.');
  }

  return withScriptLock(function() {
    var now = getJakartaTimestamp();
    var isEdit = Boolean(paketData.PaketID);
    var paketId = paketData.PaketID;

    var record = {
      Judul: paketData.Judul.trim(),
      Deskripsi: paketData.Deskripsi || '',
      Petunjuk: paketData.Petunjuk || 'Kerjakan soal dengan teliti dan pilih jawaban yang paling tepat.',
      MataPelajaran: paketData.MataPelajaran || 'Umum',
      Tingkat: paketData.Tingkat || '6',
      DurasiMenit: Number(paketData.DurasiMenit) || 0,
      MaksPercobaan: Number(paketData.MaksPercobaan) || 1,
      AcakSoal: paketData.AcakSoal === true || paketData.AcakSoal === 'TRUE',
      AcakPilihan: paketData.AcakPilihan === true || paketData.AcakPilihan === 'TRUE',
      TampilkanNilai: paketData.TampilkanNilai !== undefined ? Boolean(paketData.TampilkanNilai) : true,
      TampilkanKunci: paketData.TampilkanKunci !== undefined ? Boolean(paketData.TampilkanKunci) : true,
      TampilkanPembahasan: paketData.TampilkanPembahasan !== undefined ? Boolean(paketData.TampilkanPembahasan) : true,
      MulaiPada: paketData.MulaiPada || '',
      SelesaiPada: paketData.SelesaiPada || '',
      Status: paketData.Status || 'TERBIT',
      DiperbaruiPada: now
    };

    if (isEdit) {
      var existing = getAllRows(SHEETS.PAKET_LATIHAN).find(function(p) {
        return p.PaketID === paketId && p.GuruID === session.guruId;
      });
      if (!existing) throw new Error('Paket tidak ditemukan atau bukan milik Anda.');
      updateRow(SHEETS.PAKET_LATIHAN, 'PaketID', paketId, record);
    } else {
      paketId = generateId('PKT');
      record.PaketID = paketId;
      record.GuruID = session.guruId;
      record.DibuatPada = now;
      appendRow(SHEETS.PAKET_LATIHAN, record);
    }

    // Perbarui PAKET_SOAL jika disertakan (Batch Delete + Batch Append dalam hitungan milidetik)
    if (selectedSoal && Array.isArray(selectedSoal)) {
      // Hapus relasi lama untuk paket ini secara batch (1 pass, tanpa deleteRow loop)
      deleteRowsBatchByCondition(SHEETS.PAKET_SOAL, function(row) {
        return String(row.PaketID) === String(paketId);
      });

      // Masukkan relasi baru secara batch
      var newPsRows = [];
      for (var j = 0; j < selectedSoal.length; j++) {
        var s = selectedSoal[j];
        newPsRows.push({
          PaketSoalID: generateId('PKS'),
          PaketID: paketId,
          SoalID: s.soalId,
          Urutan: s.urutan || (j + 1),
          BobotOverride: s.bobotOverride || ''
        });
      }
      appendRowsBatch(SHEETS.PAKET_SOAL, newPsRows);
    }

    return {
      success: true,
      message: 'Paket latihan berhasil disimpan.',
      paketId: paketId
    };
  });
}

/**
 * Mengubah status paket latihan (DRAF, TERBIT, TUTUP, ARSIP)
 * @param {string} sessionToken Token sesi
 * @param {string} paketId ID Paket
 * @param {string} status Status baru
 * @return {Object} Status
 */
function updatePaketStatus(sessionToken, paketId, status) {
  var session = validateSession(sessionToken);
  var allowed = ['DRAF', 'TERBIT', 'TUTUP', 'ARSIP'];
  if (allowed.indexOf(status) === -1) {
    throw new Error('Status tidak valid: ' + status);
  }

  updateRow(SHEETS.PAKET_LATIHAN, 'PaketID', paketId, {
    Status: status,
    DiperbaruiPada: getJakartaTimestamp()
  });

  return { success: true, message: 'Status paket berhasil diubah menjadi ' + status };
}

/* ============================================================================
 * TOKEN AKSES SISWA
 * ============================================================================ */

/**
 * Menghasilkan token acak yang mudah dibaca siswa (misal: SD6-MAT-8923)
 * @return {string} Kode token
 */
function generateReadableTokenCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Tanpa O, 0, 1, I agar tidak membingungkan
  var code = '';
  for (var i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Mengambil seluruh token untuk paket latihan tertentu
 * @param {string} sessionToken Token sesi
 * @param {string} paketId ID Paket Latihan
 * @return {Object} List token
 */
function getPaketTokens(sessionToken, paketId) {
  var session = validateSession(sessionToken);
  var list = getAllRows(SHEETS.TOKEN_AKSES).filter(function(t) {
    return t.PaketID === paketId;
  });

  return { success: true, data: list };
}

/**
 * Membuat Token Akses baru untuk paket latihan
 * @param {string} sessionToken Token sesi
 * @param {Object} tokenData { paketId, kelasIdOpsional, berlakuSampai, batasPeserta }
 * @return {Object} Token yang berhasil dibuat
 */
function createPaketToken(sessionToken, tokenData) {
  var session = validateSession(sessionToken);
  if (!tokenData.PaketID) throw new Error('Paket ID wajib diisi.');

  return withScriptLock(function() {
    var rawCode = generateReadableTokenCode();
    var hashObj = hashPassword(rawCode, 'TOKEN_SALT');
    var tokenId = generateId('TOK');
    var now = getJakartaTimestamp();

    // Otomatis terbitkan paket latihan jika masih DRAF agar siswa langsung dapat mengerjakan
    try {
      var allPaket = getAllRows(SHEETS.PAKET_LATIHAN);
      var paketTarget = allPaket.find(function(p) { return String(p.PaketID).trim() === String(tokenData.PaketID).trim(); });
      if (paketTarget && String(paketTarget.Status).toUpperCase() !== 'TERBIT' && String(paketTarget.Status).toUpperCase() !== 'TUTUP') {
        updateRow(SHEETS.PAKET_LATIHAN, 'PaketID', tokenData.PaketID, { Status: 'TERBIT', DiperbaruiPada: now });
      }
    } catch (eAutoPub) {
      Logger.log('Auto-publish paket warning: ' + eAutoPub.message);
    }

    var record = {
      TokenID: tokenId,
      PaketID: tokenData.PaketID,
      TokenHash: hashObj.hash,
      KelasIDOpsional: tokenData.KelasIDOpsional || '',
      BerlakuSampai: tokenData.BerlakuSampai || '',
      BatasPeserta: Number(tokenData.BatasPeserta) || 0,
      Aktif: true,
      DibuatPada: now,
      TokenKode: rawCode
    };

    appendRow(SHEETS.TOKEN_AKSES, record);

    return {
      success: true,
      message: 'Token berhasil dibuat.',
      tokenKode: rawCode,
      tokenId: tokenId
    };
  });
}

/**
 * Mengaktifkan atau menonaktifkan token
 * @param {string} sessionToken Token sesi
 * @param {string} tokenId ID Token
 * @param {boolean} aktif Status aktif
 * @return {Object} Status
 */
function toggleTokenStatus(sessionToken, tokenId, aktif) {
  var session = validateSession(sessionToken);
  updateRow(SHEETS.TOKEN_AKSES, 'TokenID', tokenId, {
    Aktif: Boolean(aktif)
  });
  return { success: true, message: 'Status token berhasil diperbarui.' };
}

/* ============================================================================
 * HASIL & REKAP NILAI
 * ============================================================================ */

/**
 * Mengambil daftar pengerjaan siswa dengan filter
 * @param {string} sessionToken Token sesi
 * @param {Object} filters { paketId, kelasId, status }
 * @return {Object} Data pengerjaan dan statistik ringkasan
 */
function getHasilList(sessionToken, filters) {
  var session = validateSession(sessionToken);
  var f = filters || {};

  var myPaket = getAllRows(SHEETS.PAKET_LATIHAN).filter(function(p) {
    return p.GuruID === session.guruId;
  });
  var paketMap = {};
  for (var i = 0; i < myPaket.length; i++) {
    paketMap[myPaket[i].PaketID] = myPaket[i].Judul;
  }

  var allSesi = getAllRows(SHEETS.SESI_LATIHAN).filter(function(s) {
    if (!paketMap[s.PaketID]) return false;
    if (f.paketId && s.PaketID !== f.paketId) return false;
    if (f.kelasId && s.KelasIDSnapshot !== f.kelasId) return false;
    if (f.status && s.Status !== f.status) return false;
    return true;
  });

  allSesi.sort(function(a, b) {
    return new Date(b.DikirimPada || b.MulaiPada) - new Date(a.DikirimPada || a.MulaiPada);
  });

  // Hitung metrik statistik
  var completedList = allSesi.filter(function(s) { return s.Status === 'SELESAI'; });
  var totalPeserta = completedList.length;
  var sumNilai = 0;
  var maxNilai = 0;
  var minNilai = totalPeserta > 0 ? 100 : 0;

  for (var j = 0; j < completedList.length; j++) {
    var val = Number(completedList[j].NilaiAkhir) || 0;
    sumNilai += val;
    if (val > maxNilai) maxNilai = val;
    if (val < minNilai) minNilai = val;
  }

  var rataRata = totalPeserta > 0 ? (sumNilai / totalPeserta).toFixed(1) : 0;

  var formattedList = allSesi.map(function(s) {
    return {
      sesiId: s.SesiID,
      paketId: s.PaketID,
      judulPaket: paketMap[s.PaketID] || 'Paket Soal',
      namaSiswa: s.NamaSiswaSnapshot,
      kelasId: s.KelasIDSnapshot,
      percobaanKe: s.PercobaanKe,
      mulaiPada: s.MulaiPada,
      dikirimPada: s.DikirimPada,
      status: s.Status,
      nilaiAkhir: s.NilaiAkhir,
      skorMaksimal: s.SkorMaksimal
    };
  });

  return {
    success: true,
    data: {
      stats: {
        totalPeserta: totalPeserta,
        rataRata: rataRata,
        nilaiTertinggi: maxNilai,
        nilaiTerendah: minNilai
      },
      list: formattedList
    }
  };
}

/**
 * Mengambil detail lembar jawaban siswa lengkap untuk tinjauan guru
 * @param {string} sessionToken Token sesi
 * @param {string} sesiId ID Sesi Pengerjaan
 * @return {Object} Detail pengerjaan dan jawaban per soal
 */
function getHasilDetail(sessionToken, sesiId) {
  var session = validateSession(sessionToken);
  var sesi = getAllRows(SHEETS.SESI_LATIHAN).find(function(s) { return s.SesiID === sesiId; });
  if (!sesi) throw new Error('Sesi pengerjaan tidak ditemukan.');

  var paket = getAllRows(SHEETS.PAKET_LATIHAN).find(function(p) {
    return p.PaketID === sesi.PaketID && p.GuruID === session.guruId;
  });
  if (!paket) throw new Error('Paket latihan ini bukan milik Anda.');

  var jawabanRows = getAllRows(SHEETS.JAWABAN_SISWA).filter(function(j) {
    return j.SesiID === sesiId;
  });

  var bankSoalRows = getAllRows(SHEETS.BANK_SOAL);
  var bankMap = {};
  for (var i = 0; i < bankSoalRows.length; i++) {
    bankMap[bankSoalRows[i].SoalID] = bankSoalRows[i];
  }

  var detailList = [];
  var totalBenar = 0;
  var totalSalah = 0;
  var totalKosong = 0;

  for (var k = 0; k < jawabanRows.length; k++) {
    var jw = jawabanRows[k];
    var so = bankMap[jw.SoalID] || {};
    var isBenar = (jw.Benar === true || String(jw.Benar).toUpperCase() === 'TRUE');
    var isKosong = !jw.Jawaban || String(jw.Jawaban).trim() === '';

    if (isKosong) {
      totalKosong++;
    } else if (isBenar) {
      totalBenar++;
    } else {
      totalSalah++;
    }

    detailList.push({
      jawabanId: jw.JawabanID,
      soalId: jw.SoalID,
      pertanyaan: so.Pertanyaan || 'Soal telah dihapus',
      jenisSoal: so.JenisSoal || 'PILIHAN_GANDA',
      jawabanSiswa: jw.Jawaban,
      kunciJawaban: so.KunciJawaban || '',
      pembahasan: so.Pembahasan || '',
      skor: jw.Skor,
      bobot: so.Bobot || 1,
      benar: isBenar,
      pilihanA: so.PilihanA,
      pilihanB: so.PilihanB,
      pilihanC: so.PilihanC,
      pilihanD: so.PilihanD
    });
  }

  return {
    success: true,
    data: {
      sesi: sesi,
      paket: paket,
      ringkasan: {
        totalBenar: totalBenar,
        totalSalah: totalSalah,
        totalKosong: totalKosong,
        totalSoal: detailList.length
      },
      jawabanList: detailList
    }
  };
}

/**
 * Memperbarui skor jawaban siswa secara manual (misal koreksi isian singkat)
 * dan menghitung ulang NilaiAkhir di SESI_LATIHAN
 * @param {string} sessionToken Token sesi
 * @param {string} jawabanId ID Jawaban
 * @param {number} skorBaru Nilai skor baru
 * @param {boolean} benarBaru Status benar baru
 * @return {Object} Status dan nilai akhir baru
 */
function updateJawabanManual(sessionToken, jawabanId, skorBaru, benarBaru) {
  var session = validateSession(sessionToken);

  return withScriptLock(function() {
    var jwList = getAllRows(SHEETS.JAWABAN_SISWA);
    var targetJw = jwList.find(function(j) { return j.JawabanID === jawabanId; });
    if (!targetJw) throw new Error('Data jawaban tidak ditemukan.');

    var now = getJakartaTimestamp();
    updateRow(SHEETS.JAWABAN_SISWA, 'JawabanID', jawabanId, {
      Skor: Number(skorBaru) || 0,
      Benar: Boolean(benarBaru),
      DiperbaruiPada: now
    });

    // Hitung ulang nilai akhir sesi
    var allJwSesi = getAllRows(SHEETS.JAWABAN_SISWA).filter(function(j) {
      return j.SesiID === targetJw.SesiID;
    });

    var totalSkorDiperoleh = 0;
    for (var i = 0; i < allJwSesi.length; i++) {
      if (allJwSesi[i].JawabanID === jawabanId) {
        totalSkorDiperoleh += Number(skorBaru) || 0;
      } else {
        totalSkorDiperoleh += Number(allJwSesi[i].Skor) || 0;
      }
    }

    var sesi = getAllRows(SHEETS.SESI_LATIHAN).find(function(s) { return s.SesiID === targetJw.SesiID; });
    var skorMaks = Number(sesi.SkorMaksimal) || 1;
    var nilaiAkhir = Math.round((totalSkorDiperoleh / skorMaks) * 100 * 100) / 100;

    updateRow(SHEETS.SESI_LATIHAN, 'SesiID', targetJw.SesiID, {
      NilaiAkhir: nilaiAkhir,
      TerakhirAktif: now
    });

    return {
      success: true,
      message: 'Nilai jawaban berhasil diperbarui.',
      nilaiAkhirBaru: nilaiAkhir
    };
  });
}

/**
 * Mengekspor hasil latihan siswa dalam format string CSV yang kompatibel dengan Excel
 * @param {string} sessionToken Token sesi
 * @param {string} paketId ID Paket Latihan
 * @param {string} kelasId ID Kelas (opsional)
 * @return {Object} { csvContent, fileName }
 */
function exportHasilCsv(sessionToken, paketId, kelasId) {
  var session = validateSession(sessionToken);
  var hasilRes = getHasilList(sessionToken, { paketId: paketId, kelasId: kelasId, status: 'SELESAI' });
  var list = hasilRes.data.list;

  var headers = ['No', 'Nama Siswa', 'Kelas', 'Paket Latihan', 'Percobaan Ke', 'Waktu Mulai', 'Waktu Selesai', 'Nilai Akhir'];
  var csvLines = [headers.join(',')];

  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var row = [
      i + 1,
      '"' + (item.namaSiswa || '').replace(/"/g, '""') + '"',
      '"' + (item.kelasId || '-').replace(/"/g, '""') + '"',
      '"' + (item.judulPaket || '').replace(/"/g, '""') + '"',
      item.percobaanKe || 1,
      '"' + (item.mulaiPada || '') + '"',
      '"' + (item.dikirimPada || '') + '"',
      item.nilaiAkhir || 0
    ];
    csvLines.push(row.join(','));
  }

  // Tambahkan baris statistik ringkasan
  csvLines.push('');
  csvLines.push('Statistik Ringkasan:');
  csvLines.push('Total Peserta,' + hasilRes.data.stats.totalPeserta);
  csvLines.push('Rata-rata Nilai,' + hasilRes.data.stats.rataRata);
  csvLines.push('Nilai Tertinggi,' + hasilRes.data.stats.nilaiTertinggi);
  csvLines.push('Nilai Terendah,' + hasilRes.data.stats.nilaiTerendah);

  var fileName = 'Rekap_Nilai_' + (paketId || 'Semua') + '_' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMdd_HHmm') + '.csv';

  return {
    success: true,
    fileName: fileName,
    csvContent: csvLines.join('\r\n')
  };
}

/**
 * Memperbaiki izin berbagi file gambar di Google Drive agar dapat diakses publik
 * serta menormalkan GambarURL di sheet BANK_SOAL.
 * @param {string} sessionToken Token sesi guru
 * @return {Object} Status perbaikan
 */
function fixImagePermissions(sessionToken) {
  var session = validateSession(sessionToken);
  var bankRows = getAllRows(SHEETS.BANK_SOAL);
  var fixedCount = 0;

  for (var i = 0; i < bankRows.length; i++) {
    var row = bankRows[i];
    var fileId = row.GambarFileID;
    if (!fileId && row.GambarURL) {
      var m = String(row.GambarURL).match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
              String(row.GambarURL).match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
              String(row.GambarURL).match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/) ||
              String(row.GambarURL).match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (m) fileId = m[1];
    }

    if (fileId) {
      try {
        var file = DriveApp.getFileById(fileId);
        try {
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (e1) {
          try {
            file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
          } catch (e2) {}
        }
        var newUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
        updateRow(SHEETS.BANK_SOAL, 'SoalID', row.SoalID, {
          GambarFileID: fileId,
          GambarURL: newUrl
        });
        fixedCount++;
      } catch (errFile) {
        Logger.log('Gagal perbaiki sharing file ' + fileId + ': ' + errFile.message);
      }
    }
  }

  return {
    success: true,
    message: 'Berhasil memverifikasi dan memperbarui izin ' + fixedCount + ' gambar soal di Google Drive.'
  };
}
