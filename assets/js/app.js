/**
 * ============================================================================
 * Aplikasi Latihan Soal SD - Controller Utama (app.js)
 * File: assets/js/app.js
 * Deskripsi: Inisialisasi aplikasi, navigasi view, modal universal,
 *            notifikasi toast, utilitas escape/clipboard/csv, dan konfigurasi API.
 * ============================================================================
 */

const app = (function() {
  'use strict';

  let currentTeacherView = 'dashboard';
  let pendingConfirmCallback = null;

  /* --- Utilitas UI Global --- */
  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const iconMap = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${iconMap[type] || 'ℹ️'}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'all 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, duration);
  }

  function showConfirmModal(title, message, onConfirm) {
    document.getElementById('universalConfirmTitle').textContent = title || 'Konfirmasi';
    document.getElementById('universalConfirmMessage').textContent = message || 'Apakah Anda yakin?';
    pendingConfirmCallback = onConfirm;
    openModal('modalUniversalConfirm');

    const okBtn = document.getElementById('btnUniversalConfirmOk');
    okBtn.onclick = function() {
      closeModal('modalUniversalConfirm');
      if (typeof pendingConfirmCallback === 'function') {
        pendingConfirmCallback();
      }
    };
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('hidden');
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function copyTextToClipboard(text, successMsg = 'Berhasil disalin ke clipboard!') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg, 'success');
      }).catch(() => {
        fallbackCopyText(text, successMsg);
      });
    } else {
      fallbackCopyText(text, successMsg);
    }
  }

  function fallbackCopyText(text, successMsg) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast(successMsg, 'success');
    } catch (err) {
      showToast('Gagal menyalin teks', 'error');
    }
    document.body.removeChild(textArea);
  }

  function downloadCsvFile(csvContent, filename = 'data.csv') {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /* --- Navigasi Portal Guru --- */
  function toggleSidebar() {
    document.getElementById('teacherSidebar')?.classList.toggle('open');
  }

  function switchTeacherView(viewName) {
    currentTeacherView = viewName;
    document.getElementById('teacherSidebar')?.classList.remove('open');

    // Update active state sidebar
    const items = document.querySelectorAll('.sidebar-item');
    items.forEach(el => {
      if (el.getAttribute('data-view') === viewName) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Sembunyikan semua section guru
    const views = document.querySelectorAll('.t-view');
    views.forEach(v => v.classList.add('hidden'));

    // Tampilkan view target
    const target = document.getElementById('view-' + viewName);
    if (target) target.classList.remove('hidden');

    const titleMap = {
      dashboard: 'Dashboard Utama',
      kelas: 'Kelola Kelas & Siswa',
      banksoal: 'Bank Soal Guru',
      paket: 'Paket Latihan Soal',
      token: 'Token Akses Siswa',
      hasil: 'Hasil & Rekap Nilai',
      pengaturan: 'Pengaturan Akun & Sistem'
    };
    document.getElementById('teacherPageTitle').textContent = titleMap[viewName] || 'Guru Pintar';

    // Panggil loader sesuai modul
    if (viewName === 'dashboard') dashboard.load();
    else if (viewName === 'kelas') kelas.load();
    else if (viewName === 'banksoal') bankSoal.load();
    else if (viewName === 'paket') paketLatihan.load();
    else if (viewName === 'token') tokenSiswa.load();
    else if (viewName === 'hasil') hasilRekap.load();
    else if (viewName === 'pengaturan') loadPengaturanView();
  }

  function initTeacherPortal(profile) {
    document.getElementById('teacherGreeting').textContent = profile.namaGuru || profile.username;
    document.getElementById('student-container').classList.add('hidden');
    document.getElementById('teacher-container').classList.remove('hidden');
    switchTeacherView('dashboard');
  }

  function showStudentEntryScreen() {
    document.getElementById('teacher-container').classList.add('hidden');
    document.getElementById('student-container').classList.remove('hidden');
    document.getElementById('student-token-screen').classList.remove('hidden');
    document.getElementById('student-info-screen').classList.add('hidden');
    document.getElementById('student-quiz-screen').classList.add('hidden');
    document.getElementById('student-result-screen').classList.add('hidden');
    document.getElementById('student-review-screen').classList.add('hidden');
  }

  /* --- Pengaturan Akun & Sistem --- */
  function loadPengaturanView() {
    const inputUrl = document.getElementById('backendApiUrlInput');
    if (inputUrl) {
      inputUrl.value = api.getUrl();
    }
  }

  function saveBackendUrlFromView() {
    const inputUrl = document.getElementById('backendApiUrlInput');
    if (!inputUrl) return;
    const url = inputUrl.value.trim();
    api.setUrl(url);
    showToast('URL Backend berhasil disimpan!', 'success');
  }

  async function testBackendConnection() {
    showToast('Menguji koneksi ke backend...', 'info', 2000);
    try {
      const res = await api.ping();
      showToast('Koneksi berhasil! Backend online: ' + (res.message || 'OK'), 'success', 4000);
    } catch (err) {
      showToast('Koneksi gagal: ' + err.message, 'error', 5000);
    }
  }

  async function handlePasswordChangeSubmit() {
    const oldPass = document.getElementById('setOldPass').value;
    const newPass = document.getElementById('setNewPass').value;
    const confirmPass = document.getElementById('setConfirmPass').value;

    try {
      const res = await auth.changePassword(oldPass, newPass, confirmPass);
      showToast(res.message || 'Password berhasil diperbarui', 'success');
      document.getElementById('setOldPass').value = '';
      document.getElementById('setNewPass').value = '';
      document.getElementById('setConfirmPass').value = '';
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function runDatabaseSetupVerification() {
    showToast('Memverifikasi database Google Sheets...', 'info', 3000);
    try {
      const res = await api.setupLMS();
      showToast('Setup database terverifikasi: ' + (res.message || 'OK'), 'success', 4000);
    } catch (err) {
      showToast('Verifikasi gagal: ' + err.message, 'error', 4000);
    }
  }

  /* --- Modal Konfigurasi URL Backend Cepat --- */
  function openApiConfigModal() {
    const input = document.getElementById('modalApiUrlInput');
    if (input) input.value = api.getUrl();
    openModal('modalApiConfig');
  }

  function saveApiConfigFromModal() {
    const input = document.getElementById('modalApiUrlInput');
    if (!input) return;
    const url = input.value.trim();
    api.setUrl(url);
    closeModal('modalApiConfig');
    showToast('URL Backend berhasil disimpan!', 'success');
  }

  /* --- Handler Login Guru & Guru Pertama --- */
  function openTeacherLoginModal() {
    document.getElementById('tLoginUsername').value = '';
    document.getElementById('tLoginPassword').value = '';
    openModal('modalTeacherLogin');
  }

  async function handleTeacherLoginSubmit() {
    const u = document.getElementById('tLoginUsername').value.trim();
    const p = document.getElementById('tLoginPassword').value;

    const btn = document.getElementById('btnSubmitLoginTeacher');
    btn.disabled = true;
    btn.textContent = 'Memverifikasi...';

    try {
      const res = await auth.login(u, p);
      btn.disabled = false;
      btn.textContent = 'Masuk';
      closeModal('modalTeacherLogin');
      initTeacherPortal(res.profile);
      showToast('Selamat datang, ' + res.profile.namaGuru, 'success');
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Masuk';
      showToast(err.message, 'error');
    }
  }

  function openFirstTeacherSetupModal() {
    closeModal('modalTeacherLogin');
    document.getElementById('ftNama').value = '';
    document.getElementById('ftUsername').value = '';
    document.getElementById('ftPassword').value = '';
    openModal('modalFirstTeacher');
  }

  async function handleCreateFirstTeacherSubmit() {
    const nama = document.getElementById('ftNama').value.trim();
    const u = document.getElementById('ftUsername').value.trim();
    const p = document.getElementById('ftPassword').value;

    showToast('Membuat akun guru...', 'info', 2000);

    try {
      const res = await auth.createFirstTeacher(u, p, nama);
      showToast(res.message || 'Akun guru berhasil dibuat!', 'success', 4000);
      closeModal('modalFirstTeacher');
      openTeacherLoginModal();
      document.getElementById('tLoginUsername').value = u;
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  /* --- Inisialisasi Saat Halaman Siap (DOM Ready) --- */
  function init() {
    // 1. Cek parameter URL (?token=XYZ) untuk langsung memulai latihan siswa
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');

    if (tokenParam && tokenParam.trim() !== '') {
      const inputEl = document.getElementById('inputStudentToken');
      if (inputEl) {
        inputEl.value = tokenParam.trim().toUpperCase();
        tokenSiswa.validateInputToken();
        return;
      }
    }

    // 2. Cek apakah ada sesi guru yang masih aktif di browser
    if (auth.isLoggedIn()) {
      const profile = auth.getProfile();
      if (profile) {
        initTeacherPortal(profile);
        return;
      }
    }

    // 3. Cek apakah ada pengerjaan kuis siswa yang sedang berlangsung (tahan refresh)
    const storedSesiId = localStorage.getItem('sd_active_sesi_id');
    const storedToken = localStorage.getItem('sd_active_token');
    const storedName = localStorage.getItem('sd_active_name');

    if (storedSesiId && storedToken && storedName) {
      tokenSiswa.resumeFromStorage(storedToken, storedName);
      return;
    }

    // 4. Periksa apakah URL backend sudah diset
    if (!api.getUrl()) {
      setTimeout(() => {
        openApiConfigModal();
      }, 500);
    }
  }

  // Daftarkan listener saat DOM siap
  document.addEventListener('DOMContentLoaded', init);

  return {
    showToast,
    showConfirmModal,
    openModal,
    closeModal,
    escapeHtml,
    copyTextToClipboard,
    downloadCsvFile,
    toggleSidebar,
    switchTeacherView,
    initTeacherPortal,
    showStudentEntryScreen,
    saveBackendUrlFromView,
    testBackendConnection,
    handlePasswordChangeSubmit,
    runDatabaseSetupVerification,
    openApiConfigModal,
    saveApiConfigFromModal,
    openTeacherLoginModal,
    handleTeacherLoginSubmit,
    openFirstTeacherSetupModal,
    handleCreateFirstTeacherSubmit
  };
})();
