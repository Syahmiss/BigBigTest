# JM Operations — App Android & iPhone (Rust / Tauri 2)

Hub JMC Operations (semua modul HOD Site, HOD Pelan, HOD BIM, HOD Akaun, Inventori, Fail Tracking,
Sebut Harga, Perancangan) dibungkus jadi app native. Shell ditulis dalam **Rust** guna **Tauri 2**;
UI kekal HTML/JS asal kau, jadi logik, Google Sheets CSV dan Apps Script semua sama macam versi web.

```
jm-mobile/
├── web/                  ← salinan repo JurukurMahabob (sumber UI, tak diubah)
├── shim/jm-mobile.js     ← jambatan web ↔ native (download, pautan luar, print)
├── scripts/prepare-web.mjs  ← salin web/ → dist/ + suntik shim ke setiap HTML
├── src-tauri/            ← projek Rust (lib.rs, tauri.conf.json, capabilities)
├── app-icon.png          ← ikon 1024×1024 (navy + emas). Ganti dengan logo sebenar kalau ada
└── .github/workflows/android.yml  ← build APK automatik di GitHub
```

## Apa yang shim buat

| Dalam web | Dalam app |
|---|---|
| Backup JSON, export CSV, PDF jsPDF (`<a download>`) | Dialog **Simpan** native, pilih folder (Downloads, Drive, Files) |
| Pautan Google Sheets / Drive / `window.open` luar | Buka dalam browser telefon |
| Gambar lampiran `data:image` tab baru | Paparan gambar penuh skrin dalam app |
| `window.open` ke modul dalaman | Notis "sudah dibuka dalam aplikasi" (modul dah dalam hub) |
| `window.print()` | Notis belum disokong (lihat Had) |

Bila HTML yang sama dibuka dalam browser biasa, shim tak buat apa-apa.

## Kemas kini UI

Salin fail terbaru repo ke `web/` (ganti terus), kemudian build semula. Tak perlu sentuh Rust.

---

## A. Android (boleh dari Windows/Linux/Mac, atau terus di GitHub)

### Cara paling senang — GitHub Actions
1. Push folder ni ke repo GitHub baru (contoh `JurukurMahabob-app`).
2. Tab **Actions → Build Android APK → Run workflow**.
3. Siap (~15–20 minit kali pertama), muat turun artifact `JM-Operations-android` → `JM-Operations.apk`.
4. Hantar APK ke telefon, install (benarkan "Install unknown apps").

Tanpa secret, workflow buat **APK debug** (cukup untuk test & guna dalaman).
Untuk APK release bertandatangan, buat keystore sekali sahaja:

```bash
keytool -genkey -v -keystore jm-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias jm
base64 -w0 jm-release.jks   # salin output
```
Tambah di **Settings → Secrets → Actions**: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS` (jm),
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`.
⚠️ Simpan `jm-release.jks` + password di tempat selamat. Hilang = tak boleh update app yang sama.

### Build sendiri di PC
Perlu: Node 20+, Rust, Android Studio (SDK + NDK), JDK 17.
```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
# set ANDROID_HOME dan NDK_HOME (contoh: $ANDROID_HOME/ndk/27.x)
npm install
npm run icons
npm run android:init
npm run android:dev        # jalan dalam emulator / telefon (USB debugging)
npm run android:build      # APK di src-tauri/gen/android/app/build/outputs/apk/
```

## B. iPhone (WAJIB Mac + Xcode)

Apple tak benarkan build app iOS selain di macOS.
1. Mac dengan Xcode terkini, `xcode-select --install`, `brew install cocoapods`.
2. `rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios`
3. ```bash
   npm install
   npm run icons
   npm run ios:init
   npm run ios:dev           # simulator atau iPhone sambung kabel
   ```
4. Untuk pasang kekal di iPhone staf: **Apple Developer Program** (USD 99/tahun ≈ RM440–470).
   Set Team dalam Xcode (`src-tauri/gen/apple/*.xcodeproj` → Signing), kemudian
   `npm run ios:build` dan agih melalui **TestFlight** (paling senang untuk staf dalaman).
   Apple ID percuma pun boleh install ke iPhone sendiri, tapi app tamat tempoh setiap 7 hari.

---

## Had & risiko yang perlu tahu

- **Perlu internet.** Tailwind, Chart.js, Bootstrap, Font Awesome, Lucide, PapaParse, jsPDF dimuat
  dari CDN, dan data memang dari Google Sheets. Tanpa line, app tak boleh jalan. (Boleh vendor semua
  library ke dalam app supaya UI terbuka laju walaupun line lemah — langkah seterusnya.)
- **`unpkg.com/lucide@latest`** — versi "latest" boleh berubah bila-bila dan pecahkan ikon. Kunci versi.
- **`cdn.tailwindcss.com`** — Tailwind sendiri kata CDN ni bukan untuk production (lambat, compile di
  telefon). Lebih baik build CSS Tailwind sekali dan bundle.
- **Print** (`window.print`) tak jalan dalam WebView Android/iOS. Penjana Sebut Harga & Fail Tracking
  bergantung pada ni untuk PDF. Penyelesaian: plugin print native kecil (Android PrintManager /
  iOS UIPrintInteractionController) — boleh ditambah.
- **`modules/ops.html` tiada** dalam zip, tapi hub cuba muat (`MODULES.ops`). Ini memang dah rosak dalam
  versi web juga — data "Operasi HOD" akan kosong sampai fail tu ditambah.
- **localStorage** disimpan dalam app (berasingan dari browser). Data lama dalam Chrome telefon tak
  ikut masuk — guna Backup di web, Restore dalam app.
- **CSV "Publish to web"** — sesiapa dengan URL boleh baca data. Membungkus jadi app tak menyembunyikan
  URL tu (boleh diekstrak dari APK). Kalau data sensitif, pindah ke Apps Script dengan token.
- `alert()/confirm()` digunakan di beberapa modul — test pada iPhone sebenar.

## Senarai semak test pertama
- [ ] Hub buka, sidebar & semua modul load
- [ ] Data Google Sheets keluar (Laporan Harian, Status Pelan, Inventori, HOD Akaun)
- [ ] Hantar borang ke Apps Script (Laporan Harian, Status Site, Checklist)
- [ ] Upload gambar (Laporan Harian, Inventori) — kamera & galeri
- [ ] Backup JSON hub → dialog Simpan keluar, fail wujud
- [ ] Export CSV (Kualiti Pelan), PDF (Inventori)
- [ ] Pautan "Database live" buka di browser
- [ ] Butang Back Android
