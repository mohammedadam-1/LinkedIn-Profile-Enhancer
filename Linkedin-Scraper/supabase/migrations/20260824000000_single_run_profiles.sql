-- Single-attempt design: failed profiles are deleted immediately
-- (posts cascade via foreign key). Successful profiles keep their
-- normal refresh_interval_days scheduling, so retry bookkeeping
-- is no longer needed.

alter table public.profiles
  drop column if exists failure_count,
  drop column if exists last_error;

notify pgrst, 'reload schema';
