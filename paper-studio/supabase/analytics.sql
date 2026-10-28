-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Anonymous usage events and feedback. Visitors can only insert rows;
-- only you can read them (Table Editor, or the queries at the bottom).

create table if not exists public.events (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) <= 40),
  detail text check (char_length(detail) <= 80),
  session text check (char_length(session) <= 20),
  signed_in boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;
drop policy if exists "Anyone can log events" on public.events;
create policy "Anyone can log events" on public.events for insert to anon, authenticated with check (true);

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  rating int check (rating between 1 and 5),
  message text not null check (char_length(message) between 1 and 4000),
  email text check (char_length(email) <= 200),
  page text check (char_length(page) <= 40),
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
drop policy if exists "Anyone can send feedback" on public.feedback;
create policy "Anyone can send feedback" on public.feedback for insert to anon, authenticated with check (true);

-- The funnel, per day: visits -> opened the example -> used AI -> signed up.
-- select date_trunc('day', created_at)::date as day,
--   count(distinct session) filter (where name = 'visit')       as visitors,
--   count(distinct session) filter (where name = 'open_sample') as opened_example,
--   count(distinct session) filter (where name = 'ai_used')     as used_ai,
--   count(*)                filter (where name = 'signup')      as signups
-- from public.events group by 1 order by 1 desc;
--
-- Latest feedback:
-- select created_at, rating, page, message, email from public.feedback order by created_at desc;
