/**
 * ============================================================================
 * Aplikasi Latihan Soal SD - Modul Kelas & Siswa (kelas.js)
 * File: assets/js/kelas.js
 * Deskripsi: Manajemen CRUD Kelas, Roster Siswa, dan Impor Siswa CSV.
 * ============================================================================
 */

const kelas = (function() {
  'use strict';

  let cachedKelasList = [];
  let currentSelectedClassId = null;
  let stagedSiswaImport = null;

  async function load(forceRefresh = false) {
    const tbody = document.getElementById('kelasTableBody');
    if (tbody && (cachedKelasList.length === 0 || forceRefresh)) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Memuat data kelas...</td></tr>';
    }

    try {
      const res = await api.getTeacherKelas(forceRefresh);
      if (!res || !res.success) throw new Error(res.message || 'Gagal memuat kelas');

      cachedKelasList = res.data || [];

      if (!tbody) return;

      if (cachedKelasList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada kelas. Klik "Tambah Kelas" untuk membuat baru.</td></tr>';
        return;
      }

      let html = '';
      cachedKelasList.forEach(k => {
        const isAktif = (k.Aktif === true || String(k.Aktif).toUpperCase() === 'TRUE');
        html += `
          <tr>
            <td class="font-bold">${app.escapeHtml(k.NamaKelas)}</td>
            <td>Kelas ${app.escapeHtml(k.Tingkat)}</td>
            <td>${app.escapeHtml(k.TahunAjaran || '-')}</td>
            <td><span class="badge badge-primary">${k.jumlahSiswa || 0} Siswa</span></td>
            <td>${isAktif ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-danger">Arsip</span>'}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="kelas.openRoster('${k.KelasID}', '${app.escapeHtml(k.NamaKelas)}')">👥 Siswa</button>
              <button class="btn btn-secondary btn-sm" onclick="kelas.edit('${k.KelasID}')">✏️ Edit</button>
              ${isAktif ? `<button class="btn btn-danger btn-sm" onclick="kelas.archive('${k.KelasID}')">Arsip</button>` : ''}
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Gagal memuat: ${app.escapeHtml(err.message)}</td></tr>`;
      }
      app.showToast('Gagal memuat kelas: ' + err.message, 'error');
    }
  }

  function openModal() {
    document.getElementById('kelasIdInput').value = '';
    document.getElementById('namaKelasInput').value = '';
    document.getElementById('tingkatKelasInput').value = '6';
    document.getElementById('tahunAjaranInput').value = '';
    document.getElementById('modalKelasTitle').textContent = 'Tambah Kelas Baru';
    app.openModal('modalKelas');
  }

  function edit(kelasId) {
    const k = cachedKelasList.find(item => item.KelasID === kelasId);
    if (!k) return;
    document.getElementById('kelasIdInput').value = k.KelasID;
    document.getElementById('namaKelasInput').value = k.NamaKelas;
    document.getElementById('tingkatKelasInput').value = k.Tingkat;
    document.getElementById('tahunAjaranInput').value = k.TahunAjaran || '';
    document.getElementById('modalKelasTitle').textContent = 'Edit Data Kelas';
    app.openModal('modalKelas');
  }

  async function save() {
    const nama = document.getElementById('namaKelasInput').value.trim();
    if (!nama) {
      app.showToast('Nama kelas wajib diisi', 'warning');
      return;
    }

    const payload = {
      KelasID: document.getElementById('kelasIdInput').value,
      NamaKelas: nama,
      Tingkat: document.getElementById('tingkatKelasInput').value,
      TahunAjaran: document.getElementById('tahunAjaranInput').value.trim()
    };

    try {
      const res = await api.saveKelas(payload);
      app.showToast(res.message || 'Kelas berhasil disimpan', 'success');
      app.closeModal('modalKelas');
      load();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  }

  function archive(kelasId) {
    app.showConfirmModal('Arsipkan Kelas', 'Apakah Anda yakin ingin mengarsipkan kelas ini?', async function() {
      try {
        const res = await api.archiveKelas(kelasId);
        app.showToast(res.message || 'Kelas berhasil diarsipkan', 'success');
        load();
      } catch (err) {
        app.showToast(err.message, 'error');
      }
    });
  }

  // --- Roster Siswa ---
  function openRoster(kelasId, namaKelas) {
    currentSelectedClassId = kelasId;
    document.getElementById('rosterKelasTitle').textContent = 'Daftar Siswa - Kelas ' + namaKelas;
    app.openModal('modalRosterSiswa');
    loadRoster(kelasId);
  }

  async function loadRoster(kelasId) {
    const tbody = document.getElementById('rosterTableBody');
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Memuat daftar siswa...</td></tr>';

    try {
      const res = await api.getTeacherSiswa(kelasId);
      const list = res.data || [];

      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Belum ada siswa di kelas ini.</td></tr>';
        return;
      }

      let html = '';
      list.forEach(s => {
        html += `
          <tr>
            <td><span class="badge badge-secondary">${s.NomorAbsen || '-'}</span></td>
            <td class="font-bold">${app.escapeHtml(s.NamaSiswa)}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="kelas.deleteSiswa('${s.SiswaID}')">Hapus</button>
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-danger text-center">Gagal memuat: ${app.escapeHtml(err.message)}</td></tr>`;
    }
  }

  function openAddSiswaForm() {
    const form = document.getElementById('miniSiswaForm');
    form.classList.remove('hidden');
    document.getElementById('siswaNamaInput').value = '';
    document.getElementById('siswaAbsenInput').value = '';
    document.getElementById('siswaNamaInput').focus();
  }

  async function saveSiswa() {
    const nama = document.getElementById('siswaNamaInput').value.trim();
    const absen = document.getElementById('siswaAbsenInput').value.trim();
    if (!nama) {
      app.showToast('Nama siswa wajib diisi', 'warning');
      return;
    }

    const payload = {
      KelasID: currentSelectedClassId,
      NamaSiswa: nama,
      NomorAbsen: absen
    };

    try {
      const res = await api.saveSiswa(payload);
      app.showToast(res.message || 'Siswa berhasil ditambahkan', 'success');
      document.getElementById('siswaNamaInput').value = '';
      document.getElementById('siswaAbsenInput').value = '';
      loadRoster(currentSelectedClassId);
      load(); // update counter di daftar kelas
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  }

  function deleteSiswa(siswaId) {
    app.showConfirmModal('Hapus Siswa', 'Apakah Anda yakin ingin menghapus siswa ini dari kelas?', async function() {
      try {
        const res = await api.deleteSiswa(siswaId);
        app.showToast(res.message || 'Siswa berhasil dihapus', 'success');
        loadRoster(currentSelectedClassId);
        load();
      } catch (err) {
        app.showToast(err.message, 'error');
      }
    });
  }

  // --- Impor Siswa CSV ---
  function openImportModal() {
    document.getElementById('siswaCsvFileInput').value = '';
    document.getElementById('siswaImportPreviewArea').classList.add('hidden');
    document.getElementById('btnCommitImportSiswa').disabled = true;
    stagedSiswaImport = null;
    app.openModal('modalImportSiswa');
  }

  async function downloadTemplate() {
    try {
      const res = await api.getTemplateSiswaCsv();
      app.downloadCsvFile(res.csvContent, 'template_daftar_siswa.csv');
    } catch (err) {
      app.showToast('Gagal mengunduh template: ' + err.message, 'error');
    }
  }

  function handleFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(evt) {
      const content = evt.target.result;
      try {
        const res = await api.previewImportSiswa(currentSelectedClassId, content);
        stagedSiswaImport = res.validRowsPayload;

        document.getElementById('siswaImportPreviewArea').classList.remove('hidden');
        document.getElementById('siswaImportSummary').innerHTML =
          `Total: <b>${res.totalBaris}</b> baris | Valid: <b class="text-success">${res.jumlahValid}</b> | Gagal: <b class="text-danger">${res.jumlahGagal}</b>`;

        document.getElementById('btnCommitImportSiswa').disabled = (res.jumlahValid === 0);
      } catch (err) {
        app.showToast('Validasi CSV gagal: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  async function commitImport() {
    if (!stagedSiswaImport || stagedSiswaImport.length === 0) return;
    try {
      const res = await api.commitImportSiswa(currentSelectedClassId, stagedSiswaImport);
      app.showToast(res.message || 'Impor siswa berhasil!', 'success');
      app.closeModal('modalImportSiswa');
      loadRoster(currentSelectedClassId);
      load();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  }

  return {
    load,
    openModal,
    edit,
    save,
    archive,
    openRoster,
    loadRoster,
    openAddSiswaForm,
    saveSiswa,
    deleteSiswa,
    openImportModal,
    downloadTemplate,
    handleFileSelected,
    commitImport,
    getCachedList: () => cachedKelasList
  };
})();
