create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  linkedin_url text not null unique,
  display_name text,
  team text,
  status text not null default 'active' check (status in ('active', 'paused')),
  refresh_interval_days integer not null default 7 check (refresh_interval_days between 1 and 365),
  last_checked_at timestamptz,
  last_error text,
  failure_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists automation_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  profiles_processed integer not null default 0,
  profiles_succeeded integer not null default 0,
  profiles_failed integer not null default 0,
  error_message text
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  post_fingerprint text not null,
  raw_text text not null,
  summary text,
  published_at date,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, post_fingerprint)
);

create index if not exists profiles_due_idx on profiles (status, last_checked_at);
create index if not exists posts_profile_idx on posts (profile_id, published_at desc);

notify pgrst, 'reload schema';
