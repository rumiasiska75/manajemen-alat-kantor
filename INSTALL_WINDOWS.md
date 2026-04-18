# 🪟 Panduan Instalasi untuk Windows

Panduan lengkap instalasi Sistem Manajemen Alat Kantor di Windows 10/11.

## 📋 Daftar Isi

- [Prasyarat](#-prasyarat)
- [Langkah 1: Install Node.js](#-langkah-1-install-nodejs)
- [Langkah 2: Download Project](#-langkah-2-download-project)
- [Langkah 3: Install Dependencies](#-langkah-3-install-dependencies)
- [Langkah 4: Konfigurasi](#-langkah-4-konfigurasi)
- [Langkah 5: Jalankan Aplikasi](#-langkah-5-jalankan-aplikasi)
- [Troubleshooting Windows](#-troubleshooting-windows)
- [Tips & Tricks](#-tips--tricks)

## ✅ Prasyarat

Sebelum memulai, pastikan komputer Anda memiliki:

- ✅ Windows 10 atau Windows 11
- ✅ Koneksi internet
- ✅ Webcam (untuk fitur QR Scanner)
- ✅ Minimal 2GB RAM free
- ✅ Minimal 500MB storage free
- ✅ Browser modern (Chrome/Edge recommended)

## 🟢 Langkah 1: Install Node.js

### Download Node.js

1. Buka browser dan kunjungi: https://nodejs.org
2. Download versi **LTS (Long Term Support)** - Recommended for most users
3. Pilih installer Windows (.msi) sesuai sistem:
   - 64-bit (kebanyakan komputer modern)
   - 32-bit (komputer lama)

### Install Node.js

1. Double-click file installer yang sudah didownload
2. Klik **Next** di welcome screen
3. Centang "I accept the terms..." → Klik **Next**
4. Pilih lokasi instalasi (biarkan default) → Klik **Next**
5. **PENTING**: Centang opsi **"Automatically install the necessary tools"**
6. Klik **Next** → Klik **Install**
7. Tunggu proses instalasi selesai
8. Klik **Finish**

### Verifikasi Instalasi

1. Buka **Command Prompt** atau **PowerShell**:
   - Tekan `Win + R`
   - Ketik `cmd` atau `powershell`
   - Tekan `Enter`

2. Jalankan perintah berikut:
   ```cmd
   node --version
   ```
   Harus muncul versi Node.js (misal: `v18.17.0`)

3. Cek npm:
   ```cmd
   npm --version
   ```
   Harus muncul versi npm (misal: `9.6.7`)

✅ Jika kedua perintah menampilkan versi, Node.js berhasil terinstall!

## 📥 Langkah 2: Download Project

### Cara 1: Download ZIP (Mudah)

1. Download project sebagai ZIP file
2. Extract ke folder pilihan Anda (misal: `C:\Projects\`)
3. Buka folder hasil extract

### Cara 2: Clone dengan Git (Recommended)

**Install Git terlebih dahulu:**
1. Download Git dari: https://git-scm.com/download/win
2. Install dengan pengaturan default

**Clone project:**
1. Buka Command Prompt atau PowerShell
2. Navigasi ke folder yang diinginkan:
   ```cmd
   cd C:\Projects
   ```
3. Clone repository:
   ```cmd
   git clone https://github.com/yourusername/manajemen-alat-kantor.git
   cd manajemen-alat-kantor
   ```

## 📦 Langkah 3: Install Dependencies

1. Buka **Command Prompt** atau **PowerShell**
2. Navigasi ke folder backend:
   ```cmd
   cd "C:\Projects\Manajemen Gudang\backend"
   ```
   ⚠️ Sesuaikan path dengan lokasi project Anda!

3. Install dependencies:
   ```cmd
   npm install
   ```

4. Tunggu proses download dan instalasi (bisa 2-5 menit tergantung koneksi)

5. Jika berhasil, akan muncul pesan seperti:
   ```
   added XXX packages in XXs
   ```

## ⚙️ Langkah 4: Konfigurasi

File `.env` sudah tersedia di folder `backend`. Buka dengan Notepad atau text editor:

```cmd
notepad .env
```

**Konfigurasi default (sudah bisa langsung digunakan):**
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your-secret-key-change-this-in-production-12345
JWT_EXPIRES_IN=24h
DB_PATH=./database.sqlite
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads
QRCODE_PATH=./qrcodes
FRONTEND_URL=http://localhost:5000
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123
DEFAULT_ADMIN_EMAIL=admin@kantor.com
```

⚠️ **PENTING**: Ganti `JWT_SECRET` jika akan digunakan untuk production!

## 🚀 Langkah 5: Jalankan Aplikasi

### Cara 1: Development Mode (dengan auto-reload)

1. Pastikan masih di folder `backend`
2. Jalankan:
   ```cmd
   npm run dev
   ```

### Cara 2: Production Mode

```cmd
npm start
```

### Tampilan Sukses

Jika berhasil, akan muncul:
```
Initializing database...
Connected to SQLite database
Default admin account created successfully
Username: admin
Password: admin123
Database initialized successfully
==================================================
Server running on port 5000
Environment: development
API URL: http://localhost:5000/api
Frontend URL: http://localhost:5000
==================================================
```

## 🌐 Akses Aplikasi

1. Buka browser (Chrome/Edge recommended)
2. Akses: http://localhost:5000
3. Login dengan:
   ```
   Username: admin
   Password: admin123
   ```

## 🔧 Troubleshooting Windows

### Error: 'node' is not recognized

**Penyebab**: Node.js belum terinstall atau tidak ada di PATH

**Solusi**:
1. Install ulang Node.js
2. Restart Command Prompt/PowerShell
3. Restart komputer jika masih error

### Error: Port 5000 already in use

**Penyebab**: Port 5000 sudah digunakan aplikasi lain

**Solusi 1 - Ganti Port**:
Edit file `.env`:
```env
PORT=3000
```

**Solusi 2 - Matikan aplikasi yang menggunakan port 5000**:
```cmd
netstat -ano | findstr :5000
taskkill /PID [nomor_PID] /F
```

### Error: Cannot find module

**Penyebab**: Dependencies tidak terinstall lengkap

**Solusi**:
```cmd
# Hapus node_modules
rmdir /s /q node_modules

# Install ulang
npm install
```

### Error: Permission denied

**Penyebab**: Antivirus atau Windows Defender block

**Solusi**:
1. Buka Windows Security
2. Virus & threat protection
3. Manage settings
4. Add exclusion → Folder
5. Pilih folder project

### Kamera tidak terdeteksi

**Solusi**:
1. Buka **Settings** → **Privacy** → **Camera**
2. Pastikan "Allow apps to access your camera" ON
3. Pastikan browser memiliki permission
4. Gunakan browser Chrome/Edge (support lebih baik)

### Database locked error

**Solusi**:
```cmd
# Stop semua instance server
# Tekan Ctrl+C di Command Prompt

# Hapus database (jika boleh kehilangan data)
del database.sqlite

# Restart server
npm start
```

### Error saat npm install di Windows

**Solusi 1 - Gunakan PowerShell as Administrator**:
1. Klik kanan Start Menu
2. Pilih "Windows PowerShell (Admin)"
3. Jalankan ulang `npm install`

**Solusi 2 - Clear npm cache**:
```cmd
npm cache clean --force
npm install
```

## 💡 Tips & Tricks

### 1. Gunakan Windows Terminal (Recommended)

Download dari Microsoft Store: **Windows Terminal**
- Lebih modern dan user-friendly
- Support multiple tabs
- Better color support

### 2. Shortcut untuk Restart Server

Buat file `restart.bat` di folder backend:
```batch
@echo off
echo Restarting server...
taskkill /F /IM node.exe
npm start
```

Double-click file ini untuk restart server cepat.

### 3. Jalankan sebagai Background Service

Install PM2:
```cmd
npm install -g pm2-windows-service
npm install -g pm2

# Start server
pm2 start server.js --name "manajemen-alat"

# Auto-start on boot
pm2 startup
pm2 save
```

### 4. Akses dari HP/Tablet di jaringan yang sama

1. Cari IP komputer Anda:
   ```cmd
   ipconfig
   ```
   Catat IPv4 Address (misal: 192.168.1.100)

2. Edit `.env`:
   ```env
   FRONTEND_URL=http://192.168.1.100:5000
   ```

3. Di HP/Tablet, buka:
   ```
   http://192.168.1.100:5000
   ```

4. **PENTING**: Disable Windows Firewall atau allow port 5000:
   ```cmd
   # Run as Administrator
   netsh advfirewall firewall add rule name="Node Server" dir=in action=allow protocol=TCP localport=5000
   ```

### 5. Backup Database Otomatis

Buat file `backup.bat`:
```batch
@echo off
set timestamp=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set timestamp=%timestamp: =0%
copy backend\database.sqlite "backup\database_%timestamp%.sqlite"
echo Backup created: database_%timestamp%.sqlite
```

### 6. Monitor Logs

Install Windows Terminal dan gunakan:
```cmd
npm run dev | tee logs.txt
```

## 📱 Browser yang Disarankan

**Sangat Recommended:**
- ✅ Google Chrome (Best support untuk QR Scanner)
- ✅ Microsoft Edge (Chromium-based, built-in di Windows)

**Recommended:**
- ⚠️ Firefox (Good, tapi QR scanner mungkin lebih lambat)

**Not Recommended:**
- ❌ Internet Explorer (Deprecated, tidak support)

## 🔒 Security untuk Windows

1. **Windows Defender**: Pastikan selalu ON
2. **Firewall**: Jangan disable completely, gunakan exception
3. **Updates**: Selalu update Windows dan Node.js
4. **Antivirus**: Jika menggunakan antivirus third-party, add project folder ke whitelist

## 🎯 Next Steps

Setelah instalasi berhasil:

1. ✅ Test login sebagai admin
2. ✅ Tambahkan alat pertama
3. ✅ Generate dan download QR Code
4. ✅ Cetak QR Code (Print atau save ke PDF)
5. ✅ Buat akun user untuk testing
6. ✅ Test scan QR Code dengan webcam
7. ✅ Test flow peminjaman lengkap

## 📞 Bantuan Lebih Lanjut

**Jika masih ada masalah:**
1. Cek [README.md](README.md) untuk dokumentasi lengkap
2. Cek [QUICKSTART.md](QUICKSTART.md) untuk panduan cepat
3. Buka Issue di GitHub
4. Pastikan sudah follow semua langkah dengan benar

---

## 📝 Checklist Instalasi

- [ ] Node.js terinstall (cek: `node --version`)
- [ ] npm terinstall (cek: `npm --version`)
- [ ] Project sudah didownload
- [ ] Dependencies terinstall (`npm install` sukses)
- [ ] File `.env` sudah ada di folder backend
- [ ] Server bisa jalan (`npm start` sukses)
- [ ] Bisa akses http://localhost:5000
- [ ] Bisa login dengan admin/admin123
- [ ] Webcam bisa diakses (untuk QR scanner)

---

**Selamat! Aplikasi siap digunakan! 🎉**

Jika ada pertanyaan atau masalah, jangan ragu untuk bertanya!

**Made with ❤️ for Windows users**

Last Updated: 2024