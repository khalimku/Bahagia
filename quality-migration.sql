-- Webook Bahagia hardening migration.
-- Run after supabase-schema.sql. All authorization remains enforced by RLS.

create index if not exists ebooks_public_created_at_idx
  on public.ebooks (created_at desc)
  where is_public = true;

create index if not exists ebooks_owner_created_at_idx
  on public.ebooks (owner_id, created_at desc);

-- Public ebooks are stored in a private bucket and opened with signed URLs.
-- Allow authenticated readers to fetch only objects belonging to a public ebook.
drop policy if exists ebooks_storage_public_read on storage.objects;
create policy ebooks_storage_public_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ebooks'
    and exists (
      select 1
      from public.ebooks
      where public.ebooks.storage_path = storage.objects.name
        and public.ebooks.is_public = true
    )
  );

-- Prevent a failed metadata delete from leaving orphaned files where possible.
drop policy if exists ebooks_storage_delete on storage.objects;
create policy ebooks_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'ebooks' and (owner_id = auth.uid() or public.is_admin()));
