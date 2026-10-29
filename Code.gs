/**
 * ============================================================================
 * Aplikasi Latihan Soal SD - Backend Google Apps Script API
 * File: Code.gs
 * Deskripsi: Entry point Web App, router API HTTP (doPost & doGet) untuk frontend
 *            GitHub Pages, serta health check dan helper include.
 * ============================================================================
 */

/**
 * Handler HTTP POST - Endpoint utama API untuk frontend GitHub Pages
 * Mendukung request CORS Simple Request (Content-Type: text/plain) tanpa preflight OPTIONS
 * @param {Object} e Event parameter dari Apps Script
 * @return {TextOutput} Respon JSON dengan ContentService
 */
function doPost(e) {
  var response = {};
  try {
    var requestData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        requestData = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        requestData = {};
      }
    } else if (e && e.parameter) {
      requestData = e.parameter;
    }

    var action = requestData.action || (e && e.parameter ? e.parameter.action : '');
    var sessionToken = requestData.sessionToken || '';
    var data = requestData.data || {};

    response = handleApiAction(action, sessionToken, data);
  } catch (err) {
    response = {
      success: false,
      message: err.message || 'Terjadi kesalahan pada server backend.'
    };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handler HTTP GET - Untuk health check, query ringan, atau status backend
 * @param {Object} e Event parameter
 * @return {TextOutput|HtmlOutput} Respon JSON API atau Fallback Web App
 */
function doGet(e) {
  // Jika dipanggil via query param API (?action=...)
  if (e && e.parameter && e.parameter.action) {
    var response = {};
    try {
      var action = e.parameter.action;
      var sessionToken = e.parameter.sessionToken || '';
      var data = {};
      if (e.parameter.data) {
        try {
          data = JSON.parse(e.parameter.data);
        } catch (err) {
          data = e.parameter;
        }
      } else {
        data = e.parameter;
      }
      response = handleApiAction(action, sessionToken, data);
    } catch (err) {
      response = { success: false, message: err.message };
    }
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Fallback status monitor jika dibuka langsung di browser
  var statusOutput = {
    status: 'online',
    app: 'Latihan Soal SD - Guru Pintar API Backend',
    version: '2.0-github-pages',
    timestamp: getJakartaTimestamp(),
    message: 'Backend Google Apps Script siap melayani request API dari GitHub Pages.'
  };

  return ContentService.createTextOutput(JSON.stringify(statusOutput))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Dispatcher router utama untuk memproses action API
 * @param {string} action Nama aksi yang diminta frontend
 * @param {string} sessionToken Token sesi guru (jika ada)
 * @param {Object} data Parameter payload aksi
 * @return {Object} Objek hasil respon
 */
function handleApiAction(action, sessionToken, data) {
  if (!action) {
    throw new Error('Parameter "action" wajib disertakan.');
  }

  data = data || {};

  switch (action) {
    // --- SISTEM & STATUS ---
    case 'ping':
      return { success: true, message: 'Pong! Backend aktif.', timestamp: getJakartaTimestamp() };

    case 'setupLMS':
      return setupLMS();

    case 'hasRegisteredTeacher':
      return { success: true, hasTeacher: hasRegisteredTeacher() };

    // --- AUTENTIKASI GURU ---
    case 'createFirstTeacher':
      return createFirstTeacher(data.username, data.password, data.namaGuru);

    case 'loginTeacher':
      return loginTeacher(data.username, data.password);

    case 'validateSession':
      var session = validateSession(sessionToken);
      return { success: true, profile: session };

    case 'logoutTeacher':
      return logoutTeacher(sessionToken);

    case 'changeTeacherPassword':
      return changeTeacherPassword(sessionToken, data.oldPassword, data.newPassword);

    // --- DASHBOARD GURU ---
    case 'getTeacherDashboard':
      return getTeacherDashboard(sessionToken);

    // --- KELAS & SISWA ---
    case 'getTeacherKelas':
      return getTeacherKelas(sessionToken);

    case 'saveKelas':
      return saveKelas(sessionToken, data.kelasData || data);

    case 'archiveKelas':
      return archiveKelas(sessionToken, data.kelasId);

    case 'getTeacherSiswa':
      return getTeacherSiswa(sessionToken, data.kelasId);

    case 'saveSiswa':
      return saveSiswa(sessionToken, data.siswaData || data);

    case 'deleteSiswa':
      return deleteSiswa(sessionToken, data.siswaId);

    // --- BANK SOAL & MEDIA ---
    case 'getBankSoal':
      return getBankSoal(sessionToken, data.filters || data);

    case 'saveSoal':
      return saveSoal(sessionToken, data.soalData || data);

    case 'duplicateSoal':
      return duplicateSoal(sessionToken, data.soalId);

    case 'deleteSoal':
    case 'archiveSoal':
      return deleteSoal(sessionToken, data.soalId);

    case 'fixImagePermissions':
      return fixImagePermissions(sessionToken);

    // --- PAKET LATIHAN ---
    case 'getPaketLatihan':
      return getPaketLatihan(sessionToken);

    case 'getPaketDetail':
      return getPaketDetail(sessionToken, data.paketId);

    case 'savePaketLatihan':
      return savePaketLatihan(sessionToken, data.paketData || data, data.selectedSoal || []);

    case 'updatePaketStatus':
      return updatePaketStatus(sessionToken, data.paketId, data.status);

    case 'deletePaketLatihan':
      return deletePaketLatihan(sessionToken, data.paketId);

    // --- TOKEN SISWA ---
    case 'getPaketTokens':
      return getPaketTokens(sessionToken, data.paketId);

    case 'createPaketToken':
      return createPaketToken(sessionToken, data.tokenData || data);

    case 'toggleTokenStatus':
      return toggleTokenStatus(sessionToken, data.tokenId, data.aktif);

    // --- HASIL & REKAP ---
    case 'getHasilList':
      return getHasilList(sessionToken, data.filters || data);

    case 'getHasilDetail':
      return getHasilDetail(sessionToken, data.sesiId);

    case 'updateJawabanManual':
      return updateJawabanManual(sessionToken, data.jawabanId, data.skorBaru, data.benarBaru);

    case 'exportHasilCsv':
      return exportHasilCsv(sessionToken, data.paketId, data.kelasId);

    // --- SISWA (PENGERJAAN KUIS) ---
    case 'validateStudentToken':
      return validateStudentToken(data.tokenString || data.token);

    case 'startOrResumeSession':
      return startOrResumeSession(data.tokenString || data.token, data.studentData || data);

    case 'saveStudentAnswer':
      return saveStudentAnswer(data.sesiId, data.soalId, data.jawaban);

    case 'submitStudentQuiz':
      return submitStudentQuiz(data.sesiId);

    case 'getStudentReview':
      return getStudentReview(data.sesiId);

    // --- TEMPLATE & IMPOR CSV ---
    case 'getTemplateSoalCsv':
      return { success: true, csvContent: getTemplateSoalCsv() };

    case 'getTemplateSiswaCsv':
      return { success: true, csvContent: getTemplateSiswaCsv() };

    case 'previewImportSoal':
      return previewImportSoal(sessionToken, data.csvContent);

    case 'commitImportSoal':
      return commitImportSoal(sessionToken, data.validRows);

    case 'previewImportSiswa':
      return previewImportSiswa(sessionToken, data.kelasId, data.csvContent);

    case 'commitImportSiswa':
      return commitImportSiswa(sessionToken, data.kelasId, data.validRows);

    default:
      throw new Error('Aksi "' + action + '" tidak dikenali di sistem backend.');
  }
}

/**
 * Helper include file HTML (jika backend dijalankan langsung sebagai container-bound template)
 * @param {string} filename Nama file
 * @return {string} Konten file
 */
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (e) {
    return '';
  }
}

/**
 * Health check bawaan
 */
function ping() {
  return {
    success: true,
    message: 'LMS SD Backend siap digunakan',
    timestamp: new Date().toISOString()
  };
}
