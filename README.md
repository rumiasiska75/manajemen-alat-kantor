# Sistem Manajemen Alat Kantor dengan QR Code

Aplikasi web modern untuk mengelola keluar masuknya alat kantor menggunakan teknologi QR Code. Sistem ini memudahkan admin dalam mengelola inventaris dan pengguna dalam meminjam/mengembalikan alat dengan cara yang praktis dan efisien.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)
![Version](https://img.shields.io/badge/version-1.0.0-orange)

## 📋 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Teknologi yang Digunakan](#-teknologi-yang-digunakan)
- [Prasyarat](#-prasyarat)
- [Instalasi](#-instalasi)
- [Konfigurasi](#-konfigurasi)
- [Menjalankan Aplikasi](#-menjalankan-aplikasi)
- [Panduan Penggunaan](#-panduan-penggunaan)
- [API Documentation](#-api-documentation)
- [Struktur Project](#-struktur-project)
- [Screenshots](#-screenshots)
- [Troubleshooting](#-troubleshooting)
- [Kontribusi](#-kontribusi)
- [License](#-license)

## ✨ Fitur Utama

### Untuk Admin
- ✅ Dashboard statistik dan monitoring
- ✅ Manajemen alat (CRUD operations)
- ✅ Generate QR Code otomatis untuk setiap alat
- ✅ Download QR Code untuk dicetak
- ✅ Monitoring peminjaman real-time
- ✅ Approve/reject peminjaman
- ✅ Manajemen kondisi alat
- ✅ Riwayat aktivitas lengkap
- ✅ Filter dan pencarian advanced

### Untuk User
- ✅ Scan QR Code dengan kamera
- ✅ Keranjang peminjaman (seperti e-commerce)
- ✅ Upload foto bukti peminjaman
- ✅ Riwayat peminjaman pribadi
- ✅ Pengembalian alat dengan foto bukti
- ✅ Update kondisi alat saat pengembalian
- ✅ Dashboard pribadi

### Fitur Teknis
- ✅ Autentikasi dengan JWT
- ✅ Role-based access control (Admin/User)
- ✅ Responsive design (Mobile-first)
- ✅ Real-time QR scanning
- ✅ Image upload & optimization
- ✅ RESTful API
- ✅ SQLite database (mudah deploy)
- ✅ Activity logging

## 🛠 Teknologi yang Digunakan

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **SQLite3** - Database (portable & lightweight)
- **JWT** - Authentication
- **Bcrypt.js** - Password hashing
- **QRCode** - QR code generation
- **Multer** - File upload handling
- **Dotenv** - Environment configuration

### Frontend
- **HTML5** - Markup
- **CSS3** - Styling dengan custom properties
- **Vanilla JavaScript** - No framework dependency
- **HTML5-QRCode** - QR scanner library
- **Font Awesome** - Icons
- **Responsive Design** - Mobile-friendly

## 📦 Prasyarat

Sebelum memulai, pastikan Anda telah menginstall:

- **Node.js** (v14.0.0 atau lebih tinggi)
- **npm** (biasanya sudah terinstall dengan Node.js)
- **Git** (opsional, untuk clone repository)
- **Browser modern** dengan support kamera (untuk QR scanning)

## 🚀 Instalasi

### 1. Clone atau Download Project

```bash
# Clone dengan Git
git clone https://github.com/yourusername/manajemen-alat-kantor.git
cd manajemen-alat-kantor

# Atau download ZIP dan extract
```

### 2. Install Dependencies Backend

```bash
cd backend
npm install
```

### 3. Setup Environment Variables

Buat file `.env` di folder `backend` atau edit yang sudah ada:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-very-secret-key-change-this-in-production
JWT_EXPIRES_IN=24h

# Database Configuration
DB_PATH=./database.sqlite

# Upload Configuration
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads
QRCODE_PATH=./qrcodes

# CORS Configuration
FRONTEND_URL=http://localhost:5000

# Admin Default Account
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123
DEFAULT_ADMIN_EMAIL=admin@kantor.com
```

⚠️ **PENTING**: Ganti `JWT_SECRET` dengan string random yang aman di production!

### 4. Inisialisasi Database

Database akan otomatis dibuat saat pertama kali menjalankan server.

## ⚙️ Konfigurasi

### Konfigurasi Port

Edit `PORT` di file `.env` jika port 5000 sudah digunakan:

```env
PORT=3000
```

### Konfigurasi Upload

Ukuran maksimal file upload bisa diubah di `.env`:

```env
MAX_FILE_SIZE=10485760  # 10MB dalam bytes
```

### Akun Admin Default

Akun admin akan otomatis dibuat dengan kredensial:

```
Username: admin
Password: admin123
Email: admin@kantor.com
```

⚠️ **Segera ganti password default setelah login pertama!**

## 🎯 Menjalankan Aplikasi

### Development Mode

```bash
cd backend
npm run dev
```

Server akan berjalan di: `http://localhost:5000`

### Production Mode

```bash
cd backend
npm start
```

### Mengakses Aplikasi

Buka browser dan akses:
```
http://localhost:5000
```

## 📖 Panduan Penggunaan

### Untuk Admin

#### 1. Login
- Buka aplikasi di browser
- Login dengan akun admin default atau yang sudah dibuat
- Anda akan diarahkan ke dashboard admin

#### 2. Menambah Alat Baru
1. Klik menu **Alat** di navbar
2. Klik tombol **+ Tambah Alat**
3. Isi form:
   - Kode Alat (unik, contoh: LPT-001)
   - Nama Alat
   - Kategori (contoh: Laptop, Proyektor, dll)
   - Jumlah
   - Kondisi
   - Lokasi (opsional)
   - Deskripsi (opsional)
   - Upload foto (opsional)
4. Klik **Simpan**
5. QR Code akan otomatis dibuat

#### 3. Download QR Code
1. Klik alat yang ingin didownload QR-nya
2. Scroll ke bawah ke bagian QR Code
3. Klik **Download QR Code**
4. Cetak dan tempel di alat fisik

#### 4. Monitoring Peminjaman
1. Klik menu **Peminjaman**
2. Filter berdasarkan status (Aktif, Pending, Dikembalikan)
3. Klik card peminjaman untuk detail
4. Approve/reject peminjaman jika diperlukan

### Untuk User

#### 1. Registrasi & Login
1. Klik **Daftar di sini**
2. Isi data lengkap
3. Login dengan akun yang sudah dibuat

#### 2. Meminjam Alat
1. Klik menu **Pinjam Alat**
2. Klik **Mulai Scan**
3. Arahkan kamera ke QR Code alat
4. Alat akan otomatis masuk keranjang
5. Scan alat lainnya jika perlu
6. Isi tanggal pengembalian (opsional)
7. Tambahkan catatan (opsional)
8. **Ambil foto** semua alat yang dipinjam
9. Klik **Konfirmasi Peminjaman**

#### 3. Mengembalikan Alat
1. Klik menu **Riwayat**
2. Pilih peminjaman yang aktif
3. Klik **Kembalikan**
4. Pilih kondisi setiap alat
5. Tambahkan catatan jika ada kerusakan
6. Upload foto bukti pengembalian
7. Klik **Konfirmasi Pengembalian**

## 📡 API Documentation

### Authentication

#### POST `/api/auth/register`
Registrasi user baru

**Request Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "full_name": "John Doe",
  "phone": "081234567890",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registrasi berhasil",
  "data": {
    "user": { ... },
    "token": "jwt_token_here"
  }
}
```

#### POST `/api/auth/login`
Login user

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

### Tools

#### GET `/api/tools`
Get semua alat (dengan filter opsional)

**Query Parameters:**
- `category` - Filter by category
- `condition` - Filter by condition
- `search` - Search by name/code
- `available` - Filter available only (true/false)

**Headers:**
```
Authorization: Bearer <token>
```

#### POST `/api/tools`
Tambah alat baru (Admin only)

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `tool_code` - Kode unik alat
- `name` - Nama alat
- `category` - Kategori
- `quantity` - Jumlah
- `condition` - Kondisi
- `image` - File gambar (opsional)

### Borrowings

#### POST `/api/borrowings`
Buat peminjaman baru

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `items` - JSON array of tools
- `expected_return_date` - Tanggal rencana kembali
- `notes` - Catatan
- `photo_evidence` - Foto bukti

#### PUT `/api/borrowings/:id/return`
Kembalikan alat

Untuk dokumentasi API lengkap, jalankan server dan akses: `/api/docs`

## 📁 Struktur Project

```
manajemen-alat-kantor/
├── backend/
│   ├── middleware/
│   │   └── auth.js           # Authentication middleware
│   ├── routes/
│   │   ├── auth.js           # Auth routes
│   │   ├── tools.js          # Tools routes
│   │   └── borrowings.js     # Borrowing routes
│   ├── uploads/              # Uploaded images
│   ├── qrcodes/              # Generated QR codes
│   ├── database.js           # Database setup
│   ├── server.js             # Main server file
│   ├── package.json          # Dependencies
│   └── .env                  # Environment config
│
├── frontend/
│   ├── css/
│   │   └── style.css         # Main stylesheet
│   ├── js/
│   │   ├── config.js         # API configuration
│   │   ├── auth.js           # Auth functions
│   │   ├── admin.js          # Admin functions
│   │   ├── user.js           # User functions
│   │   └── app.js            # Main app logic
│   ├── images/               # Static images
│   └── index.html            # Main HTML
│
└── README.md                 # This file
```

## 📸 Screenshots

### Login Page
> Modern dan user-friendly authentication interface

### Admin Dashboard
> Real-time statistics dan monitoring sistem

### QR Code Management
> Generate dan download QR code untuk setiap alat

### QR Scanner
> Scan QR code dengan kamera untuk peminjaman

### Borrowing Cart
> Keranjang peminjaman seperti e-commerce

## 🔧 Troubleshooting

### Error: Port already in use
```bash
# Ganti port di .env
PORT=3001
```

### Error: Cannot access camera
- Pastikan browser memiliki permission kamera
- Gunakan HTTPS atau localhost
- Cek device camera compatibility

### Error: Database locked
```bash
# Stop semua instance server yang berjalan
# Delete database.sqlite dan restart
```

### QR Code tidak terbaca
- Pastikan QR code jelas dan tidak buram
- Cek pencahayaan saat scan
- Gunakan kamera belakang jika ada

### Upload gagal
- Cek ukuran file (max 5MB default)
- Pastikan format file: JPG, PNG, WebP
- Cek permission folder uploads

## 🤝 Kontribusi

Kontribusi sangat diterima! Berikut cara berkontribusi:

1. Fork project ini
2. Buat branch baru (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

## 📝 To-Do List

- [ ] Notifikasi real-time dengan WebSocket
- [ ] Export laporan PDF
- [ ] Multi-language support
- [ ] Dark mode
- [ ] Mobile app (React Native)
- [ ] Barcode support
- [ ] Email notifications
- [ ] Advanced reporting & analytics
- [ ] Backup & restore database

## 🔐 Security

- JWT token authentication
- Password hashing dengan bcrypt
- Input validation & sanitization
- SQL injection protection
- XSS protection
- CORS configuration
- File upload validation

**Best Practices:**
- Ganti JWT_SECRET di production
- Gunakan HTTPS di production
- Regular backup database
- Update dependencies secara berkala
- Monitor logs untuk aktivitas mencurigakan

## 🚀 Deployment

### Deploy ke VPS/Server

```bash
# Install PM2
npm install -g pm2

# Start dengan PM2
cd backend
pm2 start server.js --name "manajemen-alat"

# Set auto-restart
pm2 startup
pm2 save
```

### Deploy ke Heroku

```bash
# Install Heroku CLI
# Login
heroku login

# Create app
heroku create nama-app-anda

# Deploy
git push heroku main

# Set environment variables
heroku config:set JWT_SECRET=your-secret-key
```

## 👥 Tim Pengembang

- **Developer** - Initial work

## 📄 License

Project ini dilisensikan di bawah MIT License - lihat file [LICENSE](LICENSE) untuk detail.

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/)
- [SQLite](https://www.sqlite.org/)
- [QRCode.js](https://github.com/soldair/node-qrcode)
- [HTML5-QRCode](https://github.com/mebjas/html5-qrcode)
- [Font Awesome](https://fontawesome.com/)

---

## 📞 Support

Jika Anda mengalami masalah atau memiliki pertanyaan:

1. Cek [Troubleshooting](#-troubleshooting) section
2. Buka [Issue](https://github.com/yourusername/manajemen-alat-kantor/issues)
3. Email: support@example.com

---

**Made with ❤️ for better office equipment management**

**Version:** 1.0.0  
**Last Updated:** 2024