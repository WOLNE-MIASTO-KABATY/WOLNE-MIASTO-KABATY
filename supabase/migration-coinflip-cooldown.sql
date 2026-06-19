-- Coinflip — cooldown 24h (wklej w Supabase SQL Editor)
alter table public.profiles
  add column if not exists last_coinflip_at timestamptz;
