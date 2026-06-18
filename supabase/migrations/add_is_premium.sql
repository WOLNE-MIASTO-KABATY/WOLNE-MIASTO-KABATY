-- Uruchom w Supabase SQL Editor, jeśli kolumna is_premium jeszcze nie istnieje
alter table public.profiles
  add column if not exists is_premium boolean not null default false;
