/**
 * ============================================================================
 * Aplikasi Latihan Soal SD - Layanan Firebase (firebase-service.js)
 * File: assets/js/firebase-service.js
 * Deskripsi: Layanan pendukung Firebase Firestore untuk cache data referensi,
 *            sinkronisasi metadata ringan, dan fallback anggun tanpa mengganggu
 *            Google Apps Script sebagai backend & SSOT utama.
 * ============================================================================
 */

const firebaseService = (function() {
  'use strict';

  let db = null;
  let isInitialized = false;
  let initError = null;

  /**
   * Inisialisasi Firebase secara aman jika konfigurasi dan SDK tersedia
   */
  function init() {
    if (isInitialized) return true;

    // 1. Cek apakah Firebase SDK termuat di browser
    if (typeof firebase === 'undefined') {
      initError = 'Firebase SDK belum dimuat.';
      return false;
    }

    // 2. Cek apakah konfigurasi valid sudah diisi pengguna
    if (typeof firebaseConfig === 'undefined' || !firebaseConfig.isConfigured()) {
      initError = 'Konfigurasi Firebase belum diisi atau masih berupa placeholder.';
      return false;
    }

    try {
      const config = firebaseConfig.getConfig();
      // Gunakan nama app khusus untuk mencegah inisialisasi ganda
      const appName = 'guru-pintar-app';
      const app = firebase.apps.find(a => a.name === appName) || firebase.initializeApp(config, appName);
      
      db = firebase.firestore(app);
      
      // Aktifkan offline persistence jika didukung browser
      try {
        db.enablePersistence({ synchronizeTabs: true }).catch(() => {
          // Abaikan jika persistence tidak dapat diaktifkan di tab lain
        });
      } catch (e) {}

      isInitialized = true;
      initError = null;
      console.info('[FirebaseService] Firestore berhasil diinisialisasi sebagai cache layer.');
      return true;
    } catch (err) {
      initError = err.message || 'Gagal menginisialisasi Firebase.';
      console.warn('[FirebaseService] Inisialisasi Firebase gagal, fallback ke Google Apps Script:', initError);
      return false;
    }
  }

  /**
   * Status ketersediaan layanan Firebase
   */
  function getStatus() {
    return {
      ready: isInitialized && db !== null,
      configured: typeof firebaseConfig !== 'undefined' && firebaseConfig.isConfigured(),
      error: initError
    };
  }

  /**
   * Mengambil data cache dari koleksi Firestore
   * @param {string} collectionName Nama koleksi (contoh: 'public_cache')
   * @param {string} docId ID dokumen
   * @return {Promise<Object|null>} Data atau null jika tidak ada / kedaluwarsa
   */
  async function getCachedDoc(collectionName, docId) {
    if (!init()) return null;

    try {
      const docRef = db.collection(collectionName).doc(docId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) return null;

      const data = docSnap.data();
      // Periksa masa berlaku jika ada expireAt
      if (data && data.expireAt && data.expireAt < Date.now()) {
        return null;
      }

      return data.payload || null;
    } catch (err) {
      console.warn(`[FirebaseService] Gagal membaca cache Firestore (${collectionName}/${docId}):`, err.message);
      return null;
    }
  }

  /**
   * Menyimpan data cache ke Firestore
   * @param {string} collectionName Nama koleksi
   * @param {string} docId ID dokumen
   * @param {Object} payload Data yang disimpan
   * @param {number} ttlSeconds Masa berlaku (detik)
   */
  async function setCachedDoc(collectionName, docId, payload, ttlSeconds = 300) {
    if (!init()) return false;

    try {
      const docRef = db.collection(collectionName).doc(docId);
      await docRef.set({
        payload: payload,
        updatedAt: Date.now(),
        expireAt: Date.now() + (ttlSeconds * 1000),
        source: 'google-sheets-mirror'
      }, { merge: true });
      return true;
    } catch (err) {
      console.warn(`[FirebaseService] Gagal menulis cache Firestore (${collectionName}/${docId}):`, err.message);
      return false;
    }
  }

  /**
   * Menghapus cache dokumen tertentu di Firestore
   */
  async function invalidateDoc(collectionName, docId) {
    if (!init()) return false;

    try {
      await db.collection(collectionName).doc(docId).delete();
      return true;
    } catch (err) {
      return false;
    }
  }

  return {
    init,
    getStatus,
    getCachedDoc,
    setCachedDoc,
    invalidateDoc
  };
})();
