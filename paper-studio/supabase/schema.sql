-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- One row per project; row-level security lets each user see only their own.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'Untitled paper',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

drop policy if exists "Users manage their own projects" on public.projects;
create policy "Users manage their own projects" on public.projects
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists projects_user_updated on public.projects (user_id, updated_at desc);
