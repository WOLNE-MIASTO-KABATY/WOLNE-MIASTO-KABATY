-- DyskiHub.pl — Supabase schema
-- Wklej w Supabase Dashboard → SQL Editor → Run

-- Profiles (1:1 z auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  email text not null,
  tokens integer not null default 25 check (tokens >= 0),
  is_premium boolean not null default false,
  is_admin boolean not null default false,
  referred_by text,
  banned boolean not null default false,
  last_daily_spin_at timestamptz,
  last_coinflip_at timestamptz,
  created_at timestamptz not null default now(),
  constraint profiles_username_unique unique (username),
  constraint profiles_email_unique unique (email)
);

create index if not exists profiles_username_idx on public.profiles (lower(username));
create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

-- Audit log akcji admina
create table if not exists public.admin_actions (
  id bigserial primary key,
  admin_email text not null,
  target_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  amount integer,
  created_at timestamptz not null default now()
);

-- Odblokowane zdjęcia profili koleżanek (per user, per zdjęcie)
create table if not exists public.profile_photo_unlocks (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  profile_id integer not null check (profile_id >= 1),
  photo_key text not null check (length(trim(photo_key)) > 0),
  created_at timestamptz not null default now(),
  constraint profile_photo_unlocks_unique unique (user_id, profile_id, photo_key)
);

create index if not exists profile_photo_unlocks_user_idx on public.profile_photo_unlocks (user_id, profile_id);

-- Nowy użytkownik → profil
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_referred text;
  v_is_admin boolean;
begin
  v_username := trim(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  v_referred := nullif(trim(coalesce(new.raw_user_meta_data->>'referred_by', '')), '');
  v_is_admin := lower(new.email) in (
    'marcelkuczynski47@gmail.com',
    'braszkamc@gmail.com'
  );

  insert into public.profiles (id, username, email, tokens, is_admin, referred_by)
  values (new.id, v_username, new.email, 25, v_is_admin, v_referred);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Żetony: tylko zalogowany user, bez podnoszenia samemu limitów
create or replace function public.add_tokens(p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 10000 then
    raise exception 'invalid_amount';
  end if;

  update public.profiles
  set tokens = tokens + p_amount
  where id = auth.uid()
  returning tokens into v_new;

  return v_new;
end;
$$;

create or replace function public.spend_tokens(p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 10000 then
    raise exception 'invalid_amount';
  end if;

  update public.profiles
  set tokens = tokens - p_amount
  where id = auth.uid() and tokens >= p_amount
  returning tokens into v_new;

  if v_new is null then
    raise exception 'insufficient_tokens';
  end if;

  return v_new;
end;
$$;

create or replace function public.check_username_available(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return not exists (
    select 1 from public.profiles where lower(username) = lower(trim(p_username))
  );
end;
$$;

create or replace function public.unlock_profile_photo(
  p_profile_id integer,
  p_photo_key text,
  p_cost integer default 20
)
returns table(new_tokens integer, already_unlocked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_photo_key text;
  v_tokens integer;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_profile_id is null or p_profile_id < 1 then
    raise exception 'invalid_profile';
  end if;

  v_photo_key := trim(coalesce(p_photo_key, ''));
  if v_photo_key = '' then
    raise exception 'invalid_photo_key';
  end if;

  if p_cost is null or p_cost <= 0 or p_cost > 10000 then
    raise exception 'invalid_cost';
  end if;

  select p.tokens into v_tokens
  from public.profiles p
  where p.id = v_uid
  for update;

  if v_tokens is null then
    raise exception 'profile_not_found';
  end if;

  if exists (
    select 1
    from public.profile_photo_unlocks u
    where u.user_id = v_uid
      and u.profile_id = p_profile_id
      and u.photo_key = v_photo_key
  ) then
    return query select v_tokens, true;
    return;
  end if;

  if v_tokens < p_cost then
    raise exception 'insufficient_tokens';
  end if;

  update public.profiles
  set tokens = tokens - p_cost
  where id = v_uid
  returning tokens into v_tokens;

  insert into public.profile_photo_unlocks (user_id, profile_id, photo_key)
  values (v_uid, p_profile_id, v_photo_key);

  return query select v_tokens, false;
end;
$$;

-- add_tokens: tylko service role (admin / zakup przez Functions) — nie dla klienta
revoke execute on function public.add_tokens(integer) from public, anon, authenticated;
grant execute on function public.spend_tokens(integer) to authenticated;
grant execute on function public.check_username_available(text) to anon, authenticated;
grant execute on function public.unlock_profile_photo(integer, text, integer) to authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.admin_actions enable row level security;
alter table public.profile_photo_unlocks enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users update own profile safe" on public.profiles;
create policy "Users update own profile safe"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and tokens = (select p.tokens from public.profiles p where p.id = auth.uid())
    and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid())
    and banned = (select p.banned from public.profiles p where p.id = auth.uid())
  );

-- admin_actions: brak dostępu z klienta (tylko service role przez Functions)

drop policy if exists "Users read own photo unlocks" on public.profile_photo_unlocks;
create policy "Users read own photo unlocks"
  on public.profile_photo_unlocks for select
  using (auth.uid() = user_id);
