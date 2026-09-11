# Keuangan Harian — Local First

Web app pencatatan keuangan harian tanpa backend. Data disimpan di IndexedDB browser melalui Dexie.

## Fitur
- Dashboard saldo, pemasukan, pengeluaran, transaksi terbaru
- Input transaksi manual
- OCR struk via Tesseract.js di browser
- Penyimpanan foto struk di IndexedDB
- Kategori dan akun/dompet
- Pencarian/filter transaksi
- Laporan kategori dan saving rate
- Export Excel, CSV, JSON
- Backup & restore database lokal
- Light / dark / system theme
- Responsive desktop + mobile
- Static deploy / PWA-ready manifest

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

## Catatan penyimpanan
IndexedDB bukan cache HTTP biasa. Namun user tetap dapat kehilangan data jika menghapus site data/browser storage, memakai private/incognito mode, atau mengganti perangkat. Gunakan fitur Backup JSON secara berkala.

## OCR
OCR dilakukan oleh Tesseract.js di browser. Hasil OCR harus selalu ditampilkan untuk koreksi sebelum transaksi disimpan karena akurasi bergantung kualitas foto/struk.
