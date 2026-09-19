-- Webook Bahagia - Supabase schema and security policies
-- Run this file in Supabase SQL Editor with the postgres/service database role.
-- The browser must use only the anon/publishable key, never service_role.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.ebooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.builder_pages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  title text not null default 'Untitled',
  blocks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  site_name text not null default 'Webook Bahagia',
  copyright_email text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- Keep this schema compatible if an older version was already installed.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.ebooks add column if not exists mime_type text;
alter table public.ebooks add column if not exists size_bytes bigint;
alter table public.ebooks add column if not exists is_public boolean not null default false;
alter table public.ebooks add column if not exists created_at timestamptz not null default now();
alter table public.builder_pages add column if not exists title text not null default 'Untitled';
alter table public.builder_pages add column if not exists blocks jsonb not null default '[]'::jsonb;
alter table public.builder_pages add column if not exists updated_at timestamptz not null default now();
alter table public.site_settings add column if not exists site_name text not null default 'Webook Bahagia';
alter table public.site_settings add column if not exists copyright_email text;
alter table public.site_settings add column if not exists updated_by uuid references auth.users(id);
alter table public.site_settings add column if not exists updated_at timestamptz not null default now();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(coalesce(new.email, ''), '@', 1), 'Pengguna')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to postgres, service_role;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

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

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.touch_builder_page()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists builder_pages_set_updated_at on public.builder_pages;
create trigger builder_pages_set_updated_at
before update on public.builder_pages
for each row execute procedure public.touch_builder_page();

create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.id = auth.uid() and new.role <> old.role then
    raise exception 'Admin aktif tidak dapat mengubah role dirinya sendiri';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
before update of role on public.profiles
for each row execute procedure public.prevent_self_role_change();

alter table public.profiles enable row level security;
alter table public.ebooks enable row level security;
alter table public.builder_pages enable row level security;
alter table public.site_settings enable row level security;
alter table storage.objects enable row level security;

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
for update to authenticated
using (public.is_admin())
with check (role in ('user', 'admin') and public.is_admin());

drop policy if exists ebooks_read on public.ebooks;
create policy ebooks_read on public.ebooks
for select to authenticated
using (owner_id = auth.uid() or is_public = true or public.is_admin());

drop policy if exists ebooks_insert on public.ebooks;
create policy ebooks_insert on public.ebooks
for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists ebooks_update on public.ebooks;
create policy ebooks_update on public.ebooks
for update to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists ebooks_delete on public.ebooks;
create policy ebooks_delete on public.ebooks
for delete to authenticated
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists builder_owner on public.builder_pages;
create policy builder_owner on public.builder_pages
for all to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists settings_read on public.site_settings;
create policy settings_read on public.site_settings
for select to authenticated using (true);

drop policy if exists settings_admin on public.site_settings;
create policy settings_admin on public.site_settings
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.site_settings (id)
values (1)
on conflict (id) do nothing;

create index if not exists profiles_created_at_idx on public.profiles (created_at);
create index if not exists ebooks_public_created_at_idx on public.ebooks (created_at desc) where is_public = true;
create index if not exists ebooks_owner_created_at_idx on public.ebooks (owner_id, created_at desc);

insert into storage.buckets (id, name, public)
values ('ebooks', 'ebooks', false)
on conflict (id) do update set public = false;

drop policy if exists ebooks_storage_read on storage.objects;
create policy ebooks_storage_read on storage.objects
for select to authenticated
using (
  bucket_id = 'ebooks'
  and (
    owner_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.ebooks e
      where e.storage_path = storage.objects.name and e.is_public = true
    )
  )
);

drop policy if exists ebooks_storage_insert on storage.objects;
create policy ebooks_storage_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'ebooks' and owner_id = auth.uid());

drop policy if exists ebooks_storage_update on storage.objects;
create policy ebooks_storage_update on storage.objects
for update to authenticated
using (bucket_id = 'ebooks' and (owner_id = auth.uid() or public.is_admin()))
with check (bucket_id = 'ebooks' and (owner_id = auth.uid() or public.is_admin()));

drop policy if exists ebooks_storage_delete on storage.objects;
create policy ebooks_storage_delete on storage.objects
for delete to authenticated
using (bucket_id = 'ebooks' and (owner_id = auth.uid() or public.is_admin()));
