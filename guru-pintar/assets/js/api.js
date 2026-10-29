/**
 * ============================================================================
 * Aplikasi Latihan Soal SD - Modul Komunikasi API (api.js)
 * File: assets/js/api.js
 * Deskripsi: Client API untuk berkomunikasi secara aman dengan backend
 *            Google Apps Script Web App dari GitHub Pages via CORS Simple Request.
 * ============================================================================
 */

const api = (function() {
  'use strict';

  // Konfigurasi URL Deployment Web App Google Apps Script
  const CONFIG = {
    DEFAULT_URL: 'https://script.google.com/macros/s/AKfycbwu1pQN_wK3T8luVO7W6_jyA0X6jxUi4WwitSSMFQ1sMo1paZITI0khI6mkMidpQORb/exec',
    STORAGE_KEY: 'lms_gas_api_url',
    
    getUrl: function() {
      // Prioritas 1: Jika di Vercel, gunakan proxy internal Vercel untuk mengatasi CORS browser
      if (typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app')) {
        return '/api/proxy';
      }
      // Prioritas 2: Ambil dari file config.js (APP_CONFIG.API_URL)
      if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.API_URL && APP_CONFIG.API_URL.trim() !== '') {
        return APP_CONFIG.API_URL.trim();
      }
      return this.DEFAULT_URL;
    },

    setUrl: function(url) {
      if (url && url.trim() !== '') {
        localStorage.setItem(this.STORAGE_KEY, url.trim());
      } else {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    }
  };

  let activeRequestsCount = 0;

  function showLoadingIndicator() {
    activeRequestsCount++;
    const loader = document.getElementById('global-loader');
    if (loader) loader.classList.remove('hidden');
  }

  function hideLoadingIndicator() {
    activeRequestsCount = Math.max(0, activeRequestsCount - 1);
    if (activeRequestsCount === 0) {
      const loader = document.getElementById('global-loader');
      if (loader) loader.classList.add('hidden');
    }
  }

  /**
   * Eksekusi pemanggilan API ke Google Apps Script Web App
   * @param {string} action Nama aksi backend
   * @param {Object} data Parameter payload
   * @param {string} customSessionToken Token sesi opsional
   * @return {Promise<Object>} Respon data JSON
   */
  async function call(action, data = {}, customSessionToken = null) {
    const apiUrl = CONFIG.getUrl();

    if (!apiUrl) {
      throw new Error('URL Backend Google Apps Script belum dikonfigurasi di assets/js/config.js. Silakan isi API_URL pada file config.js.');
    }

    // Ambil session token otomatis dari modul auth jika tidak diberikan
    let sessionToken = customSessionToken;
    if (!sessionToken && typeof auth !== 'undefined' && auth.getSessionToken) {
      sessionToken = auth.getSessionToken();
    }

    const payload = {
      action: action,
      sessionToken: sessionToken || '',
      data: data
    };

    showLoadingIndicator();

    try {
      /**
       * PENTING: Gunakan method POST dengan Content-Type 'text/plain;charset=utf-8'.
       * Standar CORS mengkategorikan ini sebagai "Simple Request" sehingga browser
       * TIDAK mengirimkan request preflight OPTIONS (yang tidak didukung oleh GAS).
       * GAS akan menerima body di e.postData.contents, memprosesnya, dan me-redirect (HTTP 302)
       * ke script.googleusercontent.com yang menyertakan header Access-Control-Allow-Origin: *.
       */
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const resJson = await response.json();

      if (resJson && resJson.success === false) {
        // Cek jika error terkait sesi kedaluwarsa
        if (resJson.message && (resJson.message.includes('Sesi telah kedaluwarsa') || resJson.message.includes('Akses ditolak'))) {
          if (typeof auth !== 'undefined' && auth.handleSessionExpired) {
            auth.handleSessionExpired();
          }
        }
        throw new Error(resJson.message || 'Operasi gagal.');
      }

      return resJson;
    } catch (err) {
      console.error(`[API Error: ${action}]`, err);

      let userMsg = err.message || 'Terjadi kesalahan komunikasi dengan server.';
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        userMsg = 'Gagal terhubung ke backend Google Apps Script. Pastikan URL Web App benar dan deployment diset "Who has access: Anyone".';
      }

      throw new Error(userMsg);
    } finally {
      hideLoadingIndicator();
    }
  }

  /**
   * Helper pemanggilan API dengan caching terintegrasi
   */
  function cachedCall(cacheKey, ttl, tags, action, data = {}, customSessionToken = null, forceRefresh = false) {
    if (typeof cacheService !== 'undefined') {
      return cacheService.wrap(cacheKey, ttl, tags, () => call(action, data, customSessionToken), forceRefresh);
    }
    return call(action, data, customSessionToken);
  }

  /**
   * Invalidate tags setelah mutasi data berhasil
   */
  function invalidateTags(tags) {
    if (typeof cacheService !== 'undefined') {
      (Array.isArray(tags) ? tags : [tags]).forEach(t => cacheService.invalidateTag(t));
    }
  }

  /**
   * Autosave jawaban siswa dengan mekanisme retry tangguh
   */
  async function saveStudentAnswerWithRetry(sesiId, soalId, jawaban, maxRetries = 2) {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        return await call('saveStudentAnswer', { sesiId, soalId, jawaban });
      } catch (err) {
        attempt++;
        if (attempt > maxRetries) throw err;
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  return {
    // Konfigurasi URL
    getUrl: () => CONFIG.getUrl(),
    setUrl: (url) => CONFIG.setUrl(url),
    call: call,

    // Helper Fungsi Spesifik
    ping: () => call('ping'),
    setupLMS: () => call('setupLMS'),
    hasRegisteredTeacher: () => call('hasRegisteredTeacher'),

    // Autentikasi Guru
    createFirstTeacher: (username, password, namaGuru) => {
      invalidateTags(['dashboard']);
      return call('createFirstTeacher', { username, password, namaGuru });
    },
    loginTeacher: (username, password) => call('loginTeacher', { username, password }),
    validateSession: (token) => call('validateSession', {}, token),
    logoutTeacher: (token) => {
      if (typeof cacheService !== 'undefined') cacheService.clearAll();
      return call('logoutTeacher', {}, token);
    },
    changeTeacherPassword: (oldPassword, newPassword) => call('changeTeacherPassword', { oldPassword, newPassword }),

    // Dashboard Guru (dengan cache singkat & tag invalidasi)
    getTeacherDashboard: (force = false) =>
      cachedCall('teacher_dashboard', cacheService ? cacheService.TTL.DASHBOARD : 60, ['dashboard'], 'getTeacherDashboard', {}, null, force),

    // Kelas & Siswa
    getTeacherKelas: (force = false) =>
      cachedCall('teacher_kelas', cacheService ? cacheService.TTL.KELAS_LIST : 300, ['kelas'], 'getTeacherKelas', {}, null, force),
    saveKelas: async (kelasData) => {
      const res = await call('saveKelas', { kelasData });
      invalidateTags(['kelas', 'dashboard']);
      return res;
    },
    archiveKelas: async (kelasId) => {
      const res = await call('archiveKelas', { kelasId });
      invalidateTags(['kelas', 'dashboard']);
      return res;
    },
    getTeacherSiswa: (kelasId, force = false) =>
      cachedCall('teacher_siswa_' + kelasId, cacheService ? cacheService.TTL.SISWA_LIST : 300, ['siswa', 'kelas'], 'getTeacherSiswa', { kelasId }, null, force),
    saveSiswa: async (siswaData) => {
      const res = await call('saveSiswa', { siswaData });
      invalidateTags(['siswa', 'kelas', 'dashboard']);
      return res;
    },
    deleteSiswa: async (siswaId) => {
      const res = await call('deleteSiswa', { siswaId });
      invalidateTags(['siswa', 'kelas', 'dashboard']);
      return res;
    },

    // Bank Soal
    getBankSoal: (filters, force = false) =>
      cachedCall('bank_soal_' + JSON.stringify(filters || {}), cacheService ? cacheService.TTL.BANK_SOAL : 180, ['soal'], 'getBankSoal', { filters }, null, force),
    saveSoal: async (soalData) => {
      const res = await call('saveSoal', { soalData });
      invalidateTags(['soal', 'dashboard']);
      return res;
    },
    duplicateSoal: async (soalId) => {
      const res = await call('duplicateSoal', { soalId });
      invalidateTags(['soal', 'dashboard']);
      return res;
    },
    deleteSoal: async (soalId) => {
      if (typeof cacheService !== 'undefined') cacheService.clearTag('soal');
      const res = await call('deleteSoal', { soalId });
      invalidateTags(['soal', 'dashboard', 'paket']);
      return res;
    },
    archiveSoal: async (soalId) => {
      if (typeof cacheService !== 'undefined') cacheService.clearTag('soal');
      const res = await call('deleteSoal', { soalId });
      invalidateTags(['soal', 'dashboard', 'paket']);
      return res;
    },
    fixImagePermissions: () => {
      invalidateTags(['soal']);
      return call('fixImagePermissions');
    },

    // Paket Latihan
    getPaketLatihan: (force = false) =>
      cachedCall('paket_latihan', cacheService ? cacheService.TTL.PAKET_LIST : 120, ['paket'], 'getPaketLatihan', {}, null, force),
    getPaketDetail: (paketId, force = false) =>
      cachedCall('paket_detail_' + paketId, cacheService ? cacheService.TTL.PAKET_DETAIL : 300, ['paket'], 'getPaketDetail', { paketId }, null, force),
    savePaketLatihan: async (paketData, selectedSoal) => {
      const res = await call('savePaketLatihan', { paketData, selectedSoal });
      invalidateTags(['paket', 'dashboard']);
      return res;
    },
    updatePaketStatus: async (paketId, status) => {
      const res = await call('updatePaketStatus', { paketId, status });
      invalidateTags(['paket', 'dashboard']);
      return res;
    },
    deletePaketLatihan: async (paketId) => {
      if (typeof cacheService !== 'undefined') cacheService.clearTag('paket');
      const res = await call('deletePaketLatihan', { paketId });
      invalidateTags(['paket', 'dashboard', 'token']);
      return res;
    },

    // Token Siswa
    getPaketTokens: (paketId, force = false) =>
      cachedCall('paket_tokens_' + paketId, cacheService ? cacheService.TTL.TOKEN_LIST : 60, ['token', 'paket'], 'getPaketTokens', { paketId }, null, force),
    createPaketToken: async (tokenData) => {
      const res = await call('createPaketToken', { tokenData });
      invalidateTags(['token', 'dashboard']);
      return res;
    },
    toggleTokenStatus: async (tokenId, aktif) => {
      const res = await call('toggleTokenStatus', { tokenId, aktif });
      invalidateTags(['token', 'dashboard']);
      return res;
    },

    // Hasil & Rekap
    getHasilList: (filters, force = false) =>
      cachedCall('hasil_list_' + JSON.stringify(filters || {}), cacheService ? cacheService.TTL.HASIL_LIST : 60, ['hasil'], 'getHasilList', { filters }, null, force),
    getHasilDetail: (sesiId) => call('getHasilDetail', { sesiId }),
    updateJawabanManual: async (jawabanId, skorBaru, benarBaru) => {
      const res = await call('updateJawabanManual', { jawabanId, skorBaru, benarBaru });
      invalidateTags(['hasil', 'dashboard']);
      return res;
    },
    exportHasilCsv: (paketId, kelasId) => call('exportHasilCsv', { paketId, kelasId }),

    // Siswa Pengerjaan (Validasi dan Penilaian Selalu Otoritatif ke Backend)
    validateStudentToken: (tokenString) => call('validateStudentToken', { tokenString }),
    startOrResumeSession: (tokenString, studentData) => call('startOrResumeSession', { tokenString, studentData }),
    saveStudentAnswer: (sesiId, soalId, jawaban) => saveStudentAnswerWithRetry(sesiId, soalId, jawaban),
    submitStudentQuiz: (sesiId) => {
      invalidateTags(['dashboard', 'hasil']);
      return call('submitStudentQuiz', { sesiId });
    },
    getStudentReview: (sesiId) =>
      cachedCall('student_review_' + sesiId, 600, ['review'], 'getStudentReview', { sesiId }),

    // Template & Impor CSV
    getTemplateSoalCsv: () => call('getTemplateSoalCsv'),
    getTemplateSiswaCsv: () => call('getTemplateSiswaCsv'),
    previewImportSoal: (csvContent) => call('previewImportSoal', { csvContent }),
    commitImportSoal: async (validRows) => {
      const res = await call('commitImportSoal', { validRows });
      invalidateTags(['soal', 'dashboard']);
      return res;
    },
    previewImportSiswa: (kelasId, csvContent) => call('previewImportSiswa', { kelasId, csvContent }),
    commitImportSiswa: async (kelasId, validRows) => {
      const res = await call('commitImportSiswa', { kelasId, validRows });
      invalidateTags(['siswa', 'kelas', 'dashboard']);
      return res;
    }
  };
})();
