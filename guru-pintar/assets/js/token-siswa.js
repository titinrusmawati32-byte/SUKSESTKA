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
      imgEl.style.display = 'block';
      imgEl.src = cleanUrl;
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
      };
      imgEl.classList.remove('hidden');
    } else {
      imgEl.classList.add('hidden');
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
      if (statusEl) statusEl.textContent = 'Gagal menyimpan otomatis (akan dicoba lagi)';
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

  async function submitQuiz() {
    if (isSubmittingQuiz) return;
    isSubmittingQuiz = true;
    app.closeModal('modalConfirmSubmit');
    clearInterval(timerInterval);

    app.showToast('Menilai jawaban di server...', 'info', 5000);

    try {
      const res = await api.submitStudentQuiz(currentSessionData.sesiId);
      isSubmittingQuiz = false;

      localStorage.removeItem('sd_active_sesi_id');
      localStorage.removeItem('sd_active_token');
      localStorage.removeItem('sd_active_name');

      document.getElementById('student-quiz-screen').classList.add('hidden');
      document.getElementById('student-result-screen').classList.remove('hidden');

      if (res.tampilkanNilai && res.nilaiAkhir !== null) {
        document.getElementById('scoreDisplayCard').classList.remove('hidden');
        document.getElementById('studentFinalScore').textContent = res.nilaiAkhir;

        if (res.totalBenar !== null) {
          document.getElementById('studentScoreStats').innerHTML = `
            <span class="text-success">✅ Benar: ${res.totalBenar}</span>
            <span class="text-danger">❌ Salah: ${res.totalSalah}</span>
            <span class="text-muted">⚪ Kosong: ${res.totalKosong}</span>
          `;
        }
      } else {
        document.getElementById('scoreDisplayCard').classList.add('hidden');
        document.getElementById('studentNoticeText').textContent = 'Nilai dan hasil pengerjaan akan diumumkan oleh bapak/ibu guru.';
      }

      if (res.canReview) {
        document.getElementById('btnReviewQuestions').classList.remove('hidden');
      } else {
        document.getElementById('btnReviewQuestions').classList.add('hidden');
      }
    } catch (err) {
      isSubmittingQuiz = false;
      app.showToast('Gagal mengumpulkan: ' + err.message, 'error', 4000);
    }
  }

  async function loadReview() {
    app.showToast('Memuat pembahasan...', 'info', 2000);

    try {
      const res = await api.getStudentReview(currentSessionData.sesiId);
      document.getElementById('reviewSubTitle').textContent = `${res.judulPaket} - ${res.namaSiswa}`;
      const listContainer = document.getElementById('studentReviewList');
      let html = '';

      res.reviewList.forEach(item => {
        const isBenar = item.benar;
        html += `
          <div class="card" style="margin-bottom:16px; border-left: 4px solid ${isBenar ? 'var(--secondary)' : 'var(--accent-red)'};">
            <div class="flex justify-between items-center" style="margin-bottom:8px;">
              <span class="font-bold" style="color:var(--primary);">Soal No. ${item.nomorUrut}</span>
              <span class="badge ${isBenar ? 'badge-success' : 'badge-danger'}">${isBenar ? 'BENAR' : 'SALAH'}</span>
            </div>
            <div class="question-text" style="font-size:16px; margin-bottom:12px;">${app.escapeHtml(item.pertanyaan)}</div>
            ${item.gambarUrl ? `<img src="${app.escapeHtml(app.formatDriveImageUrl(item.gambarUrl))}" class="question-image" style="max-height:220px;" referrerpolicy="no-referrer" onerror="const f='${app.getDriveFileId(item.gambarUrl)}'; if(f && !this.dataset.t){this.dataset.t='1'; this.src='https://drive.google.com/thumbnail?id='+f+'&sz=w1000';}">` : ''}
            <div style="font-size:14px; margin-bottom:6px;">
              Jawaban Kamu: <b style="color:${isBenar ? 'var(--secondary)' : 'var(--accent-red)'};">${app.escapeHtml(item.jawabanSiswa || '(Tidak Dijawab)')}</b>
            </div>
            ${item.kunciJawaban ? `<div style="font-size:14px; color:var(--text-main); margin-bottom:6px;">Kunci Jawaban: <b class="text-success">${app.escapeHtml(item.kunciJawaban)}</b></div>` : ''}
            ${item.pembahasan ? `<div style="font-size:13px; color:var(--text-muted); background:#f8fafc; padding:10px; border-radius:8px; margin-top:8px;"><b>Pembahasan:</b> ${app.escapeHtml(item.pembahasan)}</div>` : ''}
          </div>
        `;
      });

      listContainer.innerHTML = html;
      document.getElementById('student-result-screen').classList.add('hidden');
      document.getElementById('student-review-screen').classList.remove('hidden');
    } catch (err) {
      app.showToast('Gagal memuat pembahasan: ' + err.message, 'error');
    }
  }

  function backToResultScreen() {
    document.getElementById('student-review-screen').classList.add('hidden');
    document.getElementById('student-result-screen').classList.remove('hidden');
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
    backToResultScreen
  };
})();
