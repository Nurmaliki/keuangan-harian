# Keuangan Harian — Local First

Web app pencatatan keuangan harian tanpa backend. Data disimpan di IndexedDB browser melalui Dexie.

## Fitur
- Dashboard saldo, pemasukan, pengeluaran, transaksi terbaru
- Input transaksi manual
- Edit transaksi dan transfer antar-akun
- OCR struk via Tesseract.js di browser
- Penyimpanan foto struk di IndexedDB
- Kategori dan akun/dompet
- Pencarian/filter transaksi
- Anggaran bulanan dengan peringatan 80%/100%
- Laporan per minggu/bulan/tahun/rentang tanggal, tren, kategori, merchant, dan saving rate
- Export Excel, CSV, JSON
- Backup & restore database lokal
- Light / dark / system theme
- Responsive desktop + mobile
- Static deploy / PWA-ready manifest
- Offline status, install prompt, update prompt, dan persistent storage

## Menjalankan
```bash
npm install
npm run dev
```
Buka URL yang tampil di terminal, biasanya `http://localhost:5173`.

## Build production
```bash
npm run build
npm run preview
```

Gunakan Node.js 22.12 atau lebih baru dalam major 22 (`nvm use`).

## Quality checks
```bash
npm run check
npm test
npm run build
```

CI GitHub Actions menjalankan ketiga pemeriksaan tersebut pada setiap push dan pull request.

## Catatan penyimpanan
IndexedDB bukan cache HTTP biasa. Namun user tetap dapat kehilangan data jika menghapus site data/browser storage, memakai private/incognito mode, atau mengganti perangkat. Gunakan Backup JSON secara berkala. Restore mendukung mode mengganti atau menggabungkan data dan membuat snapshot otomatis sebelum restore.

## OCR
OCR dilakukan oleh Tesseract.js di browser. Hasil OCR harus selalu ditampilkan untuk koreksi sebelum transaksi disimpan karena akurasi bergantung kualitas foto/struk.
