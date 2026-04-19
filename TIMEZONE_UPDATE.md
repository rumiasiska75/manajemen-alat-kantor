# 🕐 Dokumentasi Update Timezone Asia/Jakarta (WIB)

## 📋 Ringkasan Perubahan

Aplikasi telah diupdate untuk menggunakan timezone **Asia/Jakarta (WIB)** di seluruh sistem, baik backend maupun frontend.

**Tanggal Update:** 2024  
**Versi:** 1.1.0  
**Tipe Perubahan:** Timezone Configuration

---

## 🎯 Tujuan

1. Semua timestamp di aplikasi menggunakan waktu Indonesia (WIB)
2. Konsistensi waktu antara server dan client
3. Mudah dibaca oleh user tanpa konversi timezone

---

## 📝 File yang Diubah

### Backend

#### 1. **`backend/server.js`**
```javascript
// Tambahan di baris 1-2
process.env.TZ = "Asia/Jakarta";
```
- Set timezone environment variable ke Asia/Jakarta
- Berlaku untuk seluruh aplikasi Node.js
- Tampilan timezone di console saat server start

#### 2. **`backend/routes/borrowings.js`**
```javascript
// Tambahan helper functions di awal file
function getWIBDateTime() { ... }
function formatDateWIB(date) { ... }
```
- Helper function untuk generate waktu WIB
- Format tanggal konsisten dengan timezone WIB

### Frontend

#### 3. **`frontend/js/config.js`**
```javascript
// Update fungsi formatDate dan formatDateSimple
timeZone: "Asia/Jakarta"
```
- Semua format tanggal menggunakan timezone Asia/Jakarta
- Tambahan label " WIB" di output formatDate

#### 4. **`frontend/js/admin.js`**
```javascript
// Tambahan helper functions
function formatDateWIB(dateString) { ... }
function formatDateShortWIB(dateString) { ... }
```
- Format lengkap: `DD/MM/YYYY HH:mm:ss WIB`
- Format pendek: `DD/MM/YYYY`
- Digunakan untuk display di dashboard admin

#### 5. **`frontend/js/user.js`**
```javascript
// Tambahan helper functions (sama seperti admin.js)
function formatDateWIB(dateString) { ... }
function formatDateShortWIB(dateString) { ... }
```
- Format lengkap: `DD/MM/YYYY HH:mm:ss WIB`
- Format pendek: `DD/MM/YYYY`
- Digunakan untuk display di dashboard user

---

## 🔧 Cara Kerja

### Backend
1. Environment variable `TZ` di-set ke `Asia/Jakarta` saat server start
2. Semua `new Date()` di Node.js otomatis menggunakan WIB
3. SQLite menyimpan DATETIME dalam format WIB

### Frontend
1. Semua fungsi `toLocaleString()` dan `toLocaleDateString()` menggunakan option `timeZone: "Asia/Jakarta"`
2. Browser akan menampilkan waktu dalam WIB, terlepas dari timezone perangkat user
3. Label " WIB" ditambahkan untuk kejelasan

---

## 📊 Format Tanggal yang Digunakan

### Format Lengkap (formatDateWIB)
- **Output:** `25/12/2024 14:30:45 WIB`
- **Digunakan untuk:** Detail peminjaman, log aktivitas, timestamp detail

### Format Pendek (formatDateShortWIB)
- **Output:** `25/12/2024`
- **Digunakan untuk:** List peminjaman, card view, quick info

### Format Panjang (formatDate)
- **Output:** `25 Desember 2024 14:30 WIB`
- **Digunakan untuk:** Display umum, dashboard

### Format Simple (formatDateSimple)
- **Output:** `25/12/2024`
- **Digunakan untuk:** Tanggal saja tanpa jam

---

## ✅ Testing

### Test Backend
```bash
# Start server
npm start

# Check console output
# Harus muncul: "Timezone: Asia/Jakarta (WIB)"
# Harus muncul: "Current time: [waktu WIB]"
```

### Test Frontend
1. Login sebagai admin
2. Buka halaman Dashboard
3. Cek Recent Activities - harus tampil dengan label WIB
4. Buat peminjaman baru
5. Cek tanggal peminjaman - harus sesuai waktu WIB

### Test API Endpoint
```bash
# Health check
curl http://localhost:5000/api/health

# Response harus menampilkan timezone info
{
  "success": true,
  "message": "Server is running",
  "timestamp": "25/12/2024 14:30:45",
  "timezone": "Asia/Jakarta (WIB)",
  "environment": "development"
}
```

---

## 🚀 Deployment

### Development
```bash
# Restart server untuk apply perubahan
npm start
```

### Production
```bash
# Pastikan environment variable sudah di-set
export TZ=Asia/Jakarta

# Start server
npm run start
```

### Docker (jika menggunakan)
```dockerfile
# Tambahkan di Dockerfile
ENV TZ=Asia/Jakarta
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
```

---

## 📌 Catatan Penting

### ✅ Keuntungan Opsi Ini (Server-side Timezone)
- Konsisten untuk semua user
- Sederhana implementasi
- Cocok untuk aplikasi single-location (kantor)
- Mudah debugging (waktu di DB sudah WIB)

### ⚠️ Limitasi
- Tidak fleksibel jika ada user dari timezone lain
- Jika server dipindah ke region lain, perlu restart

### 🔄 Alternatif (Jika Butuh Multi-Timezone)
Jika di masa depan aplikasi perlu support multi-timezone:
1. Simpan semua tanggal dalam UTC di database
2. Convert ke WIB (atau timezone user) saat display
3. Gunakan library seperti `moment-timezone` atau `date-fns-tz`

---

## 🐛 Troubleshooting

### Problem: Waktu masih tidak sesuai setelah restart
**Solution:**
```bash
# Pastikan environment variable ter-set
node -p "process.env.TZ"
# Harus output: Asia/Jakarta

# Atau cek di aplikasi
curl http://localhost:5000/api/health
```

### Problem: Waktu di database berbeda dengan display
**Solution:**
- Pastikan data lama sudah di-migrate (jika ada)
- Data baru akan otomatis tersimpan dalam WIB
- Data lama mungkin perlu konversi manual

### Problem: Browser masih menampilkan waktu lokal
**Solution:**
- Clear browser cache
- Hard reload (Ctrl + Shift + R)
- Pastikan JS sudah terupdate dengan fungsi baru

---

## 📚 Referensi

### JavaScript Date & Timezone
- [MDN - toLocaleString](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleString)
- [MDN - Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)

### Node.js Timezone
- [Node.js Process Environment](https://nodejs.org/api/process.html#process_process_env)
- [TZ Environment Variable](https://www.gnu.org/software/libc/manual/html_node/TZ-Variable.html)

### SQLite DateTime
- [SQLite Date And Time Functions](https://www.sqlite.org/lang_datefunc.html)

---

## 📞 Kontak

Jika ada pertanyaan atau issue terkait timezone:
1. Cek console browser untuk error JavaScript
2. Cek server logs untuk error backend
3. Pastikan semua file sudah terupdate

---

**Status:** ✅ IMPLEMENTED  
**Last Updated:** 2024  
**Next Review:** Saat ada kebutuhan multi-timezone support