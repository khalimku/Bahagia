# Webook Bahagia

## Login dan daftar dengan Google

Aplikasi mendukung login sekaligus pendaftaran akun baru melalui Google OAuth Supabase. Google tidak memerlukan alur signup terpisah: jika email Google belum ada, Supabase membuat akun; jika sudah ada, pengguna langsung login.

### Konfigurasi Supabase

1. Buat atau buka project di Supabase.
2. Jalankan `supabase-schema.sql`, lalu jalankan `admin-role-migration.sql`.
3. Buka **Authentication → Providers → Google** dan aktifkan provider.
4. Buat OAuth Client ID tipe **Web application** di Google Cloud Console.
5. Pada Google Cloud, tambahkan **Authorized redirect URI** yang diberikan Supabase pada halaman provider Google. Format umumnya:

   `https://<project-ref>.supabase.co/auth/v1/callback`

6. Di Supabase, buka **Authentication → URL Configuration**:
   - tambahkan URL aplikasi yang diizinkan, misalnya `https://username.github.io/Bahagia/`
   - tambahkan URL preview Codespaces atau domain production bila digunakan
7. Isi `config.js` dengan **Project URL** dan **publishable/anon key**. Jangan pernah menggunakan `service_role` key di browser.
8. Jika URL production berbeda dari URL aktif, isi `authRedirectUrl` dengan URL lengkap aplikasi, misalnya `https://username.github.io/Bahagia/`.

### Perilaku akun Google

- Google user baru otomatis mendapat profile dengan role `user` melalui trigger `handle_new_user()`.
- Untuk menjadikan akun Google sebagai admin, jalankan dari SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'email-google-anda@gmail.com';
```

- Setelah perubahan role, logout lalu login kembali agar session dan tampilan diperbarui.
- Jangan menjadikan role admin berdasarkan email di frontend; role harus berasal dari `public.profiles` dan dilindungi RLS.

## Setup dasar

1. Jalankan seluruh isi `supabase-schema.sql` di Supabase SQL Editor.
2. Jalankan `admin-role-migration.sql` untuk mengaktifkan perlindungan role dan settings.
3. Aktifkan Email provider jika login email/password juga diperlukan.
4. Isi `config.js` dengan URL dan publishable/anon key.
5. Pastikan bucket `ebooks` dibuat oleh SQL.

Tanpa konfigurasi Supabase, mode lokal tetap tersedia untuk demo; mode lokal tidak cocok untuk produksi.
