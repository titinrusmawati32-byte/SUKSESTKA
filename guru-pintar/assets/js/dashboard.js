/**
 * ============================================================================
 * Aplikasi Latihan Soal SD - Modul Dashboard Guru (dashboard.js)
 * File: assets/js/dashboard.js
 * Deskripsi: Mengambil dan merender ringkasan statistik kelas, paket, bank soal,
 *            serta 5 aktivitas pengerjaan siswa terbaru.
 * ============================================================================
 */

const dashboard = (function() {
  'use strict';

  async function load() {
    const tbody = document.getElementById('dashRecentTable');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Memuat data dashboard...</td></tr>';
    }

    try {
      const res = await api.getTeacherDashboard();
      if (!res || !res.success) {
        throw new Error(res.message || 'Gagal memuat dashboard');
      }

      const d = res.data;
      document.getElementById('dashTotalKelas').textContent = d.totalKelas || 0;
      document.getElementById('dashPaketAktif').textContent = d.totalPaketAktif || 0;
      document.getElementById('dashTotalSoal').textContent = d.totalSoal || 0;
      document.getElementById('dashTotalPengerjaan').textContent = d.totalPengerjaan || 0;
      document.getElementById('dashRataRata').textContent = d.rataRataNilai || 0;

      if (!tbody) return;

      if (!d.recentAttempts || d.recentAttempts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Belum ada siswa yang mengumpulkan jawaban.</td></tr>';
        return;
      }

      let html = '';
      d.recentAttempts.forEach(item => {
        html += `
          <tr>
            <td class="font-bold">${app.escapeHtml(item.namaSiswa)}</td>
            <td>${app.escapeHtml(item.judulPaket)}</td>
            <td><span class="badge badge-success">${item.nilaiAkhir}</span></td>
            <td class="text-muted" style="font-size:12px;">${item.dikirimPada || '-'}</td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center">Gagal memuat: ${app.escapeHtml(err.message)}</td></tr>`;
      }
      app.showToast('Gagal memuat dashboard: ' + err.message, 'error');
    }
  }

  return {
    load
  };
})();
