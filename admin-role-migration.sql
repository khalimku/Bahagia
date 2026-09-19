-- Run this migration after the original supabase-schema.sql.
-- Only an existing admin can change another user's role.
alter table public.profiles enable row level security;
drop policy if exists profiles_admin_update_role on public.profiles;
create policy profiles_admin_update_role on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (role in ('user','admin') and public.is_admin());

-- Prevent an admin from accidentally removing their own admin access through the panel.
create or replace function public.prevent_last_admin_demotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'admin' and new.role <> 'admin' and old.id = auth.uid() then
    raise exception 'Admin aktif tidak dapat menurunkan role dirinya sendiri';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_admin_role on public.profiles;
create trigger protect_admin_role
before update of role on public.profiles
for each row execute procedure public.prevent_last_admin_demotion();
