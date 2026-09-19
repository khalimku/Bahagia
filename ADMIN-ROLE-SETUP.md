# Admin role management

Jalankan `admin-role-migration.sql` di Supabase SQL Editor setelah `supabase-schema.sql`.

Admin akan melihat kartu **Kelola Pengguna** di Admin Panel dan dapat mengubah role pengguna menjadi `Pengguna` atau `Admin`. Akun admin yang sedang login tidak dapat menurunkan rolenya sendiri. Keamanan tetap ditegakkan oleh policy RLS, bukan hanya oleh tampilan frontend.
