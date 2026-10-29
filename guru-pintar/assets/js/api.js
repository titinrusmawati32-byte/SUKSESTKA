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
    createFirstTeacher: (username, password, namaGuru) => call('createFirstTeacher', { username, password, namaGuru }),
    loginTeacher: (username, password) => call('loginTeacher', { username, password }),
    validateSession: (token) => call('validateSession', {}, token),
    logoutTeacher: (token) => call('logoutTeacher', {}, token),
    changeTeacherPassword: (oldPassword, newPassword) => call('changeTeacherPassword', { oldPassword, newPassword }),

    // Dashboard
    getTeacherDashboard: () => call('getTeacherDashboard'),

    // Kelas & Siswa
    getTeacherKelas: () => call('getTeacherKelas'),
    saveKelas: (kelasData) => call('saveKelas', { kelasData }),
    archiveKelas: (kelasId) => call('archiveKelas', { kelasId }),
    getTeacherSiswa: (kelasId) => call('getTeacherSiswa', { kelasId }),
    saveSiswa: (siswaData) => call('saveSiswa', { siswaData }),
    deleteSiswa: (siswaId) => call('deleteSiswa', { siswaId }),

    // Bank Soal
    getBankSoal: (filters) => call('getBankSoal', { filters }),
    saveSoal: (soalData) => call('saveSoal', { soalData }),
    duplicateSoal: (soalId) => call('duplicateSoal', { soalId }),
    archiveSoal: (soalId) => call('archiveSoal', { soalId }),

    // Paket Latihan
    getPaketLatihan: () => call('getPaketLatihan'),
    getPaketDetail: (paketId) => call('getPaketDetail', { paketId }),
    savePaketLatihan: (paketData, selectedSoal) => call('savePaketLatihan', { paketData, selectedSoal }),
    updatePaketStatus: (paketId, status) => call('updatePaketStatus', { paketId, status }),

    // Token Siswa
    getPaketTokens: (paketId) => call('getPaketTokens', { paketId }),
    createPaketToken: (tokenData) => call('createPaketToken', { tokenData }),
    toggleTokenStatus: (tokenId, aktif) => call('toggleTokenStatus', { tokenId, aktif }),

    // Hasil & Rekap
    getHasilList: (filters) => call('getHasilList', { filters }),
    getHasilDetail: (sesiId) => call('getHasilDetail', { sesiId }),
    updateJawabanManual: (jawabanId, skorBaru, benarBaru) => call('updateJawabanManual', { jawabanId, skorBaru, benarBaru }),
    exportHasilCsv: (paketId, kelasId) => call('exportHasilCsv', { paketId, kelasId }),

    // Siswa Pengerjaan
    validateStudentToken: (tokenString) => call('validateStudentToken', { tokenString }),
    startOrResumeSession: (tokenString, studentData) => call('startOrResumeSession', { tokenString, studentData }),
    saveStudentAnswer: (sesiId, soalId, jawaban) => call('saveStudentAnswer', { sesiId, soalId, jawaban }),
    submitStudentQuiz: (sesiId) => call('submitStudentQuiz', { sesiId }),
    getStudentReview: (sesiId) => call('getStudentReview', { sesiId }),

    // Template & Impor CSV
    getTemplateSoalCsv: () => call('getTemplateSoalCsv'),
    getTemplateSiswaCsv: () => call('getTemplateSiswaCsv'),
    previewImportSoal: (csvContent) => call('previewImportSoal', { csvContent }),
    commitImportSoal: (validRows) => call('commitImportSoal', { validRows }),
    previewImportSiswa: (kelasId, csvContent) => call('previewImportSiswa', { kelasId, csvContent }),
    commitImportSiswa: (kelasId, validRows) => call('commitImportSiswa', { kelasId, validRows })
  };
})();
