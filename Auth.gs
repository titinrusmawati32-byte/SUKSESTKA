/**
 * ============================================================================
 * Aplikasi Latihan Soal SD - Modul Autentikasi & Keamanan Guru
 * File: Auth.gs
 * Deskripsi: Hashing password dengan salt, pembuatan akun guru awal,
 *            verifikasi login, manajemen sesi, dan validasi hak akses.
 * ============================================================================
 */

var SESSION_EXPIRY_SECONDS = 6 * 3600; // 6 Jam

/**
 * Menghasilkan hash SHA-256 dengan salt unik
 * @param {string} password Password teks murni
 * @param {string} salt Salt unik (opsional, jika tidak ada dibuatkan baru)
 * @return {Object} { salt, hash, fullHash: 'salt:hash' }
 */
function hashPassword(password, salt) {
  var generatedSalt = salt || Utilities.getUuid().replace(/-/g, '').substring(0, 16);
  var rawBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    generatedSalt + ':' + password,
    Utilities.Charset.UTF_8
  );
  var hashHex = '';
  for (var i = 0; i < rawBytes.length; i++) {
    var byteVal = rawBytes[i];
    if (byteVal < 0) byteVal += 256;
    var byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = '0' + byteHex;
    hashHex += byteHex;
  }
  return {
    salt: generatedSalt,
    hash: hashHex,
    fullHash: generatedSalt + ':' + hashHex
  };
}

/**
 * Memverifikasi kecocokan password dengan hash tersimpan
 * @param {string} inputPassword Password yang diinput
 * @param {string} storedFullHash Hash yang tersimpan dengan format 'salt:hash'
 * @return {boolean} True jika cocok
 */
function verifyPassword(inputPassword, storedFullHash) {
  if (!storedFullHash || typeof storedFullHash !== 'string') return false;
  var parts = storedFullHash.split(':');
  if (parts.length !== 2) return false;
  var salt = parts[0];
  var expectedHash = parts[1];
  var calculated = hashPassword(inputPassword, salt);
  return calculated.hash === expectedHash;
}

/**
 * Membuat akun guru pertama / akun guru baru dengan validasi aman.
 * Tidak menyimpan password dalam teks biasa atau log.
 * @param {string} username Username (min 3 karakter, alfanumerik)
 * @param {string} password Password (min 6 karakter)
 * @param {string} namaGuru Nama lengkap guru
 * @return {Object} Hasil pembuatan akun
 */
function createFirstTeacher(username, password, namaGuru) {
  return withScriptLock(function() {
    if (!username || username.trim().length < 3) {
      throw new Error('Username minimal 3 karakter alfanumerik.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password minimal 6 karakter.');
    }
    if (!namaGuru || namaGuru.trim().length < 2) {
      throw new Error('Nama guru minimal 2 karakter.');
    }

    var cleanUsername = username.trim().toLowerCase();
    var rows = getAllRows(SHEETS.GURU);

    // Cek duplikasi username (case-insensitive)
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].Username).toLowerCase() === cleanUsername) {
        throw new Error('Username "' + username + '" sudah digunakan. Silakan pilih username lain.');
      }
    }

    var hashedPassword = hashPassword(password);
    var guruId = generateId('GUR');
    var now = getJakartaTimestamp();

    var newGuru = {
      GuruID: guruId,
      Username: cleanUsername,
      PasswordHash: hashedPassword.fullHash,
      NamaGuru: namaGuru.trim(),
      Aktif: true,
      DibuatPada: now,
      DiperbaruiPada: now
    };

    appendRow(SHEETS.GURU, newGuru);

    return {
      success: true,
      message: 'Akun guru "' + cleanUsername + '" berhasil dibuat. Silakan login.',
      guruId: guruId
    };
  });
}

/**
 * Login Guru dengan username dan password
 * @param {string} username Username guru
 * @param {string} password Password guru
 * @return {Object} Objek hasil login beserta token sesi
 */
function loginTeacher(username, password) {
  if (!username || !password) {
    return { success: false, message: 'Username dan password wajib diisi.' };
  }

  var cleanUsername = username.trim().toLowerCase();
  var rows = getAllRows(SHEETS.GURU);
  var foundGuru = null;

  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].Username).toLowerCase() === cleanUsername) {
      foundGuru = rows[i];
      break;
    }
  }

  if (!foundGuru) {
    return { success: false, message: 'Username atau password tidak cocok.' };
  }

  // Periksa status aktif
  var isAktif = (foundGuru.Aktif === true || String(foundGuru.Aktif).toUpperCase() === 'TRUE');
  if (!isAktif) {
    return { success: false, message: 'Akun guru ini telah dinonaktifkan. Hubungi administrator.' };
  }

  // Verifikasi password
  var isMatch = verifyPassword(password, String(foundGuru.PasswordHash));
  if (!isMatch) {
    return { success: false, message: 'Username atau password tidak cocok.' };
  }

  // Generate Session Token acak berkekuatan tinggi
  var sessionToken = Utilities.getUuid() + '-' + Utilities.getUuid();
  var sessionData = {
    guruId: foundGuru.GuruID,
    username: foundGuru.Username,
    namaGuru: foundGuru.NamaGuru,
    createdAt: Date.now(),
    expiresAt: Date.now() + (SESSION_EXPIRY_SECONDS * 1000)
  };

  // Simpan ke CacheService
  var cache = CacheService.getScriptCache();
  cache.put('sess_' + sessionToken, JSON.stringify(sessionData), SESSION_EXPIRY_SECONDS);

  return {
    success: true,
    message: 'Login berhasil.',
    sessionToken: sessionToken,
    profile: {
      guruId: foundGuru.GuruID,
      username: foundGuru.Username,
      namaGuru: foundGuru.NamaGuru
    }
  };
}

/**
 * Validasi token sesi guru.
 * Memastikan sesi masih aktif dan guru terkait masih aktif di database.
 * @param {string} sessionToken Token sesi dari client
 * @return {Object} Objek Guru jika valid
 * @throws {Error} Jika sesi tidak valid atau kedaluwarsa
 */
function validateSession(sessionToken) {
  if (!sessionToken || typeof sessionToken !== 'string') {
    throw new Error('Akses ditolak: Token sesi tidak ditemukan. Silakan login kembali.');
  }

  var cache = CacheService.getScriptCache();
  var rawSession = cache.get('sess_' + sessionToken);
  var session = null;

  if (rawSession) {
    try {
      session = JSON.parse(rawSession);
    } catch (e) {
      session = null;
    }
  }

  if (!session || !session.guruId) {
    throw new Error('Sesi telah kedaluwarsa atau tidak valid. Silakan login kembali.');
  }

  // Validasi waktu kedaluwarsa
  if (Date.now() > session.expiresAt) {
    cache.remove('sess_' + sessionToken);
    throw new Error('Sesi Anda telah berakhir. Silakan login kembali.');
  }

  // Validasi integritas terhadap data Guru di sheet
  var rows = getAllRows(SHEETS.GURU);
  var guruRecord = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].GuruID === session.guruId) {
      guruRecord = rows[i];
      break;
    }
  }

  if (!guruRecord) {
    cache.remove('sess_' + sessionToken);
    throw new Error('Data guru tidak ditemukan di sistem.');
  }

  var isAktif = (guruRecord.Aktif === true || String(guruRecord.Aktif).toUpperCase() === 'TRUE');
  if (!isAktif) {
    cache.remove('sess_' + sessionToken);
    throw new Error('Akun Anda telah dinonaktifkan.');
  }

  return {
    guruId: guruRecord.GuruID,
    username: guruRecord.Username,
    namaGuru: guruRecord.NamaGuru
  };
}

/**
 * Logout Guru dan menghapus sesi aktif
 * @param {string} sessionToken Token sesi
 * @return {Object} Status logout
 */
function logoutTeacher(sessionToken) {
  if (sessionToken) {
    var cache = CacheService.getScriptCache();
    cache.remove('sess_' + sessionToken);
  }
  return { success: true, message: 'Logout berhasil.' };
}

/**
 * Mengubah password guru yang sedang login
 * @param {string} sessionToken Token sesi
 * @param {string} oldPassword Password lama
 * @param {string} newPassword Password baru
 * @return {Object} Status hasil perubahan password
 */
function changeTeacherPassword(sessionToken, oldPassword, newPassword) {
  var session = validateSession(sessionToken);

  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password baru minimal 6 karakter.');
  }

  var rows = getAllRows(SHEETS.GURU);
  var target = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].GuruID === session.guruId) {
      target = rows[i];
      break;
    }
  }

  if (!target) {
    throw new Error('Data guru tidak ditemukan.');
  }

  if (!verifyPassword(oldPassword, String(target.PasswordHash))) {
    throw new Error('Password lama yang Anda masukkan salah.');
  }

  var newHashed = hashPassword(newPassword);
  var now = getJakartaTimestamp();

  updateRow(SHEETS.GURU, 'GuruID', session.guruId, {
    PasswordHash: newHashed.fullHash,
    DiperbaruiPada: now
  });

  return {
    success: true,
    message: 'Password berhasil diperbarui. Silakan gunakan password baru pada sesi berikutnya.'
  };
}

/**
 * Memeriksa apakah sudah ada minimal 1 akun guru di database
 * @return {boolean} True jika sudah ada guru
 */
function hasRegisteredTeacher() {
  try {
    var rows = getAllRows(SHEETS.GURU);
    return rows.length > 0;
  } catch (e) {
    return false;
  }
}
