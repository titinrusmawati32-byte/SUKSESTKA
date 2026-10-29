# Guru Pintar – Aplikasi Latihan Soal SD (Frontend GitHub Pages)

Repositori ini berisi kode antarmuka frontend untuk aplikasi **Latihan Soal SD – Guru Pintar** yang telah dimigrasikan ke arsitektur terpisah (decoupled architecture):

- **Frontend**: Di-hosting pada **GitHub Pages** (HTML5, CSS3, dan Vanilla JavaScript modular).
- **Backend**: **Google Apps Script Web App** (melayani API via HTTP POST/GET CORS).
- **Database**: **Google Sheets** (dikelola secara eksklusif oleh Google Apps Script).
- **Penyimpanan Media**: **Google Drive** (folder `LatihanSoalSD_Media`).

---

## 1. Struktur Repositori

```text
guru-pintar/
├── index.html                  # Halaman utama aplikasi (SPA)
├── assets/
│   ├── css/
│   │   └── style.css           # Desain responsif ramah anak SD & profesional guru
│   ├── js/
│   │   ├── api.js              # Klien HTTP API terpusat untuk komunikasi dengan GAS
│   │   ├── auth.js             # Autentikasi guru, sesi, dan pergantian password
│   │   ├── dashboard.js        # Modul dashboard analitik dan ringkasan nilai
│   │   ├── kelas.js            # Modul pengelolaan kelas, roster siswa, dan impor CSV
│   │   ├── bank-soal.js        # Modul Bank Soal, media Drive, pratinjau, dan impor CSV
│   │   ├── paket-latihan.js    # Modul penyusunan paket kuis, durasi, dan seleksi soal
│   │   ├── token-siswa.js      # Modul token guru & runner pengerjaan kuis siswa
│   │   ├── hasil-rekap.js      # Modul rekapitulasi nilai, koreksi manual, dan ekspor CSV
│   │   └── app.js              # Inisialisasi, modal universal, toast, dan router view
│   └── images/
│       └── .gitkeep            # Aset gambar statis
├── template_soal.csv           # Template resmi impor Bank Soal
├── template_siswa.csv          # Template resmi impor Daftar Siswa
├── README.md                   # Panduan instalasi dan deployment
└── .gitignore                  # File pengabaian git
```

---

## 2. Arsitektur Komunikasi API & Solusi CORS

Frontend GitHub Pages berkomunikasi dengan Google Apps Script Web App tanpa memerlukan server proxy perantara. 

### Mekanisme Teknis:
1. **CORS Simple Request**:
   - Permintaan dikirim menggunakan method `POST` dengan header `Content-Type: text/plain;charset=utf-8`.
   - Mengikuti spesifikasi W3C Fetch & CORS, browser tidak mengirimkan preflight `OPTIONS` (karena Google Apps Script tidak mendukung HTTP OPTIONS).
2. **Redirect Otomatis**:
   - Google Apps Script menerima isi payload JSON di `e.postData.contents`.
   - GAS memproses aksi dan merespons dengan HTTP 302 Found menuju `script.googleusercontent.com` yang menyertakan header `Access-Control-Allow-Origin: *`.
   - Browser mengikuti redirect (`redirect: 'follow'`) dan menerima respon data JSON secara aman dan andal.

---

## 3. Langkah Deployment Lengkap

### Langkah 1: Siapkan Backend Google Apps Script
1. Buka [script.google.com](https://script.google.com) dan buat **New Project**.
2. Salin seluruh file backend `.gs` dari folder backend:
   - `Code.gs` *(pastikan berisi handler `doPost` dan `doGet` API)*
   - `Database.gs`
   - `Auth.gs`
   - `TeacherService.gs`
   - `StudentService.gs`
   - `ImportService.gs`
3. Jalankan fungsi `setupLMS` di toolbar atas editor untuk menginisialisasi spreadsheet Google Sheets dan folder media Google Drive.
4. Buat akun guru awal dengan menjalankan fungsi pembantu:
   ```javascript
   function buatAkunGuru() {
     createFirstTeacher("pakguru", "Rahasia123!", "Budi Santoso, S.Pd");
   }
   ```
5. Deploy sebagai Web App:
   - Klik **Deploy** > **New deployment**.
   - Pilih jenis **Web app**.
   - **Execute as**: `Me (email Anda)`.
   - **Who has access**: `Anyone`.
   - Klik **Deploy** dan salin **Web app URL** yang berakhiran `/exec`.

---

### Langkah 2: Deploy Frontend ke GitHub Pages
1. Inisialisasi git dan push folder `guru-pintar/` ke repositori GitHub Anda:
   ```bash
   git init
   git add .
   git commit -m "feat: rilis frontend guru-pintar untuk GitHub Pages"
   git branch -M main
   git remote add origin https://github.com/<username>/<nama-repo>.git
   git push -u origin main
   ```
2. Buka tab **Settings** di repositori GitHub Anda.
3. Pilih menu **Pages** di bilah sisi kiri.
4. Pada bagian **Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` / `root`
   - Klik **Save**.
5. Tunggu sekitar 1 menit hingga GitHub Pages memunculkan URL situs Anda, misalnya:  
   `https://<username>.github.io/<nama-repo>/`

---

### Langkah 3: Hubungkan Frontend ke Backend
1. Buka URL GitHub Pages Anda di browser.
2. Saat pertama kali dibuka, aplikasi akan menampilkan jendela:  
   **"⚙️ Konfigurasi URL Backend"**.
3. Tempelkan URL Web App Google Apps Script yang Anda peroleh dari Langkah 1.
4. Klik **Simpan Konfigurasi**.
5. Selesai! Frontend GitHub Pages kini terhubung langsung dengan Google Sheets. Anda dapat mengganti atau menguji URL kapan saja melalui menu **Pengaturan** > **Uji Koneksi (Ping)**.

---

## 4. Keamanan & Privasi

1. **Kunci Jawaban Aman**: Backend `StudentService.gs` secara ketat menghapus `KunciJawaban` dan `Pembahasan` sebelum mengirimkan daftar soal ke browser siswa.
2. **Kalkulasi Nilai Server-Side**: Nilai kuis dihitung penuh di server backend, mencegah manipulasi skor di sisi klien.
3. **Penyimpanan Password Aman**: Password guru disimpan dalam bentuk hash SHA-256 dengan cryptographic salt unik per akun, tidak dalam teks biasa.
4. **Isolasi Multi-Guru**: Semua data kelas, soal, paket, dan nilai difilter ketat berdasarkan `GuruID` dari token sesi yang divalidasi di server.

---

## 5. Fitur Utama

- **Dashboard Guru**: Metrik statistik jumlah kelas, paket aktif, bank soal, rata-rata nilai, dan daftar 5 aktivitas pengerjaan siswa terbaru.
- **Kelas & Siswa**: CRUD kelas, roster siswa, dan impor daftar siswa via file CSV.
- **Bank Soal**: Mendukung soal Pilihan Ganda (A-D), Benar/Salah, dan Isian Singkat. Dilengkapi fitur upload gambar langsung ke Google Drive serta impor template CSV.
- **Paket Latihan**: Pengaturan durasi pengerjaan, batas percobaan, acak soal, acak pilihan jawaban, serta pengaturan visibilitas nilai dan pembahasan.
- **Token Akses Siswa**: Pembuatan kode token kuis, pembatasan kelas khusus, kuota siswa, tombol salin kode, dan salin tautan langsung (`?token=XYZ`).
- **Pengerjaan Siswa**: Masuk tanpa akun (cukup token dan nama), ramah anak SD dengan tombol besar, hitung mundur timer, autosave realtime, tahan refresh browser, dan palet nomor soal ragu-ragu.
- **Hasil & Rekap Nilai**: Analisis lembar jawaban siswa, fitur koreksi manual nilai isian singkat oleh guru, dan ekspor rekap ke format CSV/Excel.
