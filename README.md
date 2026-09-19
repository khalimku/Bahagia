# Bahagia

## Setup Supabase
1. Jalankan seluruh isi `supabase-schema.sql` di Supabase SQL Editor.
2. Aktifkan Email provider; nonaktifkan konfirmasi email hanya untuk testing bila diperlukan.
3. Isi `config.js` dengan `supabaseUrl` dan **anon/publishable key**. Jangan gunakan `service_role` key.
4. Pastikan bucket `ebooks` dibuat oleh SQL. File tersimpan private dengan path berdasarkan user ID.
5. Daftarkan akun, lalu jadikan admin hanya dari SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'admin@contoh.com';
```

Admin panel membaca statistik dan pengaturan dari Supabase. Pengguna hanya dapat membaca ebook miliknya atau ebook publik, dan hanya dapat mengunggah ke folder miliknya. Semua pembatasan ditegakkan oleh RLS dan Storage policies, bukan oleh UI.

Tanpa konfigurasi Supabase, mode lokal tetap tersedia untuk demo; mode lokal tidak cocok untuk produksi.
