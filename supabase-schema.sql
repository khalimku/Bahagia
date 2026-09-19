-- Webook Bahagia: run this in Supabase SQL Editor before production use.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, name text, role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id,email,name) values (new.id,new.email,coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1))); return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
alter table public.profiles enable row level security;
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "Admins can read profiles" on public.profiles;
create policy "Admins can read profiles" on public.profiles for select using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
