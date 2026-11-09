# Mobile Cellular Quota Monitor 📱

CLI & Service berbasis Node.js & TypeScript untuk memonitor sisa pulsa, masa aktif, dan rincian kuota internet dari operator seluler Indonesia:
- **Tri (3 / Three - Bima+ IOH)** *(Live API teruji)*
- **Telkomsel (MyTelkomsel)**
- **Indosat (myIM3)**

---

## 🚀 Fitur Utama

- **Live Tri Bima+ IOH Integration**: Terhubung langsung ke API resmi Bima+ IOH (`https://bimaplus-api.ioh.co.id/api/v2/dashboard/get/v4`) dengan kalkulasi kriptografi SHA-512 request signature dinamis.
- **Interactive CLI Menu**: Menu konsol lengkap untuk melihat kuota, menambah nomor baru, menghapus nomor, login sesi, dan mengganti mode (Live / Mock).
- **Automated Browser Login with Network Inspector**: Fitur login otomatis via Google Chrome / Microsoft Edge (Incognito) menggunakan Puppeteer Core. Token sesi ditangkap langsung dari response web tanpa perlu salin cURL manual.
- **Interactive OTP Login via Terminal**: Opsi login langsung lewat terminal melalui SMS OTP (`/api/v2/otp/send/v1` & `/api/v2/otp/validate/v1`).
- **Automatic Long-Term Session Persistence**: Sesi login resmi tersimpan di `session_tri.json` (berlaku hingga ~10 hari). Pengecekan berikutnya tidak memerlukan OTP lagi sehingga pulsa dan attempt aman.
- **Multi-Account Support**: Mendukung banyak nomor Tri sekaligus (`TRI_PHONE_NUMBER`, `TRI_2_PHONE_NUMBER`, dst).
- **Data Normalization**: Nomor HP distandarisasi ke format nasional (`08xxxxxxxxxx`) dan tanggal ke format ISO (`YYYY-MM-DD`).
- **Dual Mode (Mock / Live)**: Mode mock siap pakai untuk testing offline, dan mode live untuk memanggil API operator asli.

---

## 📁 Struktur Direktori

```text
mobile-cellular/
├── .env.example              # Template konfigurasi environment
├── .env                      # Konfigurasi aktif lokal (gitignored)
├── session_tri.json          # Tempat penyimpanan sesi token otomatis (local & gitignored)
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── types/
    │   └── index.ts          # Interface QuotaReport & OperatorAdapter
    ├── utils/
    │   ├── crypto.ts         # Rumus SHA-512 dinamis untuk header x-imi-oauth & x-imi-hash
    │   ├── format.ts         # Normalisasi format no HP & tanggal YYYY-MM-DD
    │   ├── session.ts        # Manager penyimpanan & validasi sesi JWT lokal
    │   └── config.ts         # Helper manajemen konfigurasi nomor di .env
    ├── adapters/
    │   ├── base.ts           # Abstract BaseOperatorAdapter
    │   ├── telkomsel.ts      # Adapter Telkomsel
    │   ├── tri.ts            # Adapter Tri Bima+ (OTP flow & quota check)
    │   └── indosat.ts        # Adapter Indosat IM3
    ├── browser_login.ts      # Browser automation & network inspector
    └── index.ts              # Entry point CLI Runner & Menu Interaktif
```

---

## 🛠️ Cara Menjalankan

### 1. Masuk ke Menu Interaktif
```bash
npm start
# atau
npm run dev
```

Menu yang tersedia:
```text
1. 📊 Cek & Tampilkan Kuota (Display All)
2. ➕ Tambah Nomor Baru (Add New Number)
3. 🔑 Login / Hubungkan Sesi Tri (Session Manager)
4. 🗑️  Hapus Nomor Terdaftar (Remove Number)
5. ⚙️  Ganti Mode (Switch LIVE <-> MOCK)
0. 🚪 Keluar (Exit)
```

### 2. Pengecekan Langsung (Non-Interaktif)
Berguna untuk automasi script terjadwal / cron:
```bash
npm start -- --check
```

### 3. Login Browser Tri Mandiri
```bash
npm run login:browser
```

### 4. Build Production (CLI)
```bash
npm run build
```

---

## 📱 Aplikasi Mobile Android (Capacitor + Vite + Tailwind CSS)

Project ini juga dilengkapi layer **Mobile-First Web Dashboard** di folder `./web` dan konfigurasi **Capacitor Android** (`com.fahim.quotamonitor` / **Quota Monitor**).

### Menjalankan Preview Web Dashboard (Development)
```bash
npm run dev:web
```
Buka `http://localhost:5173` di browser.

### Build & Sync ke Android APK
```bash
# 1. Build bundle web ke folder dist-web/
npm run build:web

# 2. Sinkronisasi aset web & plugin ke project native Android
npm run cap:sync

# 3. Buka project di Android Studio untuk build / run APK
npm run cap:open
```
Di dalam Android Studio, pilih menu **Build > Build Bundle(s) / APK(s) > Build APK(s)** untuk menghasilkan file `app-debug.apk`.
