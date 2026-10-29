/**
 * ============================================================================
 * Aplikasi Latihan Soal SD - Modul Hasil & Rekap (hasil-rekap.js)
 * File: assets/js/hasil-rekap.js
 * Deskripsi: Rekapitulasi hasil ujian siswa, lembar detail jawaban,
 *            koreksi manual nilai isian oleh guru, dan ekspor CSV/Excel.
 * ============================================================================
 */

const hasilRekap = (function() {
  'use strict';

  async function load() {
    const tbody = document.getElementById('hasilTableBody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Memuat rekap hasil siswa...</td></tr>';
    }

    try {
      const res = await api.getHasilList({});
      if (!res || !res.success) throw new Error(res.message || 'Gagal memuat rekap');

      const d = res.data;
      document.getElementById('rekapTotalPeserta').textContent = d.stats.totalPeserta || 0;
      document.getElementById('rekapRataRata').textContent = d.stats.rataRata || 0;
      document.getElementById('rekapTertinggi').textContent = d.stats.nilaiTertinggi || 0;
      document.getElementById('rekapTerendah').textContent = d.stats.nilaiTerendah || 0;

      if (!tbody) return;

      if (d.list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada data pengerjaan siswa.</td></tr>';
        return;
      }

      let html = '';
      d.list.forEach(item => {
        html += `
          <tr>
            <td class="font-bold">${app.escapeHtml(item.namaSiswa)}</td>
            <td>${app.escapeHtml(item.kelasId || '-')}</td>
            <td>${app.escapeHtml(item.judulPaket)}</td>
            <td class="text-muted" style="font-size:12px;">${item.dikirimPada || '-'}</td>
            <td><span class="badge badge-success" style="font-size:14px;">${item.nilaiAkhir}</span></td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="hasilRekap.openDetail('${item.sesiId}')">📄 Detail Jawaban</button>
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Gagal memuat: ${app.escapeHtml(err.message)}</td></tr>`;
      }
      app.showToast('Gagal memuat rekap nilai: ' + err.message, 'error');
    }
  }

  async function openDetail(sesiId) {
    try {
      const res = await api.getHasilDetail(sesiId);
      const d = res.data;
      const sesi = d.sesi;
      const ringkas = d.ringkasan;

      const headerHtml = `
        <div class="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h4 style="font-size:16px; font-weight:800;">${app.escapeHtml(sesi.NamaSiswaSnapshot)}</h4>
            <p class="text-muted" style="font-size:13px;">${app.escapeHtml(d.paket.Judul)} | Mulai: ${sesi.MulaiPada} | Selesai: ${sesi.DikirimPada}</p>
          </div>
          <div class="flex gap-2 items-center">
            <span class="badge badge-success">Benar: ${ringkas.totalBenar}</span>
            <span class="badge badge-danger">Salah: ${ringkas.totalSalah}</span>
            <span class="badge badge-secondary">Kosong: ${ringkas.totalKosong}</span>
            <span class="badge badge-primary" style="font-size:16px;">Nilai: ${sesi.NilaiAkhir}</span>
          </div>
        </div>
      `;
      document.getElementById('detailHasilHeaderCard').innerHTML = headerHtml;

      let listHtml = '';
      d.jawabanList.forEach((item, idx) => {
        const isBenar = item.benar;
        listHtml += `
          <div class="card" style="padding:16px; margin-bottom:12px; border-left: 4px solid ${isBenar ? 'var(--secondary)' : 'var(--accent-red)'};">
            <div class="flex justify-between items-center" style="margin-bottom:8px;">
              <span class="font-bold">Soal ${idx + 1} (${item.jenisSoal})</span>
              <span class="badge ${isBenar ? 'badge-success' : 'badge-danger'}">
                ${isBenar ? `BENAR (+ ${item.skor})` : 'SALAH (0)'}
              </span>
            </div>
            <div style="margin-bottom:8px;">${app.escapeHtml(item.pertanyaan)}</div>
            <div style="font-size:14px; margin-bottom:6px;">
              <b>Jawaban Siswa:</b> <span style="color:${isBenar ? 'var(--secondary)' : 'var(--accent-red)'}; font-weight:bold;">${app.escapeHtml(item.jawabanSiswa || '(Kosong)')}</span>
            </div>
            <div style="font-size:13px; color:var(--text-muted);">
              <b>Kunci Jawaban:</b> ${app.escapeHtml(item.kunciJawaban)}
            </div>
            ${item.pembahasan ? `<div style="font-size:12px; color:var(--text-muted); margin-top:4px;"><b>Pembahasan:</b> ${app.escapeHtml(item.pembahasan)}</div>` : ''}
            <div style="margin-top:10px; padding-top:8px; border-top:1px dashed var(--border); display:flex; gap:8px; align-items:center;">
              <span style="font-size:12px; font-weight:600;">Koreksi Manual Guru:</span>
              <button class="btn btn-success btn-sm" onclick="hasilRekap.manualScore('${item.jawabanId}', ${item.bobot}, true, '${sesiId}')">Set Benar</button>
              <button class="btn btn-danger btn-sm" onclick="hasilRekap.manualScore('${item.jawabanId}', 0, false, '${sesiId}')">Set Salah</button>
            </div>
          </div>
        `;
      });

      document.getElementById('detailHasilList').innerHTML = listHtml;
      app.openModal('modalDetailHasil');
    } catch (err) {
      app.showToast('Gagal memuat detail jawaban: ' + err.message, 'error');
    }
  }

  async function manualScore(jawabanId, skorBaru, benarBaru, sesiId) {
    try {
      const res = await api.updateJawabanManual(jawabanId, skorBaru, benarBaru);
      app.showToast(res.message || 'Nilai berhasil diperbarui', 'success');
      openDetail(sesiId);
      load();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  }

  async function downloadCsv() {
    try {
      const res = await api.exportHasilCsv('', '');
      if (res && res.csvContent) {
        app.downloadCsvFile(res.csvContent, res.fileName || 'rekap_nilai_siswa.csv');
        app.showToast('Rekap nilai berhasil diunduh.', 'success');
      }
    } catch (err) {
      app.showToast('Gagal mengunduh CSV: ' + err.message, 'error');
    }
  }

  return {
    load,
    openDetail,
    manualScore,
    downloadCsv
  };
})();
