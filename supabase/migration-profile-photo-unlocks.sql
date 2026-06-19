-- Profile Koleżanek — odblokowania zdjęć per user/per zdjęcie

create table if not exists public.profile_photo_unlocks (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  profile_id integer not null check (profile_id >= 1),
  photo_key text not null check (length(trim(photo_key)) > 0),
  created_at timestamptz not null default now(),
  constraint profile_photo_unlocks_unique unique (user_id, profile_id, photo_key)
);

create index if not exists profile_photo_unlocks_user_idx on public.profile_photo_unlocks (user_id, profile_id);

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

grant execute on function public.unlock_profile_photo(integer, text, integer) to authenticated;

alter table public.profile_photo_unlocks enable row level security;

drop policy if exists "Users read own photo unlocks" on public.profile_photo_unlocks;
create policy "Users read own photo unlocks"
  on public.profile_photo_unlocks for select
  using (auth.uid() = user_id);
