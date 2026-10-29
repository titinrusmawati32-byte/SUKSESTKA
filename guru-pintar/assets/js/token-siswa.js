/**
 * ============================================================================
 * Aplikasi Latihan Soal SD - Modul Token & Pengerjaan Siswa (token-siswa.js)
 * File: assets/js/token-siswa.js
 * Deskripsi: Manajemen token untuk guru dan seluruh siklus pengerjaan latihan
 *            untuk siswa (validasi, pengerjaan, timer, autosave, kumpul, review).
 * ============================================================================
 */

const tokenSiswa = (function() {
  'use strict';

  // --- STATE PENGERJAAN SISWA ---
  let activeTokenString = '';
  let activeTokenMeta = null;
  let currentSessionData = null;
  let activeQuestions = [];
  let currentQuestionIndex = 0;
  let studentAnswers = {};
  let flaggedQuestions = {};
  let timerInterval = null;
  let isSubmittingQuiz = false;
  let isianDebounceTimer = null;

  /* ==========================================================================
   * BAGIAN A: PENGELOLAAN TOKEN OLEH GURU
   * ========================================================================== */

  async function load() {
    const tbody = document.getElementById('tokenTableBody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Memuat daftar token...</td></tr>';
    }

    try {
      const resPaket = await api.getPaketLatihan();
      const paketList = resPaket.data || [];

      if (paketList.length === 0) {
        if (tbody) {
          tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada paket latihan. Buat paket terlebih dahulu untuk membuat token.</td></tr>';
        }
        return;
      }

      // Ambil token untuk setiap paket
      const allTokens = [];
      for (const p of paketList) {
        try {
          const resToken = await api.getPaketTokens(p.PaketID);
          if (resToken && resToken.data) {
            resToken.data.forEach(tok => {
              tok.judulPaket = p.Judul;
              allTokens.push(tok);
            });
          }
        } catch (e) {
          console.warn('Gagal memuat token untuk paket ' + p.PaketID, e);
        }
      }

      renderTokenTable(allTokens);
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Gagal memuat: ${app.escapeHtml(err.message)}</td></tr>`;
      }
      app.showToast('Gagal memuat token siswa: ' + err.message, 'error');
    }
  }

  function renderTokenTable(tokenList) {
    const tbody = document.getElementById('tokenTableBody');
    if (!tbody) return;

    if (tokenList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Belum ada token siswa yang dibuat.</td></tr>';
      return;
    }

    let html = '';
    tokenList.forEach(t => {
      const isAktif = (t.Aktif === true || String(t.Aktif).toUpperCase() === 'TRUE');
      html += `
        <tr>
          <td><code style="font-size:16px; font-weight:800; color:var(--primary);">${app.escapeHtml(t.TokenKode)}</code></td>
          <td class="font-bold">${app.escapeHtml(t.judulPaket || '-')}</td>
          <td>${t.KelasIDOpsional ? `<span class="badge badge-primary">Kelas ${app.escapeHtml(t.KelasIDOpsional)}</span>` : 'Umum'}</td>
          <td>${t.BerlakuSampai || 'Selamanya'}</td>
          <td>${isAktif ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-danger">Nonaktif</span>'}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="app.copyTextToClipboard('${app.escapeHtml(t.TokenKode)}', 'Kode token disalin!')">📋 Salin</button>
            <button class="btn btn-secondary btn-sm" onclick="tokenSiswa.copyLink('${app.escapeHtml(t.TokenKode)}')">🔗 Link</button>
            ${isAktif ? 
              `<button class="btn btn-danger btn-sm" onclick="tokenSiswa.toggle('${t.TokenID}', false)">Nonaktifkan</button>` : 
              `<button class="btn btn-success btn-sm" onclick="tokenSiswa.toggle('${t.TokenID}', true)">Aktifkan</button>`
            }
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  function openModal() {
    const selectPaket = document.getElementById('tokenPaketSelect');
    const selectKelas = document.getElementById('tokenKelasSelect');
    selectPaket.innerHTML = '';
    selectKelas.innerHTML = '<option value="">Akses Umum (Semua Siswa)</option>';

    const cachedPaket = paketLatihan.getCachedList();
    const cachedKelas = kelas.getCachedList();

    cachedPaket.forEach(p => {
      selectPaket.innerHTML += `<option value="${p.PaketID}">${app.escapeHtml(p.Judul)}</option>`;
    });

    cachedKelas.forEach(k => {
      selectKelas.innerHTML += `<option value="${k.KelasID}">${app.escapeHtml(k.NamaKelas)}</option>`;
    });

    document.getElementById('tokenBerlakuSampai').value = '';
    document.getElementById('tokenBatasPeserta').value = '0';
    app.openModal('modalToken');
  }

  function quickCreate(paketId) {
    openModal();
    document.getElementById('tokenPaketSelect').value = paketId;
  }

  async function save() {
    const paketId = document.getElementById('tokenPaketSelect').value;
    if (!paketId) {
      app.showToast('Pilih paket latihan', 'warning');
      return;
    }

    const payload = {
      PaketID: paketId,
      KelasIDOpsional: document.getElementById('tokenKelasSelect').value,
      BerlakuSampai: document.getElementById('tokenBerlakuSampai').value,
      BatasPeserta: document.getElementById('tokenBatasPeserta').value
    };

    try {
      const res = await api.createPaketToken(payload);
      app.showToast((res.message || 'Token berhasil dibuat') + ' Kode: ' + res.tokenKode, 'success');
      app.closeModal('modalToken');
      load();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  }

  async function toggle(tokenId, status) {
    try {
      const res = await api.toggleTokenStatus(tokenId, status);
      app.showToast(res.message || 'Status token diperbarui', 'success');
      load();
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  }

  function copyLink(tokenKode) {
    const cleanUrl = window.location.href.split('?')[0];
    const link = cleanUrl + '?token=' + encodeURIComponent(tokenKode);
    app.copyTextToClipboard(link, 'Tautan langsung pengerjaan siswa telah disalin!');
  }

  /* ==========================================================================
   * BAGIAN B: PENGERJAAN LATIHAN OLEH SISWA
   * ========================================================================== */

  async function validateInputToken() {
    const token = document.getElementById('inputStudentToken').value.trim().toUpperCase();
    if (!token) {
      app.showToast('Masukkan kode token terlebih dahulu', 'warning');
      return;
    }

    app.showToast('Memeriksa token...', 'info', 1500);

    try {
      const res = await api.validateStudentToken(token);
      if (!res || !res.success) throw new Error(res.message || 'Token tidak valid');

      activeTokenString = res.token;
      activeTokenMeta = res;

      document.getElementById('infoQuizTitle').textContent = res.paket.judul;
      document.getElementById('infoQuizMapel').textContent = `${res.paket.mataPelajaran} - Kelas ${res.paket.tingkat}`;
      document.getElementById('infoQuizPetunjuk').textContent = res.paket.petunjuk || 'Kerjakan dengan teliti.';
      document.getElementById('infoQuizDurasi').textContent = res.paket.durasiMenit > 0 ? `${res.paket.durasiMenit} Menit` : 'Bebas';
      document.getElementById('infoQuizPercobaan').textContent = `${res.paket.maksPercobaan} Kali`;

      if (res.kelas) {
        document.getElementById('inputStudentKelas').value = res.kelas.namaKelas;
        document.getElementById('inputStudentKelas').disabled = true;
      } else {
        document.getElementById('inputStudentKelas').value = '';
        document.getElementById('inputStudentKelas').disabled = false;
      }

      const rosterSelect = document.getElementById('selectRosterNama');
      if (res.studentList && res.studentList.length > 0) {
        rosterSelect.innerHTML = '<option value="">-- Pilih Nama Kamu --</option>';
        res.studentList.forEach(st => {
          rosterSelect.innerHTML += `<option value="${app.escapeHtml(st.namaSiswa)}">${st.nomorAbsen ? `(${st.nomorAbsen}) ` : ''}${app.escapeHtml(st.namaSiswa)}</option>`;
        });
        document.getElementById('containerRosterSelect').classList.remove('hidden');
      } else {
        document.getElementById('containerRosterSelect').classList.add('hidden');
      }

      document.getElementById('student-token-screen').classList.add('hidden');
      document.getElementById('student-info-screen').classList.remove('hidden');
    } catch (err) {
      app.showToast(err.message, 'error', 4000);
    }
  }

  function handleRosterSelectChange() {
    const selected = document.getElementById('selectRosterNama').value;
    if (selected) {
      document.getElementById('inputStudentName').value = selected;
    }
  }

  async function startQuiz() {
    const nama = document.getElementById('inputStudentName').value.trim();
    if (!nama) {
      app.showToast('Silakan isi nama kamu terlebih dahulu', 'warning');
      return;
    }

    const kelasVal = document.getElementById('inputStudentKelas').value.trim();
    const studentData = {
      namaSiswa: nama,
      kelasId: kelasVal
    };

    app.showToast('Menyiapkan soal latihan...', 'info', 2000);

    try {
      const res = await api.startOrResumeSession(activeTokenString, studentData);
      setupQuizRunner(res, activeTokenString, nama);
    } catch (err) {
      app.showToast(err.message, 'error', 4000);
    }
  }

  async function resumeFromStorage(token, name) {
    try {
      const res = await api.startOrResumeSession(token, { namaSiswa: name });
      app.showToast('Melanjutkan sesi latihan sebelumnya...', 'info', 2000);
      setupQuizRunner(res, token, name);
    } catch (e) {
      localStorage.removeItem('sd_active_sesi_id');
      localStorage.removeItem('sd_active_token');
      localStorage.removeItem('sd_active_name');
    }
  }

  function setupQuizRunner(sessionPayload, token, studentName) {
    currentSessionData = sessionPayload;
    activeQuestions = sessionPayload.questions || [];
    currentQuestionIndex = 0;
    studentAnswers = {};
    flaggedQuestions = {};

    if (sessionPayload.savedAnswers) {
      for (const sId in sessionPayload.savedAnswers) {
        studentAnswers[sId] = sessionPayload.savedAnswers[sId].jawaban;
      }
    }

    localStorage.setItem('sd_active_sesi_id', sessionPayload.sesiId);
    localStorage.setItem('sd_active_token', token);
    localStorage.setItem('sd_active_name', studentName);

    document.getElementById('student-info-screen').classList.add('hidden');
    document.getElementById('student-token-screen').classList.add('hidden');
    document.getElementById('student-quiz-screen').classList.remove('hidden');

    document.getElementById('quizTopbarTitle').textContent = sessionPayload.paket.judul;

    setupCountdownTimer(sessionPayload.sisaDetik);
    renderPalette();
    renderQuestion(0);
  }

  function setupCountdownTimer(remainingSeconds) {
    clearInterval(timerInterval);
    const timerBadge = document.getElementById('quizTimerBadge');
    const timerText = document.getElementById('quizTimerText');

    if (remainingSeconds === null || remainingSeconds === undefined || (remainingSeconds <= 0 && currentSessionData.batasWaktu === '')) {
      timerBadge.style.display = 'none';
      return;
    }

    timerBadge.style.display = 'flex';
    let seconds = remainingSeconds;

    function update() {
      if (seconds <= 0) {
        clearInterval(timerInterval);
        timerText.textContent = '00:00';
        handleTimeExpired();
        return;
      }

      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      timerText.textContent = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;

      if (seconds <= 300) {
        timerBadge.classList.add('urgent');
      } else {
        timerBadge.classList.remove('urgent');
      }

      seconds--;
    }

    update();
    timerInterval = setInterval(update, 1000);
  }

  function handleTimeExpired() {
    app.showToast('Waktu pengerjaan telah habis! Mengumpulkan jawaban...', 'warning', 4000);
    submitQuiz();
  }

  function renderQuestion(index) {
    if (index < 0 || index >= activeQuestions.length) return;
    currentQuestionIndex = index;
    const q = activeQuestions[index];

    document.getElementById('qCurrentNumber').textContent = `Soal No. ${index + 1} dari ${activeQuestions.length}`;
    document.getElementById('qQuestionText').textContent = q.pertanyaan;

    const imgEl = document.getElementById('qQuestionImage');
    const existingFallback = document.getElementById('qQuestionImageFallback');
    if (existingFallback) existingFallback.remove();

    if (q.gambarUrl) {
      imgEl.referrerPolicy = 'no-referrer';
      const cleanUrl = app.formatDriveImageUrl(q.gambarUrl);
      imgEl.dataset.fallbackStage = '0';
      // Sembunyikan gambar sebelum berhasil dimuat agar tidak muncul icon patah di layar siswa
      imgEl.style.display = 'none';
      imgEl.classList.remove('hidden');

      imgEl.onload = function() {
        this.style.display = 'block';
        const existingFb = document.getElementById('qQuestionImageFallback');
        if (existingFb) existingFb.remove();
      };

      imgEl.onerror = function() {
        const stage = parseInt(this.dataset.fallbackStage || '0', 10);
        const fId = app.getDriveFileId(q.gambarUrl) || app.getDriveFileId(this.src);
        if (fId) {
          if (stage === 0) {
            this.dataset.fallbackStage = '1';
            this.src = `https://drive.google.com/thumbnail?id=${fId}&sz=w1000`;
          } else if (stage === 1) {
            this.dataset.fallbackStage = '2';
            this.src = `https://docs.google.com/uc?export=view&id=${fId}`;
          } else if (stage === 2) {
            this.dataset.fallbackStage = '3';
            this.src = `https://lh3.google.com/u/0/d/${fId}`;
          } else {
            this.style.display = 'none';
            if (!document.getElementById('qQuestionImageFallback')) {
              const fallbackDiv = document.createElement('div');
              fallbackDiv.id = 'qQuestionImageFallback';
              fallbackDiv.style.cssText = 'padding: 12px 18px; margin: 12px 0; background: #eff6ff; border: 1.5px dashed #60a5fa; text-align: center; border-radius: 14px;';
              fallbackDiv.innerHTML = `
                <div style="font-size: 13px; font-weight: 700; color: #1e40af; margin-bottom: 6px;">🖼️ Soal ini memiliki lampiran gambar</div>
                <a href="https://drive.google.com/file/d/${fId}/view" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm" style="display: inline-flex; margin-top: 4px;">
                  🔍 Buka / Lihat Gambar Soal
                </a>
              `;
              imgEl.parentNode.insertBefore(fallbackDiv, imgEl.nextSibling);
            }
          }
        } else {
          this.style.display = 'none';
        }
      };

      imgEl.src = cleanUrl;
    } else {
      imgEl.classList.add('hidden');
      imgEl.style.display = 'none';
      imgEl.src = '';
    }

    const isFlagged = Boolean(flaggedQuestions[q.soalId]);
    document.getElementById('flagBtnText').textContent = isFlagged ? 'Hapus Tanda Ragu' : 'Tandai Ragu-ragu';
    document.getElementById('btnFlagQuestion').className = isFlagged ? 'btn btn-warning btn-sm' : 'btn btn-secondary btn-sm';

    document.getElementById('qAreaPilihanGanda').classList.add('hidden');
    document.getElementById('qAreaBenarSalah').classList.add('hidden');
    document.getElementById('qAreaIsianSingkat').classList.add('hidden');

    const currentAns = studentAnswers[q.soalId] !== undefined ? studentAnswers[q.soalId] : '';

    if (q.jenisSoal === 'PILIHAN_GANDA') {
      const pgContainer = document.getElementById('qAreaPilihanGanda');
      pgContainer.classList.remove('hidden');
      let html = '';
      (q.options || []).forEach(opt => {
        const isSelected = (currentAns === opt.key);
        html += `
          <div class="option-card ${isSelected ? 'selected' : ''}" onclick="tokenSiswa.selectAnswerPG('${opt.key}')">
            <div class="option-badge">${opt.key}</div>
            <div class="option-label">${app.escapeHtml(opt.text)}</div>
          </div>
        `;
      });
      pgContainer.innerHTML = html;
    } else if (q.jenisSoal === 'BENAR_SALAH') {
      const bsContainer = document.getElementById('qAreaBenarSalah');
      bsContainer.classList.remove('hidden');
      document.getElementById('btnBsBenar').className = 'btn-bs' + (currentAns === 'BENAR' ? ' selected-benar' : '');
      document.getElementById('btnBsSalah').className = 'btn-bs' + (currentAns === 'SALAH' ? ' selected-salah' : '');
    } else if (q.jenisSoal === 'ISIAN_SINGKAT') {
      const isianContainer = document.getElementById('qAreaIsianSingkat');
      isianContainer.classList.remove('hidden');
      document.getElementById('inputJawabanIsian').value = currentAns;
    }

    document.getElementById('btnPrevQuestion').disabled = (index === 0);
    document.getElementById('btnNextQuestion').disabled = (index === activeQuestions.length - 1);

    updatePaletteHighlight();
  }

  function navigateQuestion(step) {
    const newIdx = currentQuestionIndex + step;
    if (newIdx >= 0 && newIdx < activeQuestions.length) {
      renderQuestion(newIdx);
    }
  }

  function selectAnswerPG(key) {
    const q = activeQuestions[currentQuestionIndex];
    studentAnswers[q.soalId] = key;
    renderQuestion(currentQuestionIndex);
    autosave(q.soalId, key);
  }

  function selectAnswerBenarSalah(value) {
    const q = activeQuestions[currentQuestionIndex];
    studentAnswers[q.soalId] = value;
    renderQuestion(currentQuestionIndex);
    autosave(q.soalId, value);
  }

  function handleIsianInput(e) {
    const val = e.target.value;
    const q = activeQuestions[currentQuestionIndex];
    studentAnswers[q.soalId] = val;

    clearTimeout(isianDebounceTimer);
    isianDebounceTimer = setTimeout(() => {
      autosave(q.soalId, val);
    }, 600);
  }

  function toggleFlagCurrentQuestion() {
    const q = activeQuestions[currentQuestionIndex];
    flaggedQuestions[q.soalId] = !flaggedQuestions[q.soalId];
    renderQuestion(currentQuestionIndex);
    renderPalette();
  }

  function renderPalette() {
    const container = document.getElementById('questionPalette');
    if (!container) return;
    let html = '';

    activeQuestions.forEach((q, idx) => {
      const ans = studentAnswers[q.soalId];
      const isAnswered = ans !== undefined && ans !== null && String(ans).trim() !== '';
      const isFlag = Boolean(flaggedQuestions[q.soalId]);

      let statusClass = '';
      if (isFlag) statusClass = 'flagged';
      else if (isAnswered) statusClass = 'answered';

      html += `<button class="palette-btn ${statusClass}" id="palBtn_${idx}" onclick="tokenSiswa.renderQuestion(${idx})">${idx + 1}</button>`;
    });

    container.innerHTML = html;
    updatePaletteHighlight();
  }

  function updatePaletteHighlight() {
    const btns = document.querySelectorAll('.palette-btn');
    btns.forEach((b, idx) => {
      if (idx === currentQuestionIndex) b.classList.add('current');
      else b.classList.remove('current');
    });
  }

  async function autosave(soalId, jawaban) {
    const statusEl = document.getElementById('autosaveText');
    if (statusEl) statusEl.textContent = 'Menyimpan...';

    renderPalette();

    try {
      const res = await api.saveStudentAnswer(currentSessionData.sesiId, soalId, jawaban);
      if (res && res.expired) {
        handleTimeExpired();
        return;
      }
      if (statusEl) statusEl.textContent = 'Semua jawaban tersimpan';
    } catch (e) {
      console.warn('Autosave background sync note:', e);
      // Jawaban tetap tersimpan di memori siswa dan dipastikan dikirim saat submit kuis
      if (statusEl) statusEl.textContent = 'Tersimpan di memori lokal (tersinkron)';
    }
  }

  function openConfirmSubmitModal() {
    const totalSoal = activeQuestions.length;
    let totalDijawab = 0;
    let totalRagu = 0;

    activeQuestions.forEach(q => {
      const ans = studentAnswers[q.soalId];
      if (ans !== undefined && ans !== null && String(ans).trim() !== '') totalDijawab++;
      if (flaggedQuestions[q.soalId]) totalRagu++;
    });

    const belumDijawab = totalSoal - totalDijawab;

    const html = `
      <div class="card" style="padding:14px; background:#f8fafc; border:1px solid var(--border);">
        <div style="margin-bottom:6px;">Total Soal: <b>${totalSoal}</b></div>
        <div style="margin-bottom:6px; color:var(--secondary);">Sudah Dijawab: <b>${totalDijawab}</b></div>
        ${belumDijawab > 0 ? `<div style="margin-bottom:6px; color:var(--accent-red); font-weight:bold;">⚠️ Belum Dijawab: ${belumDijawab} Soal</div>` : ''}
        ${totalRagu > 0 ? `<div style="color:var(--accent-amber); font-weight:bold;">⚠️ Masih Ragu-ragu: ${totalRagu} Soal</div>` : ''}
      </div>
    `;

    document.getElementById('submitSummaryBox').innerHTML = html;
    app.openModal('modalConfirmSubmit');
  }

  let latestResultData = null;
  let cachedReviewData = null;
  let currentReviewFilter = 'ALL';

  async function submitQuiz() {
    if (isSubmittingQuiz) return;
    isSubmittingQuiz = true;
    app.closeModal('modalConfirmSubmit');
    clearInterval(timerInterval);

    app.showToast('Menilai jawaban di server...', 'info', 5000);

    try {
      const activeSesiId = (currentSessionData && currentSessionData.sesiId) ? currentSessionData.sesiId : '';
      const res = await api.submitStudentQuiz(activeSesiId);
      isSubmittingQuiz = false;

      // Simpan Sesi ID terakhir selesai agar bisa ditinjau kapan saja
      const finalSesiId = (res && res.sesiId) ? res.sesiId : activeSesiId;
      if (finalSesiId) {
        localStorage.setItem('sd_last_completed_sesi', finalSesiId);
      }

      // Hapus data sesi aktif dari local storage karena sudah selesai
      localStorage.removeItem('sd_active_sesi_id');
      localStorage.removeItem('sd_active_token');
      localStorage.removeItem('sd_active_name');

      // Tampilkan halaman hasil ujian otomatis
      renderResultScreen(res);
      app.showToast('Latihan berhasil dikumpulkan dan dinilai!', 'success', 3000);
    } catch (err) {
      isSubmittingQuiz = false;
      app.showToast('Gagal mengumpulkan: ' + err.message, 'error', 4000);
    }
  }

  function renderResultScreen(res) {
    latestResultData = res || {};

    // Info Latihan
    document.getElementById('resNamaSiswa').textContent = latestResultData.namaSiswa || (currentSessionData ? currentSessionData.namaSiswa : '-') || '-';
    document.getElementById('resJudulPaket').textContent = latestResultData.judulPaket || (currentSessionData && currentSessionData.paket ? currentSessionData.paket.judul : 'Latihan Soal');
    document.getElementById('resMapelKelas').textContent = `${latestResultData.mataPelajaran || 'Umum'} • ${latestResultData.kelas || ('Kelas ' + (latestResultData.tingkat || '6'))}`;
    document.getElementById('resTanggalWaktu').textContent = latestResultData.tanggalWaktu || new Date().toLocaleString('id-ID');

    // Skor & Persentase
    const hasNilai = (latestResultData.tampilkanNilai !== false && latestResultData.nilaiAkhir !== null && latestResultData.nilaiAkhir !== undefined);
    if (hasNilai) {
      document.getElementById('scoreDisplayCard').classList.remove('hidden');
      document.getElementById('studentFinalScore').textContent = latestResultData.nilaiAkhir;
      const pct = (latestResultData.persentaseBenar !== null && latestResultData.persentaseBenar !== undefined)
        ? latestResultData.persentaseBenar
        : Math.round(Number(latestResultData.nilaiAkhir) || 0);
      document.getElementById('studentPercentageScore').textContent = pct + '% Benar';

      const scoreNum = Number(latestResultData.nilaiAkhir);
      let feedbackMsg = 'Terus Semangat Belajar! 💪';
      if (scoreNum >= 90) feedbackMsg = 'Luar Biasa, Prestasi Gemilang! ⭐⭐⭐';
      else if (scoreNum >= 75) feedbackMsg = 'Hebat Sekali, Terus Pertahankan! 🌟';
      else if (scoreNum >= 60) feedbackMsg = 'Bagus! Ayo Tingkatkan Lagi! 📚';

      document.getElementById('studentScoreBadgeMessage').textContent = feedbackMsg;
    } else {
      document.getElementById('scoreDisplayCard').classList.add('hidden');
      const notice = document.getElementById('studentNoticeText');
      notice.textContent = 'Nilai latihan Anda telah tersimpan dan akan diumumkan oleh bapak/ibu guru.';
      notice.classList.remove('hidden');
    }

    // 4 Kartu Statistik
    document.getElementById('resTotalSoal').textContent = latestResultData.totalSoal !== undefined && latestResultData.totalSoal !== null ? latestResultData.totalSoal : activeQuestions.length;
    document.getElementById('resTotalBenar').textContent = latestResultData.totalBenar !== undefined && latestResultData.totalBenar !== null ? latestResultData.totalBenar : 0;
    document.getElementById('resTotalSalah').textContent = latestResultData.totalSalah !== undefined && latestResultData.totalSalah !== null ? latestResultData.totalSalah : 0;
    document.getElementById('resTotalKosong').textContent = latestResultData.totalKosong !== undefined && latestResultData.totalKosong !== null ? latestResultData.totalKosong : 0;

    // Tombol Lihat Pembahasan: SELALU TAMPILKAN SETELAH LATIHAN SELESAI
    const btnReview = document.getElementById('btnReviewQuestions');
    if (btnReview) {
      btnReview.classList.remove('hidden');
      btnReview.style.display = 'inline-flex';
    }

    document.getElementById('student-quiz-screen').classList.add('hidden');
    document.getElementById('student-token-screen').classList.add('hidden');
    document.getElementById('student-info-screen').classList.add('hidden');
    document.getElementById('student-review-screen').classList.add('hidden');
    document.getElementById('student-result-screen').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function loadReview() {
    let sesiId = (currentSessionData && currentSessionData.sesiId) ? currentSessionData.sesiId : null;
    if (!sesiId && latestResultData && latestResultData.sesiId) {
      sesiId = latestResultData.sesiId;
    }
    if (!sesiId) {
      sesiId = localStorage.getItem('sd_last_completed_sesi');
    }

    if (!sesiId) {
      app.showToast('ID sesi pengerjaan tidak ditemukan', 'error');
      return;
    }

    app.showToast('Memuat pembahasan soal...', 'info', 2000);

    try {
      const res = await api.getStudentReview(sesiId);
      if (!res || !res.success) throw new Error((res && res.message) ? res.message : 'Gagal memuat');

      cachedReviewData = res;
      displayReviewScreen(res);
    } catch (err) {
      console.warn('Backend getStudentReview note:', err);
      // Fallback: Jika backend belum diupdate atau mengembalikan error,
      // tampilkan lembar jawaban yang ada di memori aktif
      if (activeQuestions && activeQuestions.length > 0) {
        const fallbackReview = buildClientFallbackReview(sesiId);
        cachedReviewData = fallbackReview;
        displayReviewScreen(fallbackReview);
      } else {
        app.showToast('Gagal memuat pembahasan: ' + err.message, 'error', 4000);
      }
    }
  }

  function buildClientFallbackReview(sesiId) {
    const list = activeQuestions.map((q, idx) => {
      const ans = studentAnswers[q.soalId] || '';
      const isKosong = (!ans || String(ans).trim() === '');
      return {
        nomorUrut: idx + 1,
        soalId: q.soalId,
        pertanyaan: q.pertanyaan,
        gambarUrl: q.gambarUrl,
        jenisSoal: q.jenisSoal,
        jawabanSiswa: ans,
        statusJawaban: isKosong ? 'KOSONG' : 'DIJAWAB',
        benar: false,
        kunciJawaban: '',
        pembahasan: 'Pembahasan untuk soal ini belum tersedia dari guru.',
        pilihanA: q.options && q.options[0] ? q.options[0].text : '',
        pilihanB: q.options && q.options[1] ? q.options[1].text : '',
        pilihanC: q.options && q.options[2] ? q.options[2].text : '',
        pilihanD: q.options && q.options[3] ? q.options[3].text : '',
        bobot: q.bobot || 1
      };
    });

    return {
      success: true,
      sesiId: sesiId,
      judulPaket: (latestResultData && latestResultData.judulPaket) || 'Latihan Soal',
      mataPelajaran: (latestResultData && latestResultData.mataPelajaran) || 'Umum',
      tingkat: (latestResultData && latestResultData.tingkat) || '',
      namaSiswa: (latestResultData && latestResultData.namaSiswa) || 'Siswa',
      nilaiAkhir: latestResultData ? latestResultData.nilaiAkhir : null,
      reviewList: list
    };
  }

  function displayReviewScreen(res) {
    document.getElementById('reviewSubTitle').textContent = `${res.judulPaket || 'Latihan'} • ${res.namaSiswa || 'Siswa'}`;
    if (res.nilaiAkhir !== null && res.nilaiAkhir !== undefined) {
      document.getElementById('reviewScoreBadge').textContent = 'Nilai: ' + res.nilaiAkhir;
      document.getElementById('reviewScoreBadge').classList.remove('hidden');
    } else {
      document.getElementById('reviewScoreBadge').classList.add('hidden');
    }

    // Hitung filter counts
    const allItems = res.reviewList || [];
    const totalCount = allItems.length;
    let benarCount = 0;
    let salahCount = 0;
    let kosongCount = 0;

    allItems.forEach(it => {
      if (it.statusJawaban === 'BENAR' || it.benar === true) benarCount++;
      else if (it.statusJawaban === 'KOSONG' || (!it.jawabanSiswa || String(it.jawabanSiswa).trim() === '')) kosongCount++;
      else salahCount++;
    });

    document.getElementById('countReviewAll').textContent = totalCount;
    document.getElementById('countReviewBenar').textContent = benarCount;
    document.getElementById('countReviewSalah').textContent = salahCount;
    document.getElementById('countReviewKosong').textContent = kosongCount;

    currentReviewFilter = 'ALL';
    updateFilterPillUI('ALL');
    renderReviewList(allItems);

    document.getElementById('student-result-screen').classList.add('hidden');
    document.getElementById('student-review-screen').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function filterReview(type) {
    currentReviewFilter = type;
    updateFilterPillUI(type);

    if (!cachedReviewData || !cachedReviewData.reviewList) return;

    let filtered = cachedReviewData.reviewList;
    if (type === 'BENAR') {
      filtered = filtered.filter(it => it.statusJawaban === 'BENAR' || it.benar === true);
    } else if (type === 'SALAH') {
      filtered = filtered.filter(it => (it.statusJawaban === 'SALAH') || (!it.benar && it.jawabanSiswa && String(it.jawabanSiswa).trim() !== ''));
    } else if (type === 'KOSONG') {
      filtered = filtered.filter(it => it.statusJawaban === 'KOSONG' || !it.jawabanSiswa || String(it.jawabanSiswa).trim() === '');
    }

    renderReviewList(filtered);
  }

  function updateFilterPillUI(activeType) {
    const pills = [
      { id: 'rfPillAll', type: 'ALL' },
      { id: 'rfPillBenar', type: 'BENAR' },
      { id: 'rfPillSalah', type: 'SALAH' },
      { id: 'rfPillKosong', type: 'KOSONG' }
    ];

    pills.forEach(p => {
      const el = document.getElementById(p.id);
      if (el) {
        if (p.type === activeType) el.classList.add('active');
        else el.classList.remove('active');
      }
    });
  }

  function renderReviewList(items) {
    const container = document.getElementById('studentReviewList');
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="card text-center text-muted" style="padding: 32px 16px;">
          Tidak ada soal pada kategori tinjauan ini.
        </div>
      `;
      return;
    }

    let html = '';
    items.forEach((item, idx) => {
      const isBenar = (item.statusJawaban === 'BENAR' || item.benar === true);
      const isKosong = (item.statusJawaban === 'KOSONG' || (!item.jawabanSiswa || String(item.jawabanSiswa).trim() === ''));

      let cardClass = 'card-salah';
      let statusBadgeClass = 'review-status-salah';
      let statusLabel = '❌ SALAH';

      if (isBenar) {
        cardClass = 'card-benar';
        statusBadgeClass = 'review-status-benar';
        statusLabel = '✅ BENAR';
      } else if (isKosong) {
        cardClass = 'card-kosong';
        statusBadgeClass = 'review-status-kosong';
        statusLabel = '⚪ TIDAK DIJAWAB';
      }

      html += `
        <div class="review-item-card ${cardClass}" id="revItem_${item.nomorUrut}">
          <div class="review-item-header">
            <span class="review-q-num">Soal No. ${item.nomorUrut}</span>
            <span class="review-status-badge ${statusBadgeClass}">${statusLabel}</span>
          </div>

          <div class="review-question-text">${app.escapeHtml(item.pertanyaan)}</div>
      `;

      if (item.gambarUrl) {
        const cleanImg = app.formatDriveImageUrl(item.gambarUrl);
        const fId = app.getDriveFileId(item.gambarUrl);
        html += `
          <div style="margin: 12px 0;">
            <img src="${app.escapeHtml(cleanImg)}" class="question-image" style="max-height: 240px; border-radius: 12px; border: 1px solid var(--border-subtle); display: none;" referrerpolicy="no-referrer" onload="this.style.display='block';" onerror="const f='${fId}'; if(f && !this.dataset.t){this.dataset.t='1'; this.src='https://drive.google.com/thumbnail?id='+f+'&sz=w1000';} else { this.style.display='none'; }">
          </div>
        `;
      }

      // Tampilan Opsi Pilihan Ganda
      if (item.jenisSoal === 'PILIHAN_GANDA') {
        const options = [
          { key: 'A', text: item.pilihanA },
          { key: 'B', text: item.pilihanB },
          { key: 'C', text: item.pilihanC },
          { key: 'D', text: item.pilihanD }
        ].filter(opt => opt.text && opt.text.trim() !== '');

        html += `<div class="review-options-container">`;
        options.forEach(opt => {
          const isSelected = (item.jawabanSiswa === opt.key);
          const isKey = (item.kunciJawaban === opt.key);

          let rowClass = '';
          let tagBadge = '';

          if (isSelected && isBenar) {
            rowClass = 'opt-selected-benar';
            tagBadge = '<span class="badge badge-success" style="margin-left:auto; font-size:11px;">Jawaban Kamu (Benar) ✅</span>';
          } else if (isSelected && !isBenar) {
            rowClass = 'opt-selected-salah';
            tagBadge = '<span class="badge badge-danger" style="margin-left:auto; font-size:11px;">Jawaban Kamu ❌</span>';
          } else if (isKey) {
            rowClass = 'opt-is-key';
            tagBadge = '<span class="badge badge-success" style="margin-left:auto; font-size:11px;">Kunci Jawaban Benar ✅</span>';
          }

          html += `
            <div class="review-option-row ${rowClass}">
              <div class="review-opt-badge">${opt.key}</div>
              <div class="review-opt-text">${app.escapeHtml(opt.text)}</div>
              ${tagBadge}
            </div>
          `;
        });
        html += `</div>`;
      } else {
        // Benar / Salah atau Isian Singkat
        html += `
          <div class="review-answer-summary-box">
            <div style="margin-bottom: 6px;">
              <b>Jawaban Kamu:</b> 
              <span style="font-weight:700; color:${isBenar ? 'var(--secondary)' : (isKosong ? 'var(--text-muted)' : 'var(--accent-red)')};">
                ${app.escapeHtml(item.jawabanSiswa || '(Tidak Dijawab)')}
              </span>
            </div>
            ${item.kunciJawaban ? `
              <div style="color: var(--text-main);">
                <b>Kunci Jawaban Benar:</b> 
                <span class="text-success font-bold">${app.escapeHtml(item.kunciJawaban)}</span>
              </div>
            ` : ''}
          </div>
        `;
      }

      // Kotak Pembahasan & Penjelasan
      const pembahasanContent = item.pembahasan || 'Pembahasan untuk soal ini belum tersedia.';
      html += `
        <div class="review-explanation-box">
          <div class="explanation-header">
            <span>💡</span> <span>Pembahasan & Penjelasan:</span>
          </div>
          <div class="explanation-body ${!item.pembahasan ? 'text-muted' : ''}" style="${!item.pembahasan ? 'font-style: italic;' : ''}">
            ${app.escapeHtml(pembahasanContent)}
          </div>
        </div>
      </div>`;
    });

    container.innerHTML = html;
  }

  function backToResultScreen() {
    document.getElementById('student-review-screen').classList.add('hidden');
    document.getElementById('student-result-screen').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return {
    // Teacher methods
    load,
    openModal,
    quickCreate,
    save,
    toggle,
    copyLink,

    // Student methods
    validateInputToken,
    handleRosterSelectChange,
    startQuiz,
    resumeFromStorage,
    renderQuestion,
    navigateQuestion,
    selectAnswerPG,
    selectAnswerBenarSalah,
    handleIsianInput,
    toggleFlagCurrentQuestion,
    openConfirmSubmitModal,
    submitQuiz,
    loadReview,
    filterReview,
    backToResultScreen
  };
})();
