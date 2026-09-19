-- Webook Bahagia production security migration.
-- Run after supabase-schema.sql and quality-migration.sql.
-- Never put a service_role key in the browser.

-- Required indexes for the main access patterns.
create index if not exists profiles_created_at_idx
  on public.profiles (created_at asc);
create index if not exists ebooks_public_created_at_idx
  on public.ebooks (created_at desc)
  where is_public = true;
create index if not exists ebooks_owner_created_at_idx
  on public.ebooks (owner_id, created_at desc);

-- Ensure RLS is enabled even if an older schema was used.
alter table public.profiles enable row level security;
alter table public.ebooks enable row level security;
alter table public.builder_pages enable row level security;
alter table public.site_settings enable row level security;
alter table storage.objects enable row level security;

-- The browser admin panel updates roles; only admins may do that.
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Re-state table policies explicitly so the intended access model is clear.
drop policy if exists profiles_self on public.profiles;
create policy profiles_self
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists ebooks_read on public.ebooks;
create policy ebooks_read
  on public.ebooks for select to authenticated
  using (owner_id = auth.uid() or is_public = true or public.is_admin());

drop policy if exists ebooks_insert on public.ebooks;
create policy ebooks_insert
  on public.ebooks for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists ebooks_update on public.ebooks;
create policy ebooks_update
  on public.ebooks for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists ebooks_delete on public.ebooks;
create policy ebooks_delete
  on public.ebooks for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- Private bucket: signed URLs still require a SELECT policy.
drop policy if exists ebooks_storage_read on storage.objects;
create policy ebooks_storage_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ebooks'
    and (
      owner_id = auth.uid()
      or public.is_admin()
      or exists (
        select 1 from public.ebooks e
        where e.storage_path = storage.objects.name
          and e.is_public = true
      )
    )
  );

drop policy if exists ebooks_storage_insert on storage.objects;
create policy ebooks_storage_insert
  on storage.objects for insert to authenticated
  with check (bucket_id = 'ebooks' and owner_id = auth.uid());

drop policy if exists ebooks_storage_update on storage.objects;
create policy ebooks_storage_update
  on storage.objects for update to authenticated
  using (bucket_id = 'ebooks' and (owner_id = auth.uid() or public.is_admin()))
  with check (bucket_id = 'ebooks' and (owner_id = auth.uid() or public.is_admin()));

drop policy if exists ebooks_storage_delete on storage.objects;
create policy ebooks_storage_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'ebooks' and (owner_id = auth.uid() or public.is_admin()));

-- Keep the bucket private; the app uses signed URLs.
update storage.buckets set public = false where id = 'ebooks';
