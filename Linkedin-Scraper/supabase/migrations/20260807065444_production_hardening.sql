alter table public.profiles
  add column if not exists next_check_at timestamptz,
  add column if not exists last_success_at timestamptz;

update public.profiles
set next_check_at = coalesce(next_check_at, last_checked_at, now())
where next_check_at is null;

alter table public.profiles
  alter column next_check_at set default now(),
  alter column next_check_at set not null;

create table if not exists public.automation_locks (
  name text primary key check (name = 'linkedin_post_scraper'),
  lock_token uuid,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.automation_locks (name)
values ('linkedin_post_scraper')
on conflict (name) do nothing;

create index if not exists profiles_due_for_check_idx
  on public.profiles (next_check_at)
  where status = 'active';

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.automation_runs enable row level security;
alter table public.automation_locks enable row level security;

revoke all on public.profiles, public.posts, public.automation_runs, public.automation_locks
  from anon, authenticated;
grant all on public.profiles, public.posts, public.automation_runs, public.automation_locks
  to service_role;

notify pgrst, 'reload schema';
