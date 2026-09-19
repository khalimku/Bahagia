-- Run this migration after the original supabase-schema.sql.
-- This makes role changes and admin-only settings enforceable through database RLS.

alter table public.profiles enable row level security;

-- Allow authenticated users to read their own profile and any admin to read all profiles.
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Only admins may change a user's role.
-- Prevent the active admin user from demoting their own role.
drop policy if exists profiles_admin_update_role on public.profiles;
create policy profiles_admin_update_role on public.profiles
  for update to authenticated
  using (public.is_admin() and id <> auth.uid())
  with check (
    role in ('user','admin')
    and public.is_admin()
    and id <> auth.uid()
  );

create or replace function public.prevent_admin_self_demotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'admin' and new.role <> 'admin' and old.id = auth.uid() then
    raise exception 'Admin aktif tidak dapat menurunkan role dirinya sendiri';
  end if;

  if new.role not in ('user','admin') then
    raise exception 'Role tidak valid';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_admin_role on public.profiles;
create trigger protect_admin_role
before update of role on public.profiles
for each row
execute procedure public.prevent_admin_self_demotion();

-- Harden site settings updates so only admins can mutate them.
drop policy if exists settings_admin on public.site_settings;
create policy settings_admin on public.site_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Optional safety: site settings are readable to everyone authenticated.
drop policy if exists settings_read on public.site_settings;
create policy settings_read on public.site_settings
  for select to authenticated
  using (true);

-- Keep a defensive rule if admin is the only remaining account with admin role.
-- This is a second layer beside the trigger and UI restriction.
create or replace function public.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_admins integer;
begin
  if old.role = 'admin' and new.role <> 'admin' and auth.uid() = old.id then
    select count(*) into remaining_admins
    from public.profiles
    where role = 'admin' and id <> old.id;

    if remaining_admins = 0 then
      raise exception 'Tidak boleh menghapus satu-satunya admin yang tersisa';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_last_admin on public.profiles;
create trigger protect_last_admin
before update of role on public.profiles
for each row
execute procedure public.prevent_last_admin_removal();

-- Grant read access to authenticated users for their own profile and for admin view.
-- Existing `public.is_admin()` function is already available from supabase-schema.sql.
