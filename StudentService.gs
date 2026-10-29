/**
 * ============================================================================
 * Aplikasi Latihan Soal SD - Student Service
 * File: StudentService.gs
 * Deskripsi: Modul backend pengerjaan siswa tanpa login akun:
 *            validasi token, mulai/lanjut sesi (tahan refresh), autosave,
 *            penilaian otomatis di server, dan perlindungan kunci jawaban.
 * ============================================================================
 */

/**
 * Validasi token latihan siswa dan mengembalikan metadata paket latihan yang aman
 * @param {string} tokenString Kode token yang dimasukkan siswa
 * @return {Object} Metadata latihan
 */
function validateStudentToken(tokenString) {
  // Jika dieksekusi langsung dari editor Google Apps Script tanpa parameter (saat klik "Jalankan")
  if (typeof tokenString === 'undefined' || tokenString === null || String(tokenString).trim() === '') {
    // Cek apakah dipanggil langsung di editor Apps Script
    var allActiveTokens = getAllRows(SHEETS.TOKEN_AKSES).filter(function(t) {
      return (t.Aktif === true || String(t.Aktif).toUpperCase() === 'TRUE');
    });
    if (allActiveTokens.length > 0) {
      Logger.log('[Uji Coba Editor] Menggunakan token aktif: ' + allActiveTokens[0].TokenKode);
      tokenString = allActiveTokens[0].TokenKode;
    } else {
      throw new Error('Silakan masukkan token latihan melalui Web App atau buat token terlebih dahulu di menu Token Siswa.');
    }
  }

  var cleanCode = String(tokenString).trim().toUpperCase();
  var allTokens = getAllRows(SHEETS.TOKEN_AKSES);
  var targetToken = null;

  for (var i = 0; i < allTokens.length; i++) {
    var t = allTokens[i];
    var isAktif = (t.Aktif === true || String(t.Aktif).toUpperCase() === 'TRUE');
    if (!isAktif) continue;

    // Cocokkan via TokenKode atau TokenHash
    if (String(t.TokenKode).trim().toUpperCase() === cleanCode || String(t.TokenHash).trim().toUpperCase() === cleanCode) {
      targetToken = t;
      break;
    }
  }

  if (!targetToken) {
    throw new Error('Token latihan "' + cleanCode + '" tidak valid atau sudah dinonaktifkan.');
  }

  // Cek masa berlaku token
  var now = new Date();
  if (targetToken.BerlakuSampai) {
    var expDate = (targetToken.BerlakuSampai instanceof Date) ? targetToken.BerlakuSampai : new Date(targetToken.BerlakuSampai);
    if (!isNaN(expDate.getTime()) && now > expDate) {
      throw new Error('Masa berlaku token latihan ini telah habis.');
    }
  }

  // Ambil paket latihan
  var paket = getAllRows(SHEETS.PAKET_LATIHAN).find(function(p) {
    return String(p.PaketID).trim() === String(targetToken.PaketID).trim();
  });

  if (!paket) {
    throw new Error('Paket latihan untuk token ini tidak ditemukan di database.');
  }

  var paketStatus = String(paket.Status || '').trim().toUpperCase();
  // Hanya tolak jika status latihan secara eksplisit ditutup atau diarsipkan
  if (paketStatus === 'TUTUP' || paketStatus === 'ARSIP') {
    throw new Error('Latihan ini sedang ditutup atau diarsipkan oleh bapak/ibu guru. Mohon hubungi guru Anda.');
  }

  // Jika paket masih DRAF / DRAFT namun token aktif telah dibuat oleh guru, otomatis terbitkan
  if (paketStatus === 'DRAF' || paketStatus === 'DRAFT' || paketStatus === '') {
    try {
      updateRow(SHEETS.PAKET_LATIHAN, 'PaketID', paket.PaketID, { Status: 'TERBIT' });
      paket.Status = 'TERBIT';
    } catch (eAutoPub) {
      Logger.log('Auto-publish paket warning: ' + eAutoPub.message);
    }
  }

  // Cek jadwal mulai dan selesai paket
  if (paket.MulaiPada) {
    var startDate = (paket.MulaiPada instanceof Date) ? paket.MulaiPada : new Date(paket.MulaiPada);
    if (!isNaN(startDate.getTime()) && now < startDate) {
      throw new Error('Latihan ini belum dimulai. Waktu mulai: ' + String(paket.MulaiPada));
    }
  }

  if (paket.SelesaiPada) {
    var endDate = (paket.SelesaiPada instanceof Date) ? paket.SelesaiPada : new Date(paket.SelesaiPada);
    if (!isNaN(endDate.getTime()) && now > endDate) {
      throw new Error('Waktu pengerjaan latihan ini sudah berakhir pada: ' + String(paket.SelesaiPada));
    }
  }

  // Cek batas peserta jika ditentukan
  if (Number(targetToken.BatasPeserta) > 0) {
    var sesiList = getAllRows(SHEETS.SESI_LATIHAN).filter(function(s) {
      return s.TokenID === targetToken.TokenID;
    });
    if (sesiList.length >= Number(targetToken.BatasPeserta)) {
      throw new Error('Kuota peserta untuk token ini sudah penuh.');
    }
  }

  // Jika token dibatasi untuk kelas tertentu, ambil data kelas dan daftar siswa
  var kelasData = null;
  var studentList = [];
  if (targetToken.KelasIDOpsional && String(targetToken.KelasIDOpsional).trim() !== '') {
    var kelasRow = getAllRows(SHEETS.KELAS).find(function(k) {
      return k.KelasID === targetToken.KelasIDOpsional;
    });
    if (kelasRow) {
      kelasData = {
        kelasId: kelasRow.KelasID,
        namaKelas: kelasRow.NamaKelas,
        tingkat: kelasRow.Tingkat
      };
      // Ambil daftar siswa aktif di kelas tersebut
      studentList = getAllRows(SHEETS.SISWA).filter(function(s) {
        return s.KelasID === kelasRow.KelasID &&
               (s.Aktif === true || String(s.Aktif).toUpperCase() === 'TRUE');
      }).map(function(s) {
        return {
          siswaId: s.SiswaID,
          namaSiswa: s.NamaSiswa,
          nomorAbsen: s.NomorAbsen
        };
      });
      studentList.sort(function(a, b) {
        return (Number(a.nomorAbsen) || 999) - (Number(b.nomorAbsen) || 999);
      });
    }
  }

  return {
    success: true,
    token: cleanCode,
    tokenId: targetToken.TokenID,
    paket: {
      paketId: paket.PaketID,
      judul: paket.Judul,
      deskripsi: paket.Deskripsi,
      petunjuk: paket.Petunjuk,
      mataPelajaran: paket.MataPelajaran,
      tingkat: paket.Tingkat,
      durasiMenit: Number(paket.DurasiMenit) || 0,
      maksPercobaan: Number(paket.MaksPercobaan) || 1
    },
    kelas: kelasData,
    studentList: studentList
  };
}

/**
 * Mulai pengerjaan baru atau melanjutkan sesi yang sedang berjalan (tahan refresh)
 * @param {string} tokenString Kode token
 * @param {Object} studentData { namaSiswa, kelasId, siswaId }
 * @return {Object} Data sesi dan kumpulan soal aman (tanpa kunci jawaban!)
 */
function startOrResumeSession(tokenString, studentData) {
  if (!studentData || !studentData.namaSiswa || studentData.namaSiswa.trim() === '') {
    throw new Error('Nama siswa wajib diisi.');
  }

  var tokenMeta = validateStudentToken(tokenString);
  var paketId = tokenMeta.paket.paketId;
  var tokenId = tokenMeta.tokenId;
  var namaSiswa = studentData.namaSiswa.trim();
  var kelasId = studentData.kelasId || (tokenMeta.kelas ? tokenMeta.kelas.kelasId : '');
  var siswaId = studentData.siswaId || '';

  return withScriptLock(function() {
    var nowJakarta = getJakartaTimestamp();
    var nowDate = new Date();

    // Cek seluruh sesi untuk siswa ini pada paket ini
    var allSesi = getAllRows(SHEETS.SESI_LATIHAN).filter(function(s) {
      return s.PaketID === paketId &&
             String(s.NamaSiswaSnapshot).toLowerCase() === namaSiswa.toLowerCase();
    });

    // 1. Cek apakah ada sesi yang masih AKTIF (SEDANG_MENGERJAKAN) -> RESUME!
    var activeSesi = allSesi.find(function(s) {
      return s.Status === 'SEDANG_MENGERJAKAN';
    });

    if (activeSesi) {
      // Cek apakah batas waktu sudah lewat
      var isExpired = false;
      if (activeSesi.BatasWaktu) {
        var deadline = (activeSesi.BatasWaktu instanceof Date) ? activeSesi.BatasWaktu : new Date(activeSesi.BatasWaktu);
        if (!isNaN(deadline.getTime()) && nowDate > deadline) {
          isExpired = true;
        }
      }

      if (isExpired) {
        // Otomatis kumpulkan jawaban yang sudah ada
        autoSubmitSessionOnTimeout(activeSesi.SesiID);
        throw new Error('Waktu pengerjaan untuk sesi Anda sebelumnya telah habis.');
      } else {
        // Lanjutkan sesi aktif!
        updateRow(SHEETS.SESI_LATIHAN, 'SesiID', activeSesi.SesiID, {
          TerakhirAktif: nowJakarta
        });
        return buildSessionPayload(activeSesi, tokenMeta.paket, true);
      }
    }

    // 2. Cek batas maksimal percobaan jika membuat sesi baru
    var completedCount = allSesi.filter(function(s) {
      return s.Status === 'SELESAI' || s.Status === 'KEDALUWARSA';
    }).length;

    var maxAttempts = tokenMeta.paket.maksPercobaan;
    if (maxAttempts > 0 && completedCount >= maxAttempts) {
      throw new Error('Anda sudah menggunakan kesempatan latihan ini (' + completedCount + ' dari maks ' + maxAttempts + ' kali).');
    }

    // 3. Buat sesi baru
    var newSesiId = generateId('SES');
    var durasiMenit = tokenMeta.paket.durasiMenit;
    var batasWaktuStr = '';

    if (durasiMenit > 0) {
      var deadlineDate = new Date(nowDate.getTime() + (durasiMenit * 60 * 1000));
      batasWaktuStr = getJakartaTimestamp(deadlineDate);
    }

    // Hitung total skor maksimal dari soal paket
    var paketSoalRows = getAllRows(SHEETS.PAKET_SOAL).filter(function(ps) {
      return ps.PaketID === paketId;
    });
    var bankSoalRows = getAllRows(SHEETS.BANK_SOAL);
    var bankMap = {};
    for (var b = 0; b < bankSoalRows.length; b++) {
      bankMap[bankSoalRows[b].SoalID] = bankSoalRows[b];
    }

    var totalSkorMaks = 0;
    for (var m = 0; m < paketSoalRows.length; m++) {
      var psItem = paketSoalRows[m];
      var sItem = bankMap[psItem.SoalID];
      var bobot = Number(psItem.BobotOverride) || (sItem ? Number(sItem.Bobot) : 1) || 1;
      totalSkorMaks += bobot;
    }

    var newSesi = {
      SesiID: newSesiId,
      PaketID: paketId,
      TokenID: tokenId,
      SiswaIDOpsional: siswaId,
      NamaSiswaSnapshot: namaSiswa,
      KelasIDSnapshot: kelasId,
      PercobaanKe: completedCount + 1,
      MulaiPada: nowJakarta,
      TerakhirAktif: nowJakarta,
      BatasWaktu: batasWaktuStr,
      DikirimPada: '',
      Status: 'SEDANG_MENGERJAKAN',
      NilaiAkhir: 0,
      SkorMaksimal: totalSkorMaks
    };

    appendRow(SHEETS.SESI_LATIHAN, newSesi);

    return buildSessionPayload(newSesi, tokenMeta.paket, false);
  });
}

/**
 * Menyusun data paket & soal yang AMAN untuk dikirim ke browser siswa
 * KUNCI JAWABAN DAN PEMBAHASAN TIDAK PERNAH DIKIRIM KE CLIENT!
 */
function buildSessionPayload(sesiObj, paketMeta, isResume) {
  var paketId = sesiObj.PaketID;
  var paketRow = getAllRows(SHEETS.PAKET_LATIHAN).find(function(p) { return p.PaketID === paketId; });

  var paketSoalRows = getAllRows(SHEETS.PAKET_SOAL).filter(function(ps) {
    return ps.PaketID === paketId;
  });

  paketSoalRows.sort(function(a, b) {
    return (Number(a.Urutan) || 0) - (Number(b.Urutan) || 0);
  });

  var bankSoalRows = getAllRows(SHEETS.BANK_SOAL);
  var bankMap = {};
  for (var i = 0; i < bankSoalRows.length; i++) {
    bankMap[bankSoalRows[i].SoalID] = bankSoalRows[i];
  }

  // Bangun daftar soal aman
  var safeQuestions = [];
  for (var j = 0; j < paketSoalRows.length; j++) {
    var ps = paketSoalRows[j];
    var s = bankMap[ps.SoalID];
    if (s && s.Status !== 'ARSIP') {
      var qObj = {
        soalId: s.SoalID,
        nomorUrut: j + 1,
        jenisSoal: s.JenisSoal,
        pertanyaan: s.Pertanyaan,
        gambarUrl: normalizeDriveImageUrl(s.GambarURL, s.GambarFileID),
        bobot: Number(ps.BobotOverride) || Number(s.Bobot) || 1
      };

      if (s.JenisSoal === 'PILIHAN_GANDA') {
        var options = [
          { key: 'A', text: s.PilihanA },
          { key: 'B', text: s.PilihanB },
          { key: 'C', text: s.PilihanC },
          { key: 'D', text: s.PilihanD }
        ].filter(function(opt) {
          return opt.text && opt.text.trim() !== '';
        });

        // Pengacakan pilihan jawaban jika diatur di paket
        if (paketRow && (paketRow.AcakPilihan === true || String(paketRow.AcakPilihan).toUpperCase() === 'TRUE')) {
          // Shuffle pilihan dengan Fisher-Yates
          for (var x = options.length - 1; x > 0; x--) {
            var y = Math.floor(Math.random() * (x + 1));
            var temp = options[x];
            options[x] = options[y];
            options[y] = temp;
          }
        }
        qObj.options = options;
      }

      safeQuestions.push(qObj);
    }
  }

  // Pengacakan urutan soal jika diaktifkan (hanya jika sesi baru)
  if (!isResume && paketRow && (paketRow.AcakSoal === true || String(paketRow.AcakSoal).toUpperCase() === 'TRUE')) {
    for (var a = safeQuestions.length - 1; a > 0; a--) {
      var b = Math.floor(Math.random() * (a + 1));
      var tq = safeQuestions[a];
      safeQuestions[a] = safeQuestions[b];
      safeQuestions[b] = tq;
    }
    // Re-index nomor urut tampilan
    for (var idx = 0; idx < safeQuestions.length; idx++) {
      safeQuestions[idx].nomorUrut = idx + 1;
    }
  }

  // Ambil jawaban tersimpan sebelumnya untuk sesi ini (jika resume)
  var savedAnswers = {};
  var jawabanRows = getAllRows(SHEETS.JAWABAN_SISWA).filter(function(jw) {
    return jw.SesiID === sesiObj.SesiID;
  });

  for (var k = 0; k < jawabanRows.length; k++) {
    savedAnswers[jawabanRows[k].SoalID] = {
      jawaban: jawabanRows[k].Jawaban,
      diperbaruiPada: jawabanRows[k].DiperbaruiPada
    };
  }

  // Hitung sisa detik
  var sisaDetik = null;
  if (sesiObj.BatasWaktu) {
    var deadlineDate = (sesiObj.BatasWaktu instanceof Date) ? sesiObj.BatasWaktu : new Date(sesiObj.BatasWaktu);
    if (!isNaN(deadlineDate.getTime())) {
      var nowMs = new Date().getTime();
      sisaDetik = Math.max(0, Math.floor((deadlineDate.getTime() - nowMs) / 1000));
    }
  }

  return {
    success: true,
    isResume: isResume,
    sesiId: sesiObj.SesiID,
    paket: {
      paketId: paketMeta.paketId,
      judul: paketMeta.judul,
      petunjuk: paketMeta.petunjuk,
      durasiMenit: paketMeta.durasiMenit
    },
    namaSiswa: sesiObj.NamaSiswaSnapshot,
    batasWaktu: sesiObj.BatasWaktu,
    sisaDetik: sisaDetik,
    questions: safeQuestions,
    savedAnswers: savedAnswers
  };
}

/**
 * Menyimpan jawaban siswa secara realtime (Autosave berkala & saat navigasi)
 * @param {string} sesiId ID Sesi Pengerjaan
 * @param {string} soalId ID Soal
 * @param {string} jawaban Jawaban yang dipilih/diisi siswa
 * @return {Object} Status simpan
 */
function saveStudentAnswer(sesiId, soalId, jawaban) {
  if (!sesiId || !soalId) throw new Error('Parameter sesi dan soal wajib ada.');

  var cleanSesiId = String(sesiId).trim();
  var cleanSoalId = String(soalId).trim();

  return withScriptLock(function() {
    var sesi = getAllRows(SHEETS.SESI_LATIHAN).find(function(s) { return String(s.SesiID).trim() === cleanSesiId; });
    if (!sesi) throw new Error('Sesi pengerjaan tidak ditemukan.');

    if (sesi.Status !== 'SEDANG_MENGERJAKAN') {
      return { expired: true, message: 'Latihan telah selesai atau waktu telah habis.' };
    }

    // Cek batas waktu
    var now = new Date();
    if (sesi.BatasWaktu) {
      var deadline = (sesi.BatasWaktu instanceof Date) ? sesi.BatasWaktu : new Date(sesi.BatasWaktu);
      if (!isNaN(deadline.getTime()) && now > deadline) {
        autoSubmitSessionOnTimeout(cleanSesiId);
        return { expired: true, message: 'Waktu pengerjaan telah habis. Jawaban telah otomatis dikumpulkan.' };
      }
    }

    var nowJakarta = getJakartaTimestamp();
    var cleanJawaban = String(jawaban !== null && jawaban !== undefined ? jawaban : '');
    var newJwId = generateId('ANS');

    // 1-Pass Find & Update/Append: Menggantikan 2 full table scans
    findAndUpdateOrAppendRow(
      SHEETS.JAWABAN_SISWA,
      function(row) {
        return String(row.SesiID).trim() === cleanSesiId && String(row.SoalID).trim() === cleanSoalId;
      },
      {
        Jawaban: cleanJawaban,
        DiperbaruiPada: nowJakarta
      },
      {
        JawabanID: newJwId,
        SesiID: cleanSesiId,
        SoalID: cleanSoalId,
        Jawaban: cleanJawaban,
        Skor: 0,
        Benar: false,
        DiperbaruiPada: nowJakarta
      }
    );

    try {
      updateRow(SHEETS.SESI_LATIHAN, 'SesiID', cleanSesiId, {
        TerakhirAktif: nowJakarta
      });
    } catch (eUpd) {
      Logger.log('Update TerakhirAktif warning: ' + eUpd.message);
    }

    return { success: true, savedAt: nowJakarta };
  });
}

/**
 * Normalisasi string jawaban untuk pencocokan toleran
 */
function normalizeAnswerString(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Menghitung nilai dan mengumpulkan jawaban ujian siswa
 * Dilakukan secara penuh di server-side untuk mencegah manipulasi client
 * @param {string} sesiId ID Sesi Pengerjaan
 * @return {Object} Ringkasan hasil pengerjaan
 */
function submitStudentQuiz(sesiId) {
  if (!sesiId) throw new Error('ID Sesi wajib diisi.');

  return withScriptLock(function() {
    var sesi = getAllRows(SHEETS.SESI_LATIHAN).find(function(s) { return s.SesiID === sesiId; });
    if (!sesi) throw new Error('Sesi pengerjaan tidak ditemukan.');

    // Jika sudah selesai sebelumnya, ambil hasil yang sudah ada (cegah duplikasi)
    if (sesi.Status === 'SELESAI') {
      return getStudentResultSummary(sesi);
    }

    var nowJakarta = getJakartaTimestamp();
    var paket = getAllRows(SHEETS.PAKET_LATIHAN).find(function(p) { return p.PaketID === sesi.PaketID; });
    var paketSoalRows = getAllRows(SHEETS.PAKET_SOAL).filter(function(ps) { return ps.PaketID === sesi.PaketID; });
    var bankSoalRows = getAllRows(SHEETS.BANK_SOAL);

    var bankMap = {};
    for (var b = 0; b < bankSoalRows.length; b++) {
      bankMap[bankSoalRows[b].SoalID] = bankSoalRows[b];
    }

    var jawabanRows = getAllRows(SHEETS.JAWABAN_SISWA).filter(function(j) { return j.SesiID === sesiId; });
    var jawabanMap = {};
    for (var j = 0; j < jawabanRows.length; j++) {
      jawabanMap[jawabanRows[j].SoalID] = jawabanRows[j];
    }

    var totalSkorDiperoleh = 0;
    var totalSkorMaksimal = 0;
    var totalBenar = 0;
    var totalSalah = 0;
    var totalKosong = 0;

    var jwUpdatesMap = {};
    var newBlankRows = [];

    for (var i = 0; i < paketSoalRows.length; i++) {
      var ps = paketSoalRows[i];
      var soal = bankMap[ps.SoalID];
      if (!soal) continue;

      var bobot = Number(ps.BobotOverride) || Number(soal.Bobot) || 1;
      totalSkorMaksimal += bobot;

      var jwObj = jawabanMap[soal.SoalID];
      var rawStudentAns = jwObj ? jwObj.Jawaban : '';
      var cleanStudentAns = String(rawStudentAns || '').trim();
      var rawKey = String(soal.KunciJawaban || '').trim();

      var isBenar = false;
      var skorSoal = 0;

      if (cleanStudentAns === '') {
        totalKosong++;
      } else {
        var jenis = soal.JenisSoal || 'PILIHAN_GANDA';

        if (jenis === 'PILIHAN_GANDA') {
          if (cleanStudentAns.toUpperCase() === rawKey.toUpperCase()) {
            isBenar = true;
          }
        } else if (jenis === 'BENAR_SALAH') {
          var normStudent = cleanStudentAns.toUpperCase();
          var normKey = rawKey.toUpperCase();
          var isStudentTrue = (normStudent === 'BENAR' || normStudent === 'B' || normStudent === 'TRUE');
          var isKeyTrue = (normKey === 'BENAR' || normKey === 'B' || normKey === 'TRUE');
          if (isStudentTrue === isKeyTrue) {
            isBenar = true;
          }
        } else if (jenis === 'ISIAN_SINGKAT') {
          var studentNorm = normalizeAnswerString(cleanStudentAns);
          var keys = rawKey.split(/[;,]/).map(function(k) { return normalizeAnswerString(k); });

          for (var kIdx = 0; kIdx < keys.length; kIdx++) {
            if (keys[kIdx] !== '' && studentNorm === keys[kIdx]) {
              isBenar = true;
              break;
            }
          }
        }

        if (isBenar) {
          skorSoal = bobot;
          totalSkorDiperoleh += bobot;
          totalBenar++;
        } else {
          totalSalah++;
        }
      }

      // Kumpulkan ke map untuk pembaruan batch (menghindari loop updateRow yang lambat)
      if (jwObj) {
        jwUpdatesMap[String(jwObj.JawabanID)] = {
          Skor: skorSoal,
          Benar: isBenar,
          DiperbaruiPada: nowJakarta
        };
      } else {
        newBlankRows.push({
          JawabanID: generateId('ANS'),
          SesiID: sesiId,
          SoalID: soal.SoalID,
          Jawaban: '',
          Skor: 0,
          Benar: false,
          DiperbaruiPada: nowJakarta
        });
      }
    }

    // 1 Batch Update & 1 Batch Append untuk seluruh lembar jawaban
    if (Object.keys(jwUpdatesMap).length > 0) {
      updateRowsBatch(SHEETS.JAWABAN_SISWA, 'JawabanID', jwUpdatesMap);
    }
    if (newBlankRows.length > 0) {
      appendRowsBatch(SHEETS.JAWABAN_SISWA, newBlankRows);
    }

    // Hitung Nilai Akhir (Skala 0 - 100)
    var nilaiAkhir = totalSkorMaksimal > 0
      ? Math.round((totalSkorDiperoleh / totalSkorMaksimal) * 100 * 100) / 100
      : 0;

    // Perbarui SESI_LATIHAN
    updateRow(SHEETS.SESI_LATIHAN, 'SesiID', sesiId, {
      DikirimPada: nowJakarta,
      Status: 'SELESAI',
      NilaiAkhir: nilaiAkhir,
      SkorMaksimal: totalSkorMaksimal,
      TerakhirAktif: nowJakarta
    });

    sesi.NilaiAkhir = nilaiAkhir;
    sesi.SkorMaksimal = totalSkorMaksimal;
    sesi.DikirimPada = nowJakarta;
    sesi.Status = 'SELESAI';

    return getStudentResultSummary(sesi, totalBenar, totalSalah, totalKosong, paketSoalRows.length);
  });
}

/**
 * Otomatis mengumpulkan sesi saat waktu habis (background auto-submit)
 */
function autoSubmitSessionOnTimeout(sesiId) {
  try {
    submitStudentQuiz(sesiId);
  } catch (e) {
    // Abaikan jika sudah dikumpulkan bersamaan
  }
}

/**
 * Menyusun ringkasan hasil yang diizinkan untuk dilihat siswa
 */
function getStudentResultSummary(sesi, totalBenar, totalSalah, totalKosong, totalSoal) {
  var paket = getAllRows(SHEETS.PAKET_LATIHAN).find(function(p) { return p.PaketID === sesi.PaketID; });
  var tampilkanNilai = paket ? (paket.TampilkanNilai !== false && String(paket.TampilkanNilai).toUpperCase() !== 'FALSE') : true;

  // Jika total belum dihitung (misal saat submit berulang / akses kembali), hitung dari JAWABAN_SISWA
  if (totalBenar === undefined || totalSoal === undefined) {
    var jwList = getAllRows(SHEETS.JAWABAN_SISWA).filter(function(j) { return j.SesiID === sesi.SesiID; });
    totalSoal = jwList.length;
    totalBenar = 0;
    totalSalah = 0;
    totalKosong = 0;

    for (var i = 0; i < jwList.length; i++) {
      var j = jwList[i];
      var isKosong = (!j.Jawaban || String(j.Jawaban).trim() === '');
      var isB = (j.Benar === true || String(j.Benar).toUpperCase() === 'TRUE');
      if (isKosong) totalKosong++;
      else if (isB) totalBenar++;
      else totalSalah++;
    }
  }

  var persentaseBenar = totalSoal > 0 ? Math.round((totalBenar / totalSoal) * 100) : 0;

  return {
    success: true,
    sesiId: sesi.SesiID,
    namaSiswa: sesi.NamaSiswaSnapshot,
    judulPaket: paket ? paket.Judul : 'Latihan Soal',
    mataPelajaran: paket ? paket.MataPelajaran : 'Umum',
    tingkat: paket ? ('Kelas ' + paket.Tingkat) : '',
    kelas: sesi.KelasIDSnapshot || (paket ? 'Kelas ' + paket.Tingkat : '-'),
    tanggalWaktu: sesi.DikirimPada || sesi.MulaiPada || getJakartaTimestamp(),
    tampilkanNilai: tampilkanNilai,
    nilaiAkhir: tampilkanNilai ? sesi.NilaiAkhir : null,
    totalBenar: totalBenar,
    totalSalah: totalSalah,
    totalKosong: totalKosong,
    totalSoal: totalSoal,
    persentaseBenar: persentaseBenar,
    canReview: true,
    tampilkanKunci: true,
    tampilkanPembahasan: true,
    message: 'Latihan berhasil dikumpulkan!'
  };
}

/**
 * Mengambil pembahasan / review jawaban siswa
 * Sesuai panduan arsitektur: Default selalu mengizinkan siswa melihat pembahasan setelah latihan selesai
 * @param {string} sesiId ID Sesi Pengerjaan
 * @return {Object} Detail review
 */
function getStudentReview(sesiId) {
  var sesi = getAllRows(SHEETS.SESI_LATIHAN).find(function(s) { return s.SesiID === sesiId; });
  if (!sesi || sesi.Status !== 'SELESAI') {
    throw new Error('Pembahasan hanya dapat dilihat setelah latihan selesai dikumpulkan.');
  }

  var paket = getAllRows(SHEETS.PAKET_LATIHAN).find(function(p) { return p.PaketID === sesi.PaketID; });
  if (!paket) throw new Error('Paket latihan tidak ditemukan.');

  var tampilkanKunci = true;
  var tampilkanPembahasan = true;

  var paketSoalRows = getAllRows(SHEETS.PAKET_SOAL).filter(function(ps) { return ps.PaketID === sesi.PaketID; });
  paketSoalRows.sort(function(a, b) { return (Number(a.Urutan) || 0) - (Number(b.Urutan) || 0); });

  var bankSoalRows = getAllRows(SHEETS.BANK_SOAL);
  var bankMap = {};
  for (var b = 0; b < bankSoalRows.length; b++) {
    bankMap[bankSoalRows[b].SoalID] = bankSoalRows[b];
  }

  var jawabanRows = getAllRows(SHEETS.JAWABAN_SISWA).filter(function(j) { return j.SesiID === sesiId; });
  var jwMap = {};
  for (var j = 0; j < jawabanRows.length; j++) {
    jwMap[jawabanRows[j].SoalID] = jawabanRows[j];
  }

  var reviewList = [];
  var totalBenar = 0;
  var totalSalah = 0;
  var totalKosong = 0;

  for (var i = 0; i < paketSoalRows.length; i++) {
    var ps = paketSoalRows[i];
    var so = bankMap[ps.SoalID];
    if (!so) continue;

    var jw = jwMap[so.SoalID];
    var studentAnswer = jw ? String(jw.Jawaban || '').trim() : '';
    var isKosong = (studentAnswer === '');
    var isBenar = jw ? (jw.Benar === true || String(jw.Benar).toUpperCase() === 'TRUE') : false;

    var statusJawaban = 'KOSONG';
    if (isKosong) {
      statusJawaban = 'KOSONG';
      totalKosong++;
    } else if (isBenar) {
      statusJawaban = 'BENAR';
      totalBenar++;
    } else {
      statusJawaban = 'SALAH';
      totalSalah++;
    }

    var pembahasanText = String(so.Pembahasan || '').trim();
    if (!pembahasanText) {
      pembahasanText = 'Pembahasan untuk soal ini belum tersedia.';
    }

    var item = {
      nomorUrut: i + 1,
      soalId: so.SoalID,
      pertanyaan: so.Pertanyaan,
      gambarUrl: normalizeDriveImageUrl(so.GambarURL, so.GambarFileID),
      jenisSoal: so.JenisSoal,
      jawabanSiswa: studentAnswer,
      statusJawaban: statusJawaban,
      benar: isBenar,
      pilihanA: so.PilihanA,
      pilihanB: so.PilihanB,
      pilihanC: so.PilihanC,
      pilihanD: so.PilihanD,
      bobot: Number(ps.BobotOverride) || Number(so.Bobot) || 1
    };

    if (tampilkanKunci) {
      item.kunciJawaban = so.KunciJawaban || '';
    }
    if (tampilkanPembahasan) {
      item.pembahasan = pembahasanText;
    }

    reviewList.push(item);
  }

  var persentaseBenar = reviewList.length > 0 ? Math.round((totalBenar / reviewList.length) * 100) : 0;

  return {
    success: true,
    sesiId: sesi.SesiID,
    judulPaket: paket.Judul,
    mataPelajaran: paket.MataPelajaran,
    tingkat: paket.Tingkat,
    kelas: sesi.KelasIDSnapshot || (paket ? 'Kelas ' + paket.Tingkat : '-'),
    namaSiswa: sesi.NamaSiswaSnapshot,
    nilaiAkhir: (paket.TampilkanNilai !== false && String(paket.TampilkanNilai).toUpperCase() !== 'FALSE') ? sesi.NilaiAkhir : null,
    totalSoal: reviewList.length,
    totalBenar: totalBenar,
    totalSalah: totalSalah,
    totalKosong: totalKosong,
    persentaseBenar: persentaseBenar,
    reviewList: reviewList
  };
}

/**
 * Helper pengujian yang aman dijalankan dari editor Google Apps Script (Run ▶)
 */
function testValidateStudentToken() {
  var tokens = getAllRows(SHEETS.TOKEN_AKSES);
  if (tokens.length === 0) {
    Logger.log('Belum ada token di sheet TOKEN_AKSES.');
    return;
  }
  var sampleCode = tokens[0].TokenKode;
  Logger.log('Menguji validasi token: ' + sampleCode);
  var result = validateStudentToken(sampleCode);
  Logger.log('Hasil: ' + JSON.stringify(result));
}
