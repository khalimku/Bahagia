# Webook Bahagia V2 — Login + Admin

## Arsitektur

Browser
→ Supabase Auth (Email/Password + Google)
→ PostgreSQL (profiles, ebooks, builder_pages, site_settings)
→ Supabase Storage (bucket `ebooks`)

## 1. Buat project Supabase
Buat project baru di Supabase.

## 2. Jalankan database
Buka SQL Editor → paste seluruh isi `supabase-schema.sql` → Run.

## 3. Aktifkan Email
Authentication → Providers → Email → aktifkan.

Jika ingin tanpa konfirmasi email pada tahap testing, atur Confirm email sesuai kebutuhan. Untuk produksi, sebaiknya gunakan email confirmation.

## 4. Aktifkan Google
Authentication → Providers → Google.
Masukkan Google OAuth Client ID dan Client Secret dari Google Cloud Console.
Tambahkan callback URL yang diberikan Supabase ke Google OAuth.

Untuk hosting, tambahkan domain website Anda pada URL configuration / redirect URL Supabase.

## 5. Isi config.js
Ganti:
- SUPABASE_URL
- SUPABASE_ANON_KEY

Gunakan hanya anon/publishable key di browser.
JANGAN masukkan service_role key ke config.js.

## 6. Jadikan akun Anda admin
Daftar akun dari website terlebih dahulu.
Ambil UUID akun dari Authentication → Users.
Kemudian jalankan:

update public.profiles
set role='admin'
where id='UUID-AKUN-ANDA';

Setelah login ulang, menu Admin Panel muncul.

## 7. Fungsi admin
Versi ini sudah menyiapkan:
- role admin
- pengaturan nama website
- email copyright
- statistik pengguna
- statistik ebook
- kontrol melalui RLS
- admin dapat mengakses data yang diizinkan

## 8. Yang bisa ditambahkan pada tahap berikutnya
- Admin mengelola semua ebook
- Admin blokir / hapus pengguna
- Admin membuat kategori
- Ebook publik memiliki URL seperti /read/judul-ebook
- reader PDF/EPUB di browser
- pembayaran / paket premium
- kuota storage per pengguna
- analytics pembaca
- halaman landing page publik
- custom domain
- email reset password
- verifikasi email

## Hak cipta
© 2026 BONTEKU1 · bonteku1@gmail.com · Seluruh hak cipta.

Notice hak cipta tidak sama dengan pendaftaran hak cipta dan bukan nasihat hukum.
