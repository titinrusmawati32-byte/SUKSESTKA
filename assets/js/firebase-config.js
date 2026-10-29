/**
 * ============================================================================
 * Aplikasi Latihan Soal SD - Konfigurasi Firebase (firebase-config.js)
 * File: assets/js/firebase-config.js
 * Deskripsi: Modul konfigurasi Firebase Web SDK terpusat.
 *            Mendukung penyimpanan konfigurasi lokal dan fallback anggun
 *            jika Firebase belum diaktifkan atau belum dikonfigurasi.
 * ============================================================================
 */

const firebaseConfig = (function() {
  'use strict';

  const STORAGE_KEY = 'lms_firebase_custom_config';

  /**
   * Konfigurasi Firebase bawaan.
   * Ganti nilai di bawah ini dengan kredensial dari Firebase Console Anda:
   * (Project Settings > General > Your apps > Web app > SDK setup and configuration)
   */
  const DEFAULT_CONFIG = {
    apiKey: "AIzaSyBAuNyg-Jk-OxeFX8xAeZNbEr_aseDG9x4",
    authDomain: "suksestka-48660.firebaseapp.com",
    projectId: "suksestka-48660",
    storageBucket: "suksestka-48660.firebasestorage.app",
    messagingSenderId: "559556485334",
    appId: "1:559556485334:web:e88dc804f47fb6192f2977"
  };

  /**
   * Mengambil konfigurasi aktif (prioritas: custom localStorage > default file)
   */
  function getConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.apiKey && parsed.projectId) {
          return parsed;
        }
      }
    } catch (e) {
      // Abaikan jika parsing gagal
    }
    return DEFAULT_CONFIG;
  }

  /**
   * Menyimpan konfigurasi khusus dari menu pengaturan UI
   */
  function saveCustomConfig(configObj) {
    if (!configObj || !configObj.apiKey || !configObj.projectId) {
      throw new Error('Konfigurasi Firebase harus memiliki apiKey dan projectId.');
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configObj));
  }

  /**
   * Menghapus konfigurasi khusus
   */
  function clearCustomConfig() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Memeriksa apakah Firebase telah dikonfigurasi secara valid
   * (tidak kosong dan bukan placeholder)
   */
  function isConfigured() {
    const cfg = getConfig();
    return Boolean(
      cfg.apiKey &&
      cfg.apiKey.trim() !== '' &&
      !cfg.apiKey.includes('PASTE_') &&
      cfg.projectId &&
      cfg.projectId.trim() !== '' &&
      !cfg.projectId.includes('your-project')
    );
  }

  return {
    getConfig,
    saveCustomConfig,
    clearCustomConfig,
    isConfigured
  };
})();
