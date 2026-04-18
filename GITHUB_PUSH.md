# 🚀 Panduan Push ke GitHub

Panduan lengkap untuk upload project Manajemen Alat Kantor ke GitHub.

## 📋 Prasyarat

- Akun GitHub (buat di https://github.com jika belum punya)
- Git terinstall di komputer (download dari https://git-scm.com)
- Project sudah ada di `D:\AIPROJ\Manajemen Gudang`

## 🔧 Langkah 1: Install Git (Jika Belum)

1. Download Git dari: https://git-scm.com/download/win
2. Install dengan pengaturan default
3. Restart Command Prompt/PowerShell

Verifikasi instalasi:
```cmd
git --version
```

## 🌐 Langkah 2: Buat Repository di GitHub

1. Login ke GitHub (https://github.com)
2. Klik tombol **"+"** di kanan atas → **"New repository"**
3. Isi form:
   - **Repository name**: `manajemen-alat-kantor` (atau nama lain)
   - **Description**: `Sistem Manajemen Keluar Masuk Alat Kantor dengan QR Code`
   - **Visibility**: 
     - ✅ **Public** (jika ingin dibagikan)
     - ⚪ **Private** (jika hanya untuk pribadi/tim)
   - ❌ **JANGAN** centang "Initialize this repository with a README" (karena kita sudah punya)
4. Klik **"Create repository"**
5. **JANGAN TUTUP HALAMAN INI** - simpan URL repository (misal: `https://github.com/username/manajemen-alat-kantor.git`)

## 💻 Langkah 3: Konfigurasi Git di Komputer

Buka **Command Prompt** atau **PowerShell** dan jalankan:

```cmd
# Set username (ganti dengan username GitHub Anda)
git config --global user.name "YourGitHubUsername"

# Set email (ganti dengan email GitHub Anda)
git config --global user.email "your.email@example.com"
```

**Contoh:**
```cmd
git config --global user.name "johndoe"
git config --global user.email "john@example.com"
```

## 📦 Langkah 4: Inisialisasi Git di Project

```cmd
# Masuk ke folder project
cd "D:\AIPROJ\Manajemen Gudang"

# Inisialisasi Git
git init

# Verifikasi .gitignore sudah ada
dir .gitignore
```

## ➕ Langkah 5: Add & Commit Files

```cmd
# Tambahkan semua file ke staging
git add .

# Commit dengan pesan
git commit -m "Initial commit: Sistem Manajemen Alat Kantor dengan QR Code"
```

**Pesan akan muncul:**
```
[master (root-commit) xxxxxx] Initial commit: Sistem Manajemen Alat Kantor dengan QR Code
XX files changed, XXXX insertions(+)
```

## 🔗 Langkah 6: Hubungkan ke GitHub Repository

Ganti `username` dan `repository-name` dengan milik Anda:

```cmd
# Tambahkan remote repository
git remote add origin https://github.com/username/manajemen-alat-kantor.git

# Verifikasi remote
git remote -v
```

**Output yang benar:**
```
origin  https://github.com/username/manajemen-alat-kantor.git (fetch)
origin  https://github.com/username/manajemen-alat-kantor.git (push)
```

## 🚀 Langkah 7: Push ke GitHub

```cmd
# Rename branch ke main (standar GitHub baru)
git branch -M main

# Push ke GitHub
git push -u origin main
```

### Jika Muncul Authentication

#### Cara 1: HTTPS (Recommended untuk pemula)

Anda akan diminta login:
1. **Windows**: Pop-up credential manager akan muncul
2. Masukkan username GitHub Anda
3. Masukkan **Personal Access Token** (bukan password!)

**Cara membuat Personal Access Token:**
1. Buka: https://github.com/settings/tokens
2. Klik **"Generate new token"** → **"Generate new token (classic)"**
3. **Note**: `Git Access Token`
4. **Expiration**: Pilih durasi (90 days recommended)
5. **Scopes**: Centang **`repo`** (full control)
6. Klik **"Generate token"**
7. **COPY TOKEN** (hanya muncul sekali!) → simpan di tempat aman
8. Gunakan token ini sebagai password

#### Cara 2: SSH (Advanced)

```cmd
# Generate SSH key
ssh-keygen -t ed25519 -C "your.email@example.com"

# Tekan Enter 3x (gunakan default)

# Copy public key
type %USERPROFILE%\.ssh\id_ed25519.pub
```

Kemudian:
1. Copy output SSH key
2. Buka: https://github.com/settings/keys
3. Klik **"New SSH key"**
4. Paste key → Klik **"Add SSH key"**

Ubah remote ke SSH:
```cmd
git remote set-url origin git@github.com:username/manajemen-alat-kantor.git
git push -u origin main
```

## ✅ Langkah 8: Verifikasi

1. Refresh halaman GitHub repository Anda
2. Semua file harus terlihat
3. README.md akan otomatis ditampilkan

## 🔄 Update di Kemudian Hari

Setelah melakukan perubahan pada code:

```cmd
# Cek status perubahan
git status

# Tambahkan semua perubahan
git add .

# Commit dengan pesan deskriptif
git commit -m "Deskripsi perubahan Anda"

# Push ke GitHub
git push
```

**Contoh commit message yang baik:**
```cmd
git commit -m "Fix: Bug QR scanner di mobile browser"
git commit -m "Feature: Tambah export PDF untuk laporan"
git commit -m "Update: Improve UI dashboard admin"
```

## 📝 Tips & Best Practices

### 1. .gitignore Sudah Benar
File berikut **TIDAK** akan di-push (sudah ada di .gitignore):
- ✅ `node_modules/` (dependencies)
- ✅ `.env` (credentials)
- ✅ `database.sqlite` (data lokal)
- ✅ `backend/uploads/*` (file upload)
- ✅ `backend/qrcodes/*` (QR codes)

### 2. Jangan Push File Sensitif
❌ **JANGAN PUSH:**
- Password atau API keys
- Database dengan data real
- File `.env`
- File pribadi/konfidensial

### 3. Commit Secara Teratur
```cmd
# Bad
git commit -m "update"
git commit -m "fix"

# Good
git commit -m "Fix: QR scanner error on Firefox browser"
git commit -m "Feature: Add email notification for borrowing"
```

### 4. Branching untuk Fitur Baru
```cmd
# Buat branch baru untuk fitur
git checkout -b feature/email-notification

# Setelah selesai development
git add .
git commit -m "Feature: Add email notification"
git push -u origin feature/email-notification

# Di GitHub, buat Pull Request
# Merge ke main setelah review
```

## 🛠 Troubleshooting

### Error: "fatal: remote origin already exists"
```cmd
git remote remove origin
git remote add origin https://github.com/username/manajemen-alat-kantor.git
```

### Error: "failed to push some refs"
```cmd
# Pull terlebih dahulu
git pull origin main --allow-unrelated-histories

# Lalu push lagi
git push -u origin main
```

### Error: "Authentication failed"
- Pastikan menggunakan **Personal Access Token**, bukan password
- Token harus memiliki scope `repo`
- Cek apakah token sudah expired

### Error: "Permission denied (publickey)"
```cmd
# Cek SSH key
ssh -T git@github.com

# Jika gagal, gunakan HTTPS
git remote set-url origin https://github.com/username/manajemen-alat-kantor.git
```

### Lupa Commit Message
```cmd
# Edit commit message terakhir
git commit --amend -m "New commit message"

# Jika sudah push
git push --force
```

### Undo Commit Terakhir (Belum Push)
```cmd
# Undo commit tapi file tetap ada
git reset --soft HEAD~1

# Undo commit dan file hilang (HATI-HATI!)
git reset --hard HEAD~1
```

## 🌟 Setelah Push Berhasil

### 1. Tambahkan Description & Topics di GitHub
1. Buka repository di GitHub
2. Klik **"Add description"**
3. Klik **"Manage topics"** → Tambahkan:
   - `qr-code`
   - `inventory-management`
   - `nodejs`
   - `express`
   - `sqlite`
   - `office-equipment`

### 2. Buat Badge di README
GitHub akan otomatis menampilkan badge untuk:
- Stars
- Forks
- Issues
- License

### 3. Enable GitHub Pages (Optional)
Jika ingin host frontend secara gratis:
1. Settings → Pages
2. Source: Deploy from a branch
3. Branch: main → /frontend
4. Save

### 4. Set Up Actions (Optional)
Untuk CI/CD automation:
```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-node@v2
      with:
        node-version: '18'
    - run: cd backend && npm install
    - run: cd backend && npm test
```

## 📚 Resources

- **Git Documentation**: https://git-scm.com/doc
- **GitHub Docs**: https://docs.github.com
- **GitHub Desktop** (GUI): https://desktop.github.com
- **GitKraken** (GUI Alternative): https://www.gitkraken.com

## ✅ Checklist Push

- [ ] Git terinstall (`git --version` works)
- [ ] Repository dibuat di GitHub
- [ ] Git configured (`user.name` & `user.email`)
- [ ] `git init` di folder project
- [ ] `git add .` semua file
- [ ] `git commit -m "Initial commit"`
- [ ] Remote origin ditambahkan
- [ ] `git push -u origin main` berhasil
- [ ] Files terlihat di GitHub
- [ ] README.md tampil dengan baik

## 🎉 Selamat!

Repository Anda sekarang sudah di GitHub! 

**URL Repository:**
```
https://github.com/username/manajemen-alat-kantor
```

Share link ini untuk collaboration atau portfolio!

---

**Quick Reference Commands:**

```cmd
# Status
git status

# Add files
git add .
git add filename.js

# Commit
git commit -m "message"

# Push
git push

# Pull
git pull

# Check branches
git branch

# Create new branch
git checkout -b branch-name

# Switch branch
git checkout main

# View history
git log --oneline

# Undo changes
git restore filename.js
git reset --soft HEAD~1
```

---

**Need Help?**
- GitHub Docs: https://docs.github.com
- Git Cheat Sheet: https://education.github.com/git-cheat-sheet-education.pdf

**Happy Coding! 🚀**