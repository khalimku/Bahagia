# Webook Bahagia v2 — Arsitektur Hak Akses & Peran (RBAC)

Dokumen ini menjelaskan struktur hak akses pengguna (**Pengguna / User**) dan pengelola (**Admin / Owner**) pada platform **Webook Bahagia v2**, mencakup pemetaan antarmuka, kontrol keamanan basis data (Row Level Security), dan rencana pengembangan platform.

---

## 1. Himpunan Peran & Hak Akses

```
WEBOOK BAHAGIA v2
 ├── PENGGUNA (ROLE: 'user')
 │    ├── Authentication (Sign In, Sign Up, OAuth Google)
 │    ├── Upload Ebook (PDF, EPUB, DOC, DOCX max 25MB)
 │    ├── Kelola Ebook Sendiri (Buka, Unduh, Hapus data pribadi)
 │    ├── Interactive Builder (Buat & edit halaman interaktif, tambah blok)
 │    └── Reader (Membaca koleksi & pratinjau mode interaktif)
 │
 └── ADMIN (ROLE: 'admin')
      ├── Semua akses Pengguna
      ├── Admin Panel (Akses khusus `/ #admin`)
      ├── Statistik Pengguna (Total akun terdaftar)
      ├── Statistik Ebook (Total ebook terpublikasi/tersimpan)
      ├── Konfigurasi Branding (Mengubah Nama Website)
      ├── Konfigurasi Legal (Mengubah Email Copyright / Kontak)
      └── Ekstensibilitas Modul Moderasi Platform (Future Extensions)
```

---

## 2. Matriks Akses Fitur (Permissions Matrix)

| Fitur / Modul | Role: `user` | Role: `admin` | Mekanisme Keamanan |
| :--- | :---: | :---: | :--- |
| **Login / Register** | ✅ Ya | ✅ Ya | Supabase Auth API |
| **Dashboard & Stats Pribadi** | ✅ Ya | ✅ Ya | Query filter `owner_id = auth.uid()` |
| **Upload Ebook ke Storage** | ✅ Ya | ✅ Ya | RLS Storage Bucket `ebooks` |
| **Lihat Koleksi Sendiri** | ✅ Ya | ✅ Ya | RLS Query `owner_id = auth.uid()` |
| **Buka / Hapus Ebook Pengguna Lain** | ❌ Tidak | ✅ Ya | Admin Override via `is_admin()` SQL Function |
| **Interactive Builder Engine** | ✅ Ya | ✅ Ya | Local Session + Storage Save |
| **Ebook Reader** | ✅ Ya | ✅ Ya | Public/Owned Access Control |
| **Admin Panel Navigation** | ❌ Tersembunyi | ✅ Tampil | Element Guard `.admin-only` & `.admin-section` |
| **Ubah Branding & Copyright** | ❌ Tidak | ✅ Ya | RLS Table `site_settings` Check `is_admin()` |
| **Statistik Global Platform** | ❌ Tidak | ✅ Ya | Query Count aggregate (Security Definer) |

---

## 3. Implementasi Keamanan pada Supabase (PostgreSQL RLS)

### A. Fungsi Pemeriksa Role Admin
```sql
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;
```

### B. Policy Kebijakan Kebijakan Akses (RLS Examples)

1. **Tabel Ebook (`public.ebooks`)**:
   - *Pengguna biasa* hanya dapat membaca, mengedit, atau menghapus ebook milik sendiri (`owner_id = auth.uid()`) atau ebook berstatus publik (`is_public = true`).
   - *Admin* memiliki akses menyeluruh melalui pengecekan `public.is_admin()`.

2. **Tabel Pengaturan Sistem (`public.site_settings`)**:
   - *Semua pengguna terotentikasi* dapat membaca nama situs/branding.
   - *Hanya admin* yang dapat melakukan penulisan/pembaruan (`INSERT`/`UPDATE`).

3. **Storage Bucket (`storage.objects`)**:
   - Pengunggahan dibatasi pada direktori `/{user_id}/filename`.
   - Unduhan via URL tersimpan (*signed URL*) dengan masa berlaku (*expiration*).

---

## 4. Implementasi pada Sisi Klien (Frontend Application)

Pada file `index.html`, antarmuka disesuaikan secara dinamis berdasarkan profil pengguna saat autentikasi berhasil:

```javascript
// Pengecekan role saat aplikasi dimuat
const isAdmin = currentProfile?.role === "admin";

// Menyembunyikan/menampilkan menu admin di Sidebar & Content
$$(".admin-only").forEach(el => el.classList.toggle("hidden", !isAdmin));
$(".admin-section").classList.toggle("hidden", !isAdmin);

// Pembaruan UI Profil
$("#userName").textContent = currentProfile?.full_name;
$("#userRole").textContent = isAdmin ? "Administrator" : "Pengguna";
```

---

## 5. Rencana Pengembangan Modul Admin (Roadmap Platform Manager)

Struktur yang telah dibangun siap diperluas untuk fungsi-fungsi pengelolaan skala besar:

1. **User Management Dashboard**:
   - Fitur memblokir (*suspend*) atau menghapus akun pengguna.
   - Mengatur alokasi batas kuota *storage* per pengguna (misal: 100MB untuk pengguna gratis, 5GB untuk VIP).
   - Mengubah peran pengguna dari `user` menjadi `admin` secara langsung dari UI.

2. **Global Moderation & Content Management**:
   - Meninjau semua ebook yang terunggah dalam sistem.
   - Menghapus konten yang melanggar hak cipta atau ketentuan layanan.
   - Menandai ebook pilihan (*Featured Ebooks*) untuk ditampilkan di halaman depan.

3. **Kategori & Pengorganisasian Konten**:
   - Pengelolaan taksonomi global (Kategori: Fiksi, Self-Improvement, Teknologi, dsb.).
   - Manajemen *tagging* dan pencarian terpusat.

4. **Sistem Analitik Lanjutan**:
   - Grafik riwayat membaca pengguna per hari/minggu.
   - Laporan waktu membaca rerata (*average reading time*) per bab.