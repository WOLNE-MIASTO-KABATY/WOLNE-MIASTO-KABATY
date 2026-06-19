-- SuperFan — subskrypcja per koleżanka (zdjęcia, filmy, nielimitowany czat)

create table if not exists public.profile_superfan_subscriptions (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  profile_id integer not null check (profile_id >= 1),
  created_at timestamptz not null default now(),
  constraint profile_superfan_unique unique (user_id, profile_id)
);

create index if not exists profile_superfan_user_idx on public.profile_superfan_subscriptions (user_id);

alter table public.profile_superfan_subscriptions enable row level security;

drop policy if exists "Users read own superfan subs" on public.profile_superfan_subscriptions;
create policy "Users read own superfan subs"
  on public.profile_superfan_subscriptions for select
  using (auth.uid() = user_id);
