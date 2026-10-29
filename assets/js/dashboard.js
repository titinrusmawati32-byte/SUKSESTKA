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

  async function load(forceRefresh = false) {
    const tbody = document.getElementById('dashRecentTable');
    
    // Gunakan cache jika ada agar UI langsung tampil seketika (0ms)
    const hasExistingData = document.getElementById('dashTotalKelas')?.textContent !== '0' && document.getElementById('dashTotalKelas')?.textContent !== '';
    if (tbody && !hasExistingData && !forceRefresh) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted"><span class="spinner-sm"></span> Memuat ringkasan dashboard...</td></tr>';
    }

    try {
      const res = await api.getTeacherDashboard(forceRefresh);
      if (!res || !res.success) {
        throw new Error(res.message || 'Gagal memuat dashboard');
      }

      const d = res.data;
      if (document.getElementById('dashTotalKelas')) document.getElementById('dashTotalKelas').textContent = d.totalKelas || 0;
      if (document.getElementById('dashPaketAktif')) document.getElementById('dashPaketAktif').textContent = d.totalPaketAktif || 0;
      if (document.getElementById('dashTotalSoal')) document.getElementById('dashTotalSoal').textContent = d.totalSoal || 0;
      if (document.getElementById('dashTotalPengerjaan')) document.getElementById('dashTotalPengerjaan').textContent = d.totalPengerjaan || 0;
      if (document.getElementById('dashRataRata')) document.getElementById('dashRataRata').textContent = d.rataRataNilai || 0;

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
      if (tbody && !hasExistingData) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center">Gagal memuat: ${app.escapeHtml(err.message)}</td></tr>`;
      }
      app.showToast('Gagal memuat dashboard: ' + err.message, 'error');
    }
  }

  function refresh() {
    return load(true);
  }

  return {
    load,
    refresh
  };
})();
