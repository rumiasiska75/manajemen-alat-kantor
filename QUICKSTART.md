# 🚀 Quick Start Guide

Panduan cepat untuk menjalankan aplikasi Manajemen Alat Kantor dalam 5 menit!

## ⚡ Langkah Cepat

### 1. Install Node.js

Download dan install Node.js dari [nodejs.org](https://nodejs.org) (pilih versi LTS)

Cek instalasi:
```bash
node --version
npm --version
```

### 2. Install Dependencies

```bash
cd backend
npm install
```

### 3. Jalankan Server

```bash
npm start
```

### 4. Buka Aplikasi

Buka browser dan akses:
```
http://localhost:5000
```

## 🔑 Login Pertama Kali

**Akun Admin Default:**
```
Username: admin
Password: admin123
```

**Atau Daftar Akun User Baru:**
- Klik "Daftar di sini"
- Isi form registrasi
- Login dengan akun yang dibuat

## 📱 Cara Menggunakan

### Admin - Menambah Alat

1. Login sebagai admin
2. Klik menu **Alat** → **+ Tambah Alat**
3. Isi data alat (minimal: Kode, Nama, Kategori)
4. Klik **Simpan**
5. QR Code otomatis dibuat
6. Klik alat → Download QR Code → Cetak & tempel di alat fisik

### User - Meminjam Alat

1. Login sebagai user
2. Klik menu **Pinjam Alat**
3. Klik **Mulai Scan**
4. Izinkan akses kamera
5. Arahkan kamera ke QR Code alat
6. Alat masuk keranjang otomatis
7. Ambil foto alat yang dipinjam
8. Klik **Konfirmasi Peminjaman**

### User - Mengembalikan Alat

1. Klik menu **Riwayat**
2. Pilih peminjaman aktif
3. Klik **Kembalikan**
4. Pilih kondisi setiap alat
5. Upload foto pengembalian
6. Klik **Konfirmasi Pengembalian**

## 🛠 Troubleshooting Cepat

### Port sudah digunakan?
Edit `backend/.env`:
```env
PORT=3000
```

### Kamera tidak bisa diakses?
- Pastikan browser memiliki izin kamera
- Gunakan Chrome/Edge (lebih support)
- Akses dengan `http://localhost` bukan IP

### Error saat install?
```bash
# Hapus node_modules dan coba lagi
rm -rf node_modules
npm install
```

## 📝 Catatan Penting

✅ **DO:**
- Ganti password admin setelah login pertama
- Backup database secara berkala
- Gunakan browser modern (Chrome, Edge, Firefox)

❌ **DON'T:**
- Jangan gunakan password default di production
- Jangan expose server ke internet tanpa security
- Jangan hapus file database saat ada data penting

## 🎯 Next Steps

Setelah berhasil menjalankan:

1. ✅ Ganti password admin
2. ✅ Tambahkan beberapa alat contoh
3. ✅ Test scan QR Code
4. ✅ Buat akun user untuk testing
5. ✅ Test flow peminjaman lengkap
6. ✅ Baca [README.md](README.md) untuk fitur lengkap

## 💡 Tips Pro

**Untuk Admin:**
- Gunakan kode alat yang konsisten (misal: LPT-001, PRJ-001)
- Tambahkan foto alat untuk memudah identifikasi
- Set lokasi alat untuk memudah pencarian fisik

**Untuk User:**
- Pastikan pencahayaan cukup saat scan QR
- Ambil foto yang jelas saat pinjam/kembali
- Tambahkan catatan jika ada kerusakan

## 📞 Butuh Bantuan?

- 📖 Baca [README.md](README.md) untuk dokumentasi lengkap
- 🐛 Ada bug? Laporkan via Issues
- 💬 Pertanyaan? Diskusi via Discussions

---

**Selamat menggunakan! 🎉**

Dibuat dengan ❤️ untuk manajemen alat kantor yang lebih baik.