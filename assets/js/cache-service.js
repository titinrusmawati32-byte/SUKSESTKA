/**
 * ============================================================================
 * Aplikasi Latihan Soal SD - Modul Cache Terpusat (cache-service.js)
 * File: assets/js/cache-service.js
 * Deskripsi: Sistem multi-tier cache (In-Memory + Web Storage + Tag Invalidation)
 *            untuk mengurangi request berulang ke Google Apps Script,
 *            mempercepat navigasi menu, dan mencegah data usang.
 * ============================================================================
 */

const cacheService = (function() {
  'use strict';

  // In-Memory Cache (Level 1 - Tercepat: 0ms)
  const memoryCache = new Map();

  // In-Flight Request Deduplication Map
  const inFlightRequests = new Map();

  // Prefix penyimpanan browser
  const STORAGE_PREFIX = 'gp_cache_v2_';

  // TTL Default berdasarkan Jenis Data (dalam detik)
  const TTL = {
    DASHBOARD: 60,         // 1 menit (ringkasan statistik)
    KELAS_LIST: 300,       // 5 menit
    SISWA_LIST: 300,       // 5 menit
    BANK_SOAL: 180,        // 3 menit
    PAKET_LIST: 120,       // 2 menit
    PAKET_DETAIL: 300,     // 5 menit
    TOKEN_LIST: 60,        // 1 menit
    HASIL_LIST: 60,        // 1 menit
    SHORT: 30,             // 30 detik
    LONG: 900              // 15 menit
  };

  /**
   * Menyimpan data ke dalam cache (Memory + Web Storage)
   * @param {string} key Kunci cache unik
   * @param {*} data Data yang disimpan
   * @param {number} ttlSeconds Masa berlaku dalam detik
   * @param {Array<string>} tags Label untuk invalidasi terarah
   */
  function set(key, data, ttlSeconds = TTL.SHORT, tags = []) {
    if (!key || data === undefined || data === null) return;

    const expireAt = Date.now() + (ttlSeconds * 1000);
    const item = {
      data: data,
      expireAt: expireAt,
      tags: Array.isArray(tags) ? tags : [tags],
      savedAt: Date.now()
    };

    // 1. Simpan ke Level 1: Memory
    memoryCache.set(key, item);

    // 2. Simpan ke Level 2: Web Storage (jika data serializable)
    try {
      const storageKey = STORAGE_PREFIX + key;
      sessionStorage.setItem(storageKey, JSON.stringify(item));
    } catch (e) {
      // Abaikan jika quota storage penuh atau di private mode
    }
  }

  /**
   * Mengambil data dari cache jika belum kedaluwarsa
   * @param {string} key Kunci cache
   * @return {*} Data atau null jika tidak ada / sudah kedaluwarsa
   */
  function get(key) {
    if (!key) return null;
    const now = Date.now();

    // 1. Cek Memory Cache
    if (memoryCache.has(key)) {
      const item = memoryCache.get(key);
      if (item.expireAt > now) {
        return item.data;
      }
      memoryCache.delete(key);
    }

    // 2. Cek Web Storage
    try {
      const storageKey = STORAGE_PREFIX + key;
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const item = JSON.parse(raw);
        if (item && item.expireAt > now) {
          // Sinkronkan kembali ke memory cache
          memoryCache.set(key, item);
          return item.data;
        }
        sessionStorage.removeItem(storageKey);
      }
    } catch (e) {
      // Abaikan error parsing
    }

    return null;
  }

  /**
   * Memeriksa apakah data tertentu tersedia dan valid di cache
   */
  function has(key) {
    return get(key) !== null;
  }

  /**
   * Menghapus cache berdasarkan key spesifik
   */
  function remove(key) {
    if (!key) return;
    memoryCache.delete(key);
    try {
      sessionStorage.removeItem(STORAGE_PREFIX + key);
    } catch (e) {}
  }

  /**
   * Menginvalidasi seluruh item cache yang memiliki tag tertentu
   * Contoh: invalidateTag('kelas') akan menghapus daftar kelas dan statistik terkait
   * @param {string} tag Nama tag invalidasi
   */
  function invalidateTag(tag) {
    if (!tag) return;
    const targetTag = String(tag).toLowerCase();

    // 1. Hapus dari Memory
    for (const [key, item] of memoryCache.entries()) {
      if (item.tags && item.tags.some(t => String(t).toLowerCase() === targetTag)) {
        memoryCache.delete(key);
      }
    }

    // 2. Hapus dari Web Storage
    try {
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const sKey = sessionStorage.key(i);
        if (sKey && sKey.startsWith(STORAGE_PREFIX)) {
          try {
            const item = JSON.parse(sessionStorage.getItem(sKey));
            if (item && item.tags && item.tags.some(t => String(t).toLowerCase() === targetTag)) {
              keysToRemove.push(sKey);
            }
          } catch (err) {}
        }
      }
      keysToRemove.forEach(k => sessionStorage.removeItem(k));
    } catch (e) {}

    console.info(`[CacheService] Cache dengan tag "${targetTag}" berhasil diinvalidasi.`);
  }

  /**
   * Mengosongkan seluruh cache aplikasi
   */
  function clearAll() {
    memoryCache.clear();
    try {
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const sKey = sessionStorage.key(i);
        if (sKey && sKey.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(sKey);
        }
      }
      keysToRemove.forEach(k => sessionStorage.removeItem(k));
    } catch (e) {}
    console.info('[CacheService] Seluruh cache aplikasi telah dikosongkan.');
  }

  /**
   * Wrapper cerdas untuk eksekusi API dengan Caching + Request Deduplication.
   * Jika pemanggilan yang sama sedang berlangsung, request kedua akan menunggu hasil yang sama
   * tanpa mengirimkan 2 request HTTP paralel ke server.
   *
   * @param {string} key Kunci cache
   * @param {number} ttlSeconds Masa berlaku
   * @param {Array<string>} tags Label tag
   * @param {Function} fetcherFn Fungsi async yang memanggil API asli
   * @param {boolean} forceRefresh Jika true, abaikan cache dan ambil yang terbaru
   * @return {Promise<*>} Hasil data
   */
  async function wrap(key, ttlSeconds, tags, fetcherFn, forceRefresh = false) {
    // 1. Jika tidak force refresh, cek cache terlebih dahulu
    if (!forceRefresh) {
      const cached = get(key);
      if (cached !== null) {
        return cached;
      }
    }

    // 2. Request Deduplication: Cek jika request serupa sedang in-flight
    if (inFlightRequests.has(key)) {
      return inFlightRequests.get(key);
    }

    // 3. Eksekusi fetcher baru
    const promise = (async () => {
      try {
        const freshData = await fetcherFn();
        if (freshData && freshData.success !== false) {
          set(key, freshData, ttlSeconds, tags);
        }
        return freshData;
      } finally {
        inFlightRequests.delete(key);
      }
    })();

    inFlightRequests.set(key, promise);
    return promise;
  }

  return {
    TTL,
    set,
    get,
    has,
    remove,
    invalidateTag,
    clearAll,
    wrap
  };
})();
