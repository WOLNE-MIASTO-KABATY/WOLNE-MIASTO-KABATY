-- Daily Spin — dodaj kolumnę cooldown (wklej w Supabase SQL Editor)
alter table public.profiles
  add column if not exists last_daily_spin_at timestamptz;
