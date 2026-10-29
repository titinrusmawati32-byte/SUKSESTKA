/**
 * ============================================================================
 * Aplikasi Latihan Soal SD - Modul Bank Soal (bank-soal.js)
 * File: assets/js/bank-soal.js
 * Deskripsi: CRUD Bank Soal, upload gambar base64 ke Google Drive,
 *            pratinjau soal siswa, dan impor massal via CSV.
 * ============================================================================
 */

const bankSoal = (function() {
  'use strict';

  let cachedSoalList = [];
  let stagedSoalImport = null;
  let currentImageBase64 = null;
  let currentImageName = null;

  async function load() {
    const tbody = document.getElementById('bankSoalTableBody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Memuat bank soal...</td></tr>';
    }

    const filters = {
      MataPelajaran: document.getElementById('bankFilterMapel')?.value || '',
      JenisSoal: document.getElementById('bankFilterJenis')?.value || '',
      search: document.getElementById('bankSearch')?.value || ''
    };

    try {
      const res = await api.getBankSoal(filters);
      cachedSoalList = res.data || [];
      renderTable(cachedSoalList);
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-danger text-center">Gagal memuat: ${app.escapeHtml(err.message)}</td></tr>`;
      }
      app.showToast('Gagal memuat bank soal: ' + err.message, 'error');
    }
  }

  function filter() {
    load();
  }

  function renderTable(list) {
    const tbody = document.getElementById('bankSoalTableBody');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Belum ada soal yang sesuai dengan filter.</td></tr>';
      return;
    }

    let html = '';
    list.forEach((s, idx) => {
      let badgeClass = 'badge-primary';
      let jenisLabel = 'Pilihan Ganda';
      if (s.JenisSoal === 'BENAR_SALAH') { badgeClass = 'badge-warning'; jenisLabel = 'Benar/Salah'; }
      else if (s.JenisSoal === 'ISIAN_SINGKAT') { badgeClass = 'badge-secondary'; jenisLabel = 'Isian'; }

      html += `
        <tr>
          <td>${idx + 1}</td>
          <td style="max-width:300px;">
            <div class="font-bold" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${app.escapeHtml(s.Pertanyaan)}</div>
            <small class="text-muted">${app.escapeHtml(s.Topik || '-')}</small>
          </td>
          <td>${app.escapeHtml(s.MataPelajaran)} / Kls ${app.escapeHtml(s.Tingkat)}</td>
          <td><span class="badge ${badgeClass}">${jenisLabel}</span></td>
          <td><span class="badge badge-success">${app.escapeHtml(s.KunciJawaban)}</span></td>
          <td>${s.GambarURL ? '🖼️ Ya' : '-'}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="bankSoal.preview('${s.SoalID}')" title="Pratinjau">👁️</button>
            <button class="btn btn-secondary btn-sm" onclick="bankSoal.edit('${s.SoalID}')" title="Edit">✏️</button>
            <button class="btn btn-secondary btn-sm" onclick="bankSoal.duplicate('${s.SoalID}')" title="Duplikasi">📋</button>
            <button class="btn btn-danger btn-sm" onclick="bankSoal.archive('${s.SoalID}')" title="Arsip">🗑️</button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  function handleJenisSoalChange() {
    const jenis = document.getElementById('soalJenisInput').value;
    document.getElementById('containerPilihanGanda').classList.add('hidden');
    document.getElementById('containerBenarSalah').classList.add('hidden');
    document.getElementById('containerIsianSingkat').classList.add('hidden');

    if (jenis === 'PILIHAN_GANDA') {
      document.getElementById('containerPilihanGanda').classList.remove('hidden');
    } else if (jenis === 'BENAR_SALAH') {
      document.getElementById('containerBenarSalah').classList.remove('hidden');
    } else if (jenis === 'ISIAN_SINGKAT') {
      document.getElementById('containerIsianSingkat').classList.remove('hidden');
    }
  }

  function handleImageSelected(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      app.showToast('Ukuran gambar maksimal 3MB', 'warning');
      e.target.value = '';
      return;
    }

    currentImageName = file.name;
    const reader = new FileReader();
    reader.onload = function(evt) {
      currentImageBase64 = evt.target.result;
      document.getElementById('soalImagePreview').src = currentImageBase64;
      document.getElementById('soalImagePreviewContainer').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  function removeImage() {
    currentImageBase64 = null;
    currentImageName = null;
    document.getElementById('soalImageFileInput').value = '';
    document.getElementById('soalImagePreview').src = '';
    document.getElementById('soalImagePreviewContainer').classList.add('hidden');
  }

  function openModal() {
    document.getElementById('soalIdInput').value = '';
    document.getElementById('soalPertanyaanInput').value = '';
    document.getElementById('soalTopikInput').value = '';
    document.getElementById('soalPilA').value = '';
    document.getElementById('soalPilB').value = '';
    document.getElementById('soalPilC').value = '';
    document.getElementById('soalPilD').value = '';
    document.getElementById('soalKunciPG').value = 'A';
    document.getElementById('soalKunciBS').value = 'BENAR';
    document.getElementById('soalKunciIsian').value = '';
    document.getElementById('soalBobotInput').value = '1';
    document.getElementById('soalPembahasanInput').value = '';
    document.getElementById('modalSoalTitle').textContent = 'Tambah Soal Baru';
    removeImage();
    document.getElementById('soalJenisInput').value = 'PILIHAN_GANDA';
    handleJenisSoalChange();
    app.openModal('modalSoal');
  }

  function edit(soalId) {
    const s = cachedSoalList.find(item => item.SoalID === soalId);
    if (!s) return;

    document.getElementById('soalIdInput').value = s.SoalID;
    document.getElementById('soalMapelInput').value = s.MataPelajaran || 'Umum';
    document.getElementById('soalTingkatInput').value = s.Tingkat || '6';
    document.getElementById('soalTopikInput').value = s.Topik || '';
    document.getElementById('soalJenisInput').value = s.JenisSoal || 'PILIHAN_GANDA';
    document.getElementById('soalPertanyaanInput').value = s.Pertanyaan || '';
    document.getElementById('soalPilA').value = s.PilihanA || '';
    document.getElementById('soalPilB').value = s.PilihanB || '';
    document.getElementById('soalPilC').value = s.PilihanC || '';
    document.getElementById('soalPilD').value = s.PilihanD || '';
    document.getElementById('soalBobotInput').value = s.Bobot || 1;
    document.getElementById('soalPembahasanInput').value = s.Pembahasan || '';

    handleJenisSoalChange();

    if (s.JenisSoal === 'PILIHAN_GANDA') {
      document.getElementById('soalKunciPG').value = s.KunciJawaban || 'A';
    } else if (s.JenisSoal === 'BENAR_SALAH') {
      document.getElementById('soalKunciBS').value = s.KunciJawaban || 'BENAR';
    } else if (s.JenisSoal === 'ISIAN_SINGKAT') {
      document.getElementById('soalKunciIsian').value = s.KunciJawaban || '';
    }

    if (s.GambarURL) {
      const imgPreview = document.getElementById('soalImagePreview');
      imgPreview.referrerPolicy = 'no-referrer';
      imgPreview.src = app.formatDriveImageUrl(s.GambarURL);
      document.getElementById('soalImagePreviewContainer').classList.remove('hidden');
    } else {
      removeImage();
    }

    document.getElementById('modalSoalTitle').textContent = 'Edit Soal';
    app.openModal('modalSoal');
  }

  async function save() {
    const pertanyaan = document.getElementById('soalPertanyaanInput').value.trim();
    if (!pertanyaan) {
      app.showToast('Pertanyaan soal wajib diisi', 'warning');
      return;
    }

    const jenis = document.getElementById('soalJenisInput').value;
    let kunci = '';

    if (jenis === 'PILIHAN_GANDA') {
      kunci = document.getElementById('soalKunciPG').value;
      if (!document.getElementById('soalPilA').value.trim() || !document.getElementById('soalPilB').value.trim()) {
        app.showToast('Minimal pilihan A dan B wajib diisi', 'warning');
        return;
      }
    } else if (jenis === 'BENAR_SALAH') {
      kunci = document.getElementById('soalKunciBS').value;
    } else if (jenis === 'ISIAN_SINGKAT') {
      kunci = document.getElementById('soalKunciIsian').value.trim();
      if (!kunci) {
        app.showToast('Kunci jawaban isian singkat wajib diisi', 'warning');
        return;
      }
    }

    const payload = {
      SoalID: document.getElementById('soalIdInput').value,
      MataPelajaran: document.getElementById('soalMapelInput').value,
      Tingkat: document.getElementById('soalTingkatInput').value,
      Topik: document.getElementById('soalTopikInput').value.trim(),
      JenisSoal: jenis,
      Pertanyaan: pertanyaan,
      PilihanA: document.getElementById('soalPilA').value.trim(),
      PilihanB: document.getElementById('soalPilB').value.trim(),
      PilihanC: document.getElementById('soalPilC').value.trim(),
      PilihanD: document.getElementById('soalPilD').value.trim(),
      KunciJawaban: kunci,
      Bobot: document.getElementById('soalBobotInput').value,
      Pembahasan: document.getElementById('soalPembahasanInput').value.trim(),
      imageBase64: currentImageBase64,
      imageFileName: currentImageName
    };

    try {
      const res = await api.saveSoal(payload);
      app.showToast(res.message || 'Soal berhasil disimpan', 'success');
      app.closeModal('modalSoal');
      load();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  }

  async function duplicate(soalId) {
    try {
      const res = await api.duplicateSoal(soalId);
      app.showToast(res.message || 'Soal berhasil diduplikasi', 'success');
      load();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  }

  function archive(soalId) {
    app.showConfirmModal('Arsipkan Soal', 'Apakah Anda yakin ingin mengarsipkan soal ini?', async function() {
      try {
        const res = await api.archiveSoal(soalId);
        app.showToast(res.message || 'Soal berhasil diarsipkan', 'success');
        load();
      } catch (err) {
        app.showToast(err.message, 'error');
      }
    });
  }

  function preview(soalId) {
    const s = cachedSoalList.find(item => item.SoalID === soalId);
    if (!s) return;

    const container = document.getElementById('previewSoalBody');
    let html = `
      <div class="question-container" style="box-shadow:none; border:1px solid var(--border);">
        <div class="question-header">
          <span class="badge badge-primary">${app.escapeHtml(s.MataPelajaran)} - Kelas ${app.escapeHtml(s.Tingkat)}</span>
          <span class="text-muted" style="font-size:13px;">Bobot: ${app.escapeHtml(s.Bobot)}</span>
        </div>
        <div class="question-text">${app.escapeHtml(s.Pertanyaan)}</div>
    `;

    if (s.GambarURL) {
      const imgUrl = app.formatDriveImageUrl(s.GambarURL);
      const fId = app.getDriveFileId(s.GambarURL);
      html += `<img src="${app.escapeHtml(imgUrl)}" class="question-image" referrerpolicy="no-referrer" onerror="const f='${fId}'; if(f && !this.dataset.t){this.dataset.t='1'; this.src='https://drive.google.com/thumbnail?id='+f+'&sz=w1000';}">`;
    }

    if (s.JenisSoal === 'PILIHAN_GANDA') {
      html += `
        <div class="options-grid">
          <div class="option-card"><div class="option-badge">A</div><div class="option-label">${app.escapeHtml(s.PilihanA || '-')}</div></div>
          <div class="option-card"><div class="option-badge">B</div><div class="option-label">${app.escapeHtml(s.PilihanB || '-')}</div></div>
          ${s.PilihanC ? `<div class="option-card"><div class="option-badge">C</div><div class="option-label">${app.escapeHtml(s.PilihanC)}</div></div>` : ''}
          ${s.PilihanD ? `<div class="option-card"><div class="option-badge">D</div><div class="option-label">${app.escapeHtml(s.PilihanD)}</div></div>` : ''}
        </div>
      `;
    } else if (s.JenisSoal === 'BENAR_SALAH') {
      html += `
        <div class="bs-container">
          <div class="btn-bs">BENAR</div>
          <div class="btn-bs">SALAH</div>
        </div>
      `;
    } else if (s.JenisSoal === 'ISIAN_SINGKAT') {
      html += `<input type="text" class="form-control" placeholder="Tulis jawaban..." disabled>`;
    }

    html += `
        <div style="margin-top:20px; padding-top:12px; border-top:1px dashed var(--border);">
          <p><b>Kunci Jawaban:</b> <span class="badge badge-success">${app.escapeHtml(s.KunciJawaban)}</span></p>
          ${s.Pembahasan ? `<p style="margin-top:6px; font-size:13px; color:var(--text-muted);"><b>Pembahasan:</b> ${app.escapeHtml(s.Pembahasan)}</p>` : ''}
        </div>
      </div>
    `;

    container.innerHTML = html;
    app.openModal('modalPreviewSoal');
  }

  // --- Impor Soal CSV ---
  function openImportModal() {
    document.getElementById('soalCsvFileInput').value = '';
    document.getElementById('soalImportPreviewArea').classList.add('hidden');
    document.getElementById('btnCommitImportSoal').disabled = true;
    stagedSoalImport = null;
    app.openModal('modalImportSoal');
  }

  async function downloadTemplate() {
    try {
      const res = await api.getTemplateSoalCsv();
      app.downloadCsvFile(res.csvContent, 'template_bank_soal.csv');
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
        const res = await api.previewImportSoal(content);
        stagedSoalImport = res.validRowsPayload;

        document.getElementById('soalImportPreviewArea').classList.remove('hidden');
        document.getElementById('soalImportSummary').innerHTML =
          `Total Baris: <b>${res.totalBaris}</b> | Valid: <b class="text-success">${res.jumlahValid}</b> | Bermasalah: <b class="text-danger">${res.jumlahGagal}</b>`;

        const tbody = document.getElementById('soalImportPreviewRows');
        let rowsHtml = '';
        (res.previewData || []).forEach(item => {
          rowsHtml += `
            <tr>
              <td>${app.escapeHtml(item.MataPelajaran)}</td>
              <td>${app.escapeHtml(item.JenisSoal)}</td>
              <td>${app.escapeHtml(item.Pertanyaan.substring(0, 40))}...</td>
              <td>${app.escapeHtml(item.KunciJawaban)}</td>
            </tr>
          `;
        });
        tbody.innerHTML = rowsHtml;

        const errBox = document.getElementById('soalImportErrorArea');
        if (res.errors && res.errors.length > 0) {
          const errList = res.errors.map(err => `Baris ${err.baris}: ${app.escapeHtml(err.alasan)}`).join('<br>');
          errBox.innerHTML = `<b>Baris Bermasalah:</b><br>${errList}`;
        } else {
          errBox.innerHTML = '';
        }

        document.getElementById('btnCommitImportSoal').disabled = (res.jumlahValid === 0);
      } catch (err) {
        app.showToast('Validasi CSV gagal: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  async function commitImport() {
    if (!stagedSoalImport || stagedSoalImport.length === 0) return;
    try {
      const res = await api.commitImportSoal(stagedSoalImport);
      app.showToast(res.message || 'Soal berhasil diimpor ke Bank Soal!', 'success');
      app.closeModal('modalImportSoal');
      load();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  }

  return {
    load,
    filter,
    openModal,
    edit,
    save,
    duplicate,
    archive,
    preview,
    handleJenisSoalChange,
    handleImageSelected,
    removeImage,
    openImportModal,
    downloadTemplate,
    handleFileSelected,
    commitImport,
    getCachedList: () => cachedSoalList
  };
})();
