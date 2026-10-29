/**
 * ============================================================================
 * Aplikasi Latihan Soal SD - Modul Paket Latihan (paket-latihan.js)
 * File: assets/js/paket-latihan.js
 * Deskripsi: Penyusunan paket kuis, penentuan durasi, jadwal, pengacakan,
 *            serta pemilihan soal dari Bank Soal.
 * ============================================================================
 */

const paketLatihan = (function() {
  'use strict';

  let cachedPaketList = [];

  async function load(forceRefresh = false) {
    const tbody = document.getElementById('paketTableBody');
    if (tbody && (cachedPaketList.length === 0 || forceRefresh)) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Memuat paket latihan...</td></tr>';
    }

    try {
      const res = await api.getPaketLatihan(forceRefresh);
      cachedPaketList = res.data || [];

      if (!tbody) return;

      if (cachedPaketList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada paket latihan. Klik "Buat Paket Latihan".</td></tr>';
        return;
      }

      let html = '';
      cachedPaketList.forEach(p => {
        let statusBadge = 'badge-secondary';
        if (p.Status === 'TERBIT') statusBadge = 'badge-success';
        else if (p.Status === 'TUTUP') statusBadge = 'badge-danger';

        html += `
          <tr>
            <td class="font-bold">${app.escapeHtml(p.Judul)}</td>
            <td>${app.escapeHtml(p.MataPelajaran)} / Kls ${app.escapeHtml(p.Tingkat)}</td>
            <td>${p.DurasiMenit > 0 ? p.DurasiMenit + ' Menit' : 'Bebas'}</td>
            <td><span class="badge badge-primary">${p.jumlahSoal || 0} Soal</span></td>
            <td><span class="badge ${statusBadge}">${app.escapeHtml(p.Status)}</span></td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="paketLatihan.edit('${p.PaketID}')">✏️ Edit</button>
              ${p.Status !== 'TERBIT' ? `<button class="btn btn-success btn-sm" onclick="paketLatihan.setStatus('${p.PaketID}', 'TERBIT')">Terbitkan</button>` : ''}
              ${p.Status === 'TERBIT' ? `<button class="btn btn-warning btn-sm" onclick="paketLatihan.setStatus('${p.PaketID}', 'TUTUP')">Tutup</button>` : ''}
              <button class="btn btn-primary btn-sm" onclick="tokenSiswa.quickCreate('${p.PaketID}')">🔑 Token</button>
              <button class="btn btn-danger btn-sm" onclick="paketLatihan.deletePaket('${p.PaketID}')" title="Hapus Paket">🗑️</button>
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Gagal memuat: ${app.escapeHtml(err.message)}</td></tr>`;
      }
      app.showToast('Gagal memuat paket latihan: ' + err.message, 'error');
    }
  }

  async function openModal() {
    document.getElementById('paketIdInput').value = '';
    document.getElementById('paketJudulInput').value = '';
    document.getElementById('paketMapelInput').value = 'Matematika';
    document.getElementById('paketTingkatInput').value = '6';
    document.getElementById('paketDurasiInput').value = '30';
    document.getElementById('paketPercobaanInput').value = '1';
    document.getElementById('paketPetunjukInput').value = 'Kerjakan soal dengan teliti dan pilih jawaban yang paling tepat.';
    document.getElementById('paketAcakSoal').checked = false;
    document.getElementById('paketAcakPilihan').checked = false;
    document.getElementById('paketTampilkanNilai').checked = true;
    document.getElementById('paketTampilkanKunci').checked = true;
    document.getElementById('paketTampilkanPembahasan').checked = true;
    document.getElementById('modalPaketTitle').textContent = 'Buat Paket Latihan Baru';

    loadBankSoalForPicker([]);
    app.openModal('modalPaket');
  }

  async function edit(paketId) {
    try {
      const res = await api.getPaketDetail(paketId);
      const p = res.data.paket;
      const assignedSoal = res.data.soalList || [];
      const assignedIds = assignedSoal.map(s => s.soalId);

      document.getElementById('paketIdInput').value = p.PaketID;
      document.getElementById('paketJudulInput').value = p.Judul;
      document.getElementById('paketMapelInput').value = p.MataPelajaran;
      document.getElementById('paketTingkatInput').value = p.Tingkat;
      document.getElementById('paketDurasiInput').value = p.DurasiMenit;
      document.getElementById('paketPercobaanInput').value = p.MaksPercobaan;
      document.getElementById('paketPetunjukInput').value = p.Petunjuk || '';
      document.getElementById('paketAcakSoal').checked = (p.AcakSoal === true || String(p.AcakSoal).toUpperCase() === 'TRUE');
      document.getElementById('paketAcakPilihan').checked = (p.AcakPilihan === true || String(p.AcakPilihan).toUpperCase() === 'TRUE');
      document.getElementById('paketTampilkanNilai').checked = (p.TampilkanNilai === true || String(p.TampilkanNilai).toUpperCase() === 'TRUE');
      document.getElementById('paketTampilkanKunci').checked = (p.TampilkanKunci === true || String(p.TampilkanKunci).toUpperCase() === 'TRUE');
      document.getElementById('paketTampilkanPembahasan').checked = (p.TampilkanPembahasan === true || String(p.TampilkanPembahasan).toUpperCase() === 'TRUE');

      document.getElementById('modalPaketTitle').textContent = 'Edit Paket Latihan';
      loadBankSoalForPicker(assignedIds);
      app.openModal('modalPaket');
    } catch (err) {
      app.showToast('Gagal memuat detail paket: ' + err.message, 'error');
    }
  }

  async function loadBankSoalForPicker(selectedSoalIds = []) {
    const tbody = document.getElementById('paketSoalPickerBody');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Memuat daftar soal...</td></tr>';

    try {
      const res = await api.getBankSoal({});
      const list = res.data || [];

      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Belum ada soal di Bank Soal. Tambahkan soal terlebih dahulu.</td></tr>';
        return;
      }

      let html = '';
      list.forEach(s => {
        const isChecked = selectedSoalIds.includes(s.SoalID);
        html += `
          <tr class="picker-row" data-text="${app.escapeHtml(s.Pertanyaan.toLowerCase())}">
            <td><input type="checkbox" class="picker-soal-check" value="${s.SoalID}" ${isChecked ? 'checked' : ''} onchange="paketLatihan.updateSelectedPickerCount()"></td>
            <td>${app.escapeHtml(s.Pertanyaan)}</td>
            <td><span class="badge badge-secondary">${app.escapeHtml(s.JenisSoal)}</span></td>
            <td>${app.escapeHtml(s.Bobot)}</td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
      updateSelectedPickerCount();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center">Gagal memuat: ${app.escapeHtml(err.message)}</td></tr>`;
    }
  }

  function updateSelectedPickerCount() {
    const checks = document.querySelectorAll('.picker-soal-check:checked');
    document.getElementById('selectedSoalCount').textContent = checks.length;
  }

  function toggleSelectAllPicker(mainCheck) {
    const checks = document.querySelectorAll('.picker-soal-check');
    checks.forEach(c => { c.checked = mainCheck.checked; });
    updateSelectedPickerCount();
  }

  function filterPicker() {
    const kw = document.getElementById('paketSoalPickerSearch')?.value.toLowerCase().trim() || '';
    const rows = document.querySelectorAll('.picker-row');
    rows.forEach(r => {
      const txt = r.getAttribute('data-text') || '';
      if (!kw || txt.includes(kw)) {
        r.style.display = '';
      } else {
        r.style.display = 'none';
      }
    });
  }

  async function save() {
    const judul = document.getElementById('paketJudulInput').value.trim();
    if (!judul) {
      app.showToast('Judul paket latihan wajib diisi', 'warning');
      return;
    }

    const selectedChecks = document.querySelectorAll('.picker-soal-check:checked');
    const selectedSoal = [];
    selectedChecks.forEach((c, idx) => {
      selectedSoal.push({
        soalId: c.value,
        urutan: idx + 1
      });
    });

    const payload = {
      PaketID: document.getElementById('paketIdInput').value,
      Judul: judul,
      MataPelajaran: document.getElementById('paketMapelInput').value,
      Tingkat: document.getElementById('paketTingkatInput').value,
      DurasiMenit: document.getElementById('paketDurasiInput').value,
      MaksPercobaan: document.getElementById('paketPercobaanInput').value,
      Petunjuk: document.getElementById('paketPetunjukInput').value.trim(),
      AcakSoal: document.getElementById('paketAcakSoal').checked,
      AcakPilihan: document.getElementById('paketAcakPilihan').checked,
      TampilkanNilai: document.getElementById('paketTampilkanNilai').checked,
      TampilkanKunci: document.getElementById('paketTampilkanKunci').checked,
      TampilkanPembahasan: document.getElementById('paketTampilkanPembahasan').checked
    };

    try {
      const res = await api.savePaketLatihan(payload, selectedSoal);
      app.showToast(res.message || 'Paket latihan berhasil disimpan', 'success');
      app.closeModal('modalPaket');
      load();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  }

  async function setStatus(paketId, status) {
    try {
      const res = await api.updatePaketStatus(paketId, status);
      app.showToast(res.message || 'Status paket berhasil diubah', 'success');
      load();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  }

  function deletePaket(paketId) {
    const p = cachedPaketList.find(item => item.PaketID === paketId);
    const title = p ? `"${app.escapeHtml(p.Judul)}"` : 'paket ini';

    app.showConfirmModal('Hapus Paket Latihan', `Apakah Anda yakin ingin menghapus ${title}? Paket akan dihapus secara permanen dari server dan database Google Sheets.`, async function() {
      cachedPaketList = cachedPaketList.filter(item => item.PaketID !== paketId);
      app.showToast('Menghapus paket latihan...', 'info', 2000);
      try {
        const res = await api.deletePaketLatihan(paketId);
        app.showToast(res.message || 'Paket berhasil dihapus permanen!', 'success');
        await load();
      } catch (err) {
        app.showToast('Gagal menghapus: ' + err.message, 'error');
        await load();
      }
    });
  }

  return {
    load,
    openModal,
    edit,
    save,
    setStatus,
    deletePaket,
    updateSelectedPickerCount,
    toggleSelectAllPicker,
    filterPicker,
    getCachedList: () => cachedPaketList
  };
})();
