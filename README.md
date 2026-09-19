# Bahagia
Studio Bahagia energi tanpa batas.

## Menjalankan
1. Buka `config.js`, isi `supabaseUrl` dan `supabaseAnonKey` dari Supabase (gunakan anon key saja).
2. Jalankan `supabase-schema.sql` di Supabase SQL Editor.
3. Aktifkan Email provider di Authentication. Google dapat diaktifkan setelah OAuth callback disiapkan.
4. Deploy seluruh file, termasuk `app.js` dan `config.js`.

Tanpa konfigurasi Supabase, aplikasi berjalan dalam **mode lokal** agar admin dan pengguna tetap dapat mencoba alur masuk, daftar, upload, dan builder. Akun pertama otomatis menjadi admin; mode ini hanya untuk demo dan datanya tersimpan di browser.
