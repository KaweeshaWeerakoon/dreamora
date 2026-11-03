-- DREAMORA BUILD 02 — Supabase Auth + private cloud save.
-- Run the entire script in Supabase Dashboard > SQL Editor > New query.
-- Browser apps must use ONLY the anon/publishable key. Never use service_role here.

create extension if not exists pgcrypto;

-- One profile is created automatically for each verified/new auth user.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Wanderer',
  character_title text not null default 'The Wanderer',
  companion text not null default 'Aster the Wisp',
  daily_goal_minutes integer not null default 120 check (daily_goal_minutes between 15 and 720),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Wanderer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Build 02 stores the app's complete per-user progress snapshot in this table.
-- RLS ensures a signed-in user can only read/write their own row.
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Structured tables retained for the next milestone (server-verified sessions/XP).
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  topic text,
  mode text not null check (mode in ('pomodoro','extended','deep','stopwatch')),
  active_seconds integer not null check (active_seconds between 60 and 43200),
  earned_xp integer not null default 0 check (earned_xp >= 0),
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.study_sessions(id) on delete set null,
  amount integer not null check (amount > 0),
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_state enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.study_sessions enable row level security;
alter table public.xp_transactions enable row level security;

-- Policies are dropped first so this setup can safely be re-run.
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can create own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can create own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users manage own cloud state" on public.user_state;
create policy "Users manage own cloud state" on public.user_state
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own subjects" on public.subjects;
create policy "Users manage own subjects" on public.subjects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own topics" on public.topics;
create policy "Users manage own topics" on public.topics for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users read own sessions" on public.study_sessions;
create policy "Users read own sessions" on public.study_sessions for select using (auth.uid() = user_id);

drop policy if exists "Users read own XP transactions" on public.xp_transactions;
create policy "Users read own XP transactions" on public.xp_transactions for select using (auth.uid() = user_id);

-- Do not add public/anonymous access policies to private user tables.

-- Explicit grants for signed-in clients; RLS remains the access boundary.
revoke all on public.profiles, public.user_state, public.subjects, public.topics, public.study_sessions, public.xp_transactions from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.user_state to authenticated;
grant select, insert, update, delete on public.subjects to authenticated;
grant select, insert, update, delete on public.topics to authenticated;
grant select on public.study_sessions to authenticated;
grant select on public.xp_transactions to authenticated;
