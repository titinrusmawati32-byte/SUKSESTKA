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
      if (document.getElementById('dashHeroGaugeVal')) document.getElementById('dashHeroGaugeVal').textContent = d.rataRataNilai || '82.5';

      if (!tbody) return;

      if (!d.recentAttempts || d.recentAttempts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted" style="padding: 20px;">Belum ada siswa yang mengumpulkan jawaban.</td></tr>';
        return;
      }

      const avatars = ['👧', '👦', '🧒', '👧🏻', '👦🏻'];
      let html = '';
      d.recentAttempts.forEach((item, idx) => {
        const score = Number(item.nilaiAkhir) || 0;
        let scoreClass = 'score-high';
        if (score < 70) scoreClass = 'score-low';
        else if (score < 80) scoreClass = 'score-med';

        const avatar = avatars[idx % avatars.length];

        html += `
          <tr>
            <td>
              <div class="flex items-center gap-2">
                <span class="student-avatar-circle">${avatar}</span>
                <span class="font-bold">${app.escapeHtml(item.namaSiswa)}</span>
              </div>
            </td>
            <td>${app.escapeHtml(item.judulPaket)}</td>
            <td><span class="score-pill ${scoreClass}">${score}</span></td>
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
