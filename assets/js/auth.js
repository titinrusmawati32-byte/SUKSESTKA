/**
 * ============================================================================
 * Aplikasi Latihan Soal SD - Modul Autentikasi Guru (auth.js)
 * File: assets/js/auth.js
 * Deskripsi: Manajemen sesi guru, login, logout, pembuatan akun pertama,
 *            dan ganti password.
 * ============================================================================
 */

const auth = (function() {
  'use strict';

  const TOKEN_KEY = 'lms_teacher_session_token';
  const PROFILE_KEY = 'lms_teacher_profile';

  function getSessionToken() {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  }

  function getProfile() {
    const raw = sessionStorage.getItem(PROFILE_KEY) || localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function isLoggedIn() {
    return Boolean(getSessionToken());
  }

  function saveSession(token, profile) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }

  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PROFILE_KEY);
  }

  async function login(username, password) {
    if (!username || !password) {
      throw new Error('Username dan password wajib diisi.');
    }

    const res = await api.loginTeacher(username.trim(), password);
    if (res && res.success) {
      saveSession(res.sessionToken, res.profile);
      return res;
    } else {
      throw new Error((res && res.message) ? res.message : 'Login gagal.');
    }
  }

  async function logout() {
    const token = getSessionToken();
    try {
      if (token) {
        await api.logoutTeacher(token);
      }
    } catch (e) {
      console.warn('Gagal memanggil endpoint logout backend:', e);
    } finally {
      clearSession();
      if (typeof app !== 'undefined' && app.showStudentEntryScreen) {
        app.showStudentEntryScreen();
      }
    }
  }

  function handleSessionExpired() {
    clearSession();
    if (typeof app !== 'undefined') {
      app.showToast('Sesi Anda telah kedaluwarsa. Silakan login kembali.', 'warning', 4000);
      app.showStudentEntryScreen();
    }
  }

  async function createFirstTeacher(username, password, namaGuru) {
    if (!username || !password || !namaGuru) {
      throw new Error('Semua bidang (nama, username, password) wajib diisi.');
    }
    return await api.createFirstTeacher(username.trim(), password, namaGuru.trim());
  }

  async function changePassword(oldPassword, newPassword, confirmPassword) {
    if (!oldPassword || !newPassword) {
      throw new Error('Password lama dan password baru wajib diisi.');
    }
    if (newPassword.length < 6) {
      throw new Error('Password baru minimal 6 karakter.');
    }
    if (newPassword !== confirmPassword) {
      throw new Error('Konfirmasi password tidak cocok.');
    }

    return await api.changeTeacherPassword(oldPassword, newPassword);
  }

  return {
    getSessionToken,
    getProfile,
    isLoggedIn,
    login,
    logout,
    handleSessionExpired,
    createFirstTeacher,
    changePassword
  };
})();
