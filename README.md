# Aplikasi Latihan Soal SD - Panduan Lengkap & Dokumentasi Teknis

Aplikasi web modern berbasis **Google Apps Script**, **Google Sheets**, dan **Google Drive** yang dirancang khusus untuk pembelajaran sekolah dasar. Memiliki dua peran pengguna utama: **Guru** (dengan akun aman ber-hash kriptografis) dan **Siswa** (mengerjakan kuis berbasis token tanpa perlu akun atau email).

---

## 1. Struktur File Proyek

```text
├── Code.gs             # Entry point Web App (doGet, routing parameter, include partial)
├── Database.gs         # Skema 10 sheet database, setupLMS() idempoten, CRUD batch, LockService
├── Auth.gs             # Autentikasi guru, SHA-256 password hash + salt, sesi, createFirstTeacher()
├── TeacherService.gs   # Dashboard, Kelas, Siswa, Bank Soal, Media Drive, Paket Latihan, Token, Rekap
├── StudentService.gs   # Validasi token, mulai/lanjut sesi (tahan refresh), autosave, penilaian server
├── ImportService.gs    # Template CSV, parsing, validasi baris per baris, pratinjau & commit
├── Index.html          # Shell utama aplikasi, toast notification universal, modal konfirmasi, utilitas
├── Styles.html         # CSS responsif: ceria & tombol besar untuk siswa SD, rapi & modern untuk guru
├── TeacherApp.html     # Komponen UI dan logika frontend Guru (Dashboard, Bank Soal, Paket, Token, Hasil)
├── StudentApp.html     # Komponen UI dan logika frontend Siswa (Token runner, timer, autosave, palet)
├── template_soal.csv   # File template CSV siap pakai untuk impor Bank Soal
├── template_siswa.csv  # File template CSV siap pakai untuk impor Daftar Siswa
└── README.md           # Dokumentasi instalasi, deployment, checklist pengujian, dan limitasi
```

---

## 2. Skema Database Google Sheets

Fungsi `setupLMS()` secara otomatis membuat dan mengonfigurasi 10 sheet berikut:

1. **`GURU`**: `GuruID`, `Username`, `PasswordHash`, `NamaGuru`, `Aktif`, `DibuatPada`, `DiperbaruiPada`
2. **`KELAS`**: `KelasID`, `GuruID`, `NamaKelas`, `Tingkat`, `TahunAjaran`, `Aktif`, `DibuatPada`
3. **`SISWA`**: `SiswaID`, `GuruID`, `KelasID`, `NamaSiswa`, `NomorAbsen`, `KodeSiswaOpsional`, `Aktif`, `DibuatPada`
4. **`BANK_SOAL`**: `SoalID`, `GuruID`, `MataPelajaran`, `Tingkat`, `Topik`, `JenisSoal`, `Pertanyaan`, `PilihanA`, `PilihanB`, `PilihanC`, `PilihanD`, `KunciJawaban`, `Pembahasan`, `Bobot`, `GambarFileID`, `GambarURL`, `Status`, `DibuatPada`, `DiperbaruiPada`
5. **`PAKET_LATIHAN`**: `PaketID`, `GuruID`, `Judul`, `Deskripsi`, `Petunjuk`, `MataPelajaran`, `Tingkat`, `DurasiMenit`, `MaksPercobaan`, `AcakSoal`, `AcakPilihan`, `TampilkanNilai`, `TampilkanKunci`, `TampilkanPembahasan`, `MulaiPada`, `SelesaiPada`, `Status`, `DibuatPada`, `DiperbaruiPada`
6. **`PAKET_SOAL`**: `PaketSoalID`, `PaketID`, `SoalID`, `Urutan`, `BobotOverride`
7. **`TOKEN_AKSES`**: `TokenID`, `PaketID`, `TokenHash`, `KelasIDOpsional`, `BerlakuSampai`, `BatasPeserta`, `Aktif`, `DibuatPada`, `TokenKode`
8. **`SESI_LATIHAN`**: `SesiID`, `PaketID`, `TokenID`, `SiswaIDOpsional`, `NamaSiswaSnapshot`, `KelasIDSnapshot`, `PercobaanKe`, `MulaiPada`, `TerakhirAktif`, `BatasWaktu`, `DikirimPada`, `Status`, `NilaiAkhir`, `SkorMaksimal`
9. **`JAWABAN_SISWA`**: `JawabanID`, `SesiID`, `SoalID`, `Jawaban`, `Skor`, `Benar`, `DiperbaruiPada`
10. **`PENGATURAN`**: `Kunci`, `Nilai`, `DiperbaruiPada`

---

## 3. Langkah Instalasi & Konfigurasi Google Apps Script

### Langkah A: Buat Project Google Apps Script
1. Buka browser dan kunjungi [script.google.com](https://script.google.com).
2. Klik **New project** (Project Baru). Beri nama project misalnya `Latihan Soal SD`.

### Langkah B: Salin Seluruh File Proyek
Buat file di editor Apps Script sesuai daftar nama file:
1. File Script (`.gs`):
   - `Code.gs`
   - `Database.gs`
   - `Auth.gs`
   - `TeacherService.gs`
   - `StudentService.gs`
   - `ImportService.gs`
2. File HTML (`.html`):
   - `Index.html`
   - `Styles.html`
   - `TeacherApp.html`
   - `StudentApp.html`

Salin isi masing-masing file secara lengkap ke editor Apps Script.

### Langkah C: Jalankan Fungsi Setup Otomatis (`setupLMS`)
1. Pada dropdown fungsi di toolbar atas editor, pilih `setupLMS`.
2. Klik tombol **Run** (Jalankan).
3. Google akan meminta izin akses (*Authorization Required*). Klik **Review permissions** > pilih akun Google Anda > klik **Advanced** > klik **Go to Latihan Soal SD (unsafe)** > klik **Allow**.
4. Fungsi `setupLMS()` akan:
   - Membuat Google Spreadsheet baru bernama `Database Latihan Soal SD`.
   - Mengisi 10 sheet beserta header terformat dan beku (frozen header).
   - Membuat folder Google Drive `LatihanSoalSD_Media` untuk media gambar soal.
   - Menyimpan `SPREADSHEET_ID` dan `DRIVE_FOLDER_ID` ke **Script Properties** secara otomatis.
   - Hasil URL spreadsheet dan Folder Drive akan tercetak di Execution Log.

### Langkah D: Buat Akun Guru Pertama
Anda dapat membuat akun guru pertama dengan salah satu cara berikut:
1. **Melalui Editor (Rekomendasi Admin)**:
   - Buat fungsi sementara di editor Apps Script:
     ```javascript
     function initialSetupGuru() {
       createFirstTeacher("pakguru", "Rahasia123!", "Budi Santoso, S.Pd");
     }
     ```
   - Jalankan fungsi `initialSetupGuru()`.
2. **Melalui Tampilan Web App**:
   - Klik tautan *"Belum punya akun guru? Buat Akun Guru Pertama"* pada dialog login guru di halaman utama.

### Langkah E: Deploy Sebagai Web App
1. Klik tombol **Deploy** di pojok kanan atas > pilih **New deployment**.
2. Klik ikon gerigi (⚙️) di samping *Select type* > pilih **Web app**.
3. Isi konfigurasi:
   - **Description**: `Rilis 1.0 - Latihan Soal SD`
   - **Execute as**: **Me (akun Anda)** *(Wajib, agar sistem dapat membaca database dan menyimpan gambar atas nama backend)*
   - **Who has access**: **Anyone** *(Siswa dan guru dapat mengakses web tanpa perlu akun Google organisasi)*
4. Klik **Deploy**.
5. Salin **Web app URL** yang dihasilkan (misal: `https://script.google.com/macros/s/.../exec`).

---

## 4. Format Impor Excel / CSV

### A. Template Bank Soal (`template_soal.csv`)
Header:
```csv
MataPelajaran,Kelas,Topik,JenisSoal,Pertanyaan,PilihanA,PilihanB,PilihanC,PilihanD,KunciJawaban,Pembahasan,Bobot
```
Ketentuan Kolom:
- `JenisSoal`: `PILIHAN_GANDA`, `BENAR_SALAH`, atau `ISIAN_SINGKAT`.
- `KunciJawaban`:
  - Untuk `PILIHAN_GANDA`: `A`, `B`, `C`, atau `D`.
  - Untuk `BENAR_SALAH`: `BENAR` atau `SALAH` (toleran terhadap `B`/`S`).
  - Untuk `ISIAN_SINGKAT`: Jawaban teks. Dapat memasukkan alternatif jawaban dipisahkan tanda titik-koma (`;`), contoh: `Jakarta;DKI Jakarta`.
- `Bobot`: Angka positif (default `1`).

### B. Template Siswa (`template_siswa.csv`)
Header:
```csv
NamaSiswa,NomorAbsen,KodeSiswaOpsional
```

---

## 5. Checklist Uji Manual Kriteria Penerimaan

| No | Modul / Skenario Pengujian | Langkah Pengujian | Hasil yang Diharapkan |
|:---|:---|:---|:---|
| 1 | **Login Guru Valid** | Masukkan username & password guru yang telah dibuat | Berhasil login, masuk ke Dashboard, token sesi aktif tersimpan |
| 2 | **Login Guru Salah / Nonaktif** | Masukkan password salah atau username yang dinonaktifkan | Muncul pesan error ramah, password tidak bocor |
| 3 | **Isolasi Data Antar Guru** | Login sebagai Guru A, buat soal dan kelas. Login sebagai Guru B | Guru B tidak dapat melihat atau mengubah kelas, soal, maupun paket milik Guru A |
| 4 | **CRUD Kelas & Siswa** | Tambah kelas '6A', tambah siswa manual, arsipkan | Data tersimpan di sheet KELAS & SISWA secara realtime |
| 5 | **Impor Siswa CSV** | Unggah file CSV siswa pada modal roster kelas | Pratinjau menampilkan jumlah baris valid/gagal, setelah konfirmasi tersimpan di sheet SISWA |
| 6 | **CRUD Bank Soal & Media** | Buat soal PG, Benar/Salah, Isian. Unggah gambar PNG/JPG | Gambar tersimpan di folder Google Drive, URL terisi, pratinjau soal berfungsi |
| 7 | **Impor Soal CSV** | Unggah `template_soal.csv` pada modal impor soal | Sistem memvalidasi baris, menampilkan preview data, dan commit ke sheet BANK_SOAL |
| 8 | **Pembuatan Paket Latihan** | Buat paket, tentukan durasi 30 menit, acak pilihan, pilih soal dari bank soal | Relasi tersimpan di sheet PAKET_LATIHAN dan PAKET_SOAL |
| 9 | **Token Siswa** | Buat token untuk paket, salin kode / tautan langsung (?token=...) | Token berstatus Aktif, tautan dapat dibuka langsung oleh siswa |
| 10 | **Siswa Masuk Token** | Buka halaman siswa, input token valid, isi nama siswa | Sistem memvalidasi status paket (TERBIT), jadwal, dan membuka soal |
| 11 | **Proteksi Kunci Jawaban** | Inspeksi elemen/network di browser siswa saat mengerjakan | Kunci jawaban (`KunciJawaban`) dan pembahasan TIDAK PERNAH dikirim ke browser siswa |
| 12 | **Navigasi & Autosave** | Siswa menjawab soal 1, pindah ke soal 2 | Status menunjukkan "Semua jawaban tersimpan", data terisi di sheet JAWABAN_SISWA |
| 13 | **Tahan Refresh Browser** | Siswa me-refresh browser saat sedang mengerjakan | Sesi pengerjaan pulih otomatis dengan sisa timer dan jawaban yang telah diisi |
| 14 | **Timer & Batas Waktu** | Biarkan timer mencapai 00:00 | Sistem otomatis mengumpulkan kuis ke server tanpa kehilangan jawaban |
| 15 | **Penilaian Server-Side** | Kumpulkan kuis, periksa nilai akhir | Nilai dihitung di server (skala 0-100), sheet SESI_LATIHAN terbarui |
| 16 | **Visibilitas Siswa** | Guru menonaktifkan "Siswa Bisa Lihat Nilai" di paket | Siswa menerima pesan ramah bahwa nilai akan diumumkan oleh guru |
| 17 | **Rekap & Koreksi Guru** | Guru membuka menu Hasil & Rekap, klik Detail Jawaban | Guru dapat melihat analisis benar/salah dan mengubah skor isian secara manual |
| 18 | **Ekspor CSV** | Klik tombol "Unduh Rekap CSV" | File CSV terunduh dan dapat dibuka rapi di Microsoft Excel |

---

## 6. Catatan Batasan Teknis Google Apps Script & Solusi

1. **Waktu Eksekusi Maksimal (Timeout 6 Menit)**:
   - Apps Script memiliki batas eksekusi maksimal 6 menit per panggilan.
   - Solusi: Operasi baca/tulis Google Sheets telah dioptimalkan secara batch (`getValues()` dan `setValues()`), serta pagination pada query data.
2. **Keterbatasan Kuota Triggers & Cache**:
   - `CacheService` memiliki batasan penyimpanan 100KB per entri dan waktu hidup maksimal 6 jam.
   - Solusi: Token sesi disimpan secara efisien dan diverifikasi ulang terhadap baris akun guru di spreadsheet untuk keandalan maksimal.
3. **Penguncian Data (`LockService`)**:
   - Untuk mencegah tabrakan data (race condition) saat banyak siswa mengumpulkan kuis secara bersamaan, setiap operasi simpan jawaban, mulai sesi, dan kalkulasi nilai telah dibungkus dalam blok `withScriptLock()`.
4. **Zona Waktu**:
   - Seluruh stempel waktu (`DibuatPada`, `BatasWaktu`, `DikirimPada`) secara ketat mengikuti zona waktu **`Asia/Jakarta` (WIB)** menggunakan `Utilities.formatDate()`.
