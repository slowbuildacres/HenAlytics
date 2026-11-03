-- ============================================================================
-- HOMESTEAD BACKUP RETENTION  (2026-11-03)
-- ----------------------------------------------------------------------------
-- Problem: homesteads_backup_trigger copied the full homestead JSON on EVERY
-- save (every log, every edit) and nothing ever deleted old copies. By Nov 3
-- homestead_backups held 392,562 copies = 7.3 GB of a 7.4 GB database, which
-- pushed the disk past the Pro plan's 8 GB.
--
-- Fix:
--   1. Trigger: skip saves where the data didn't change, and take at most one
--      automatic backup per homestead every 15 minutes.
--   2. prune_homestead_backups(): keep every backup from the last 30 days,
--      plus the newest backup of each month for older history (so the latest
--      copy of every homestead is always kept). Deletes in batches.
--   3. pg_cron runs the prune every 10 minutes. The first ~3 hours chew
--      through the backlog (~345k rows); after that each run is near-instant.
--
-- Freed space is reused by Postgres for new rows, so the disk stops growing.
-- It does not shrink the provisioned disk by itself.
-- Safe to re-run.
-- ============================================================================

-- 1. Throttled backup trigger function (same table, same columns, same source tag)
create or replace function public.backup_homestead_on_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- No-op saves (nothing changed) don't need a new copy.
  if tg_op = 'UPDATE' and new.data is not distinct from old.data then
    return new;
  end if;

  -- At most one automatic backup per homestead every 15 minutes.
  if exists (
    select 1 from homestead_backups b
    where b.homestead_id = new.id
      and b.source = 'auto_trigger'
      and b.created_at > now() - interval '15 minutes'
  ) then
    return new;
  end if;

  -- Find the owner user_id to attribute the backup to
  insert into homestead_backups (homestead_id, user_id, data, source)
  select new.id, hm.user_id, new.data, 'auto_trigger'
  from homestead_members hm
  where hm.homestead_id = new.id and hm.role = 'owner'
  limit 1;

  return new;
exception when others then
  -- Never let backup failure block the actual write
  return new;
end;
$$;

-- 2. Retention: last 30 days in full + newest copy per homestead per month before that
create or replace function public.prune_homestead_backups(max_rows integer default 20000)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
begin
  with keep_monthly as (
    select distinct on (homestead_id, date_trunc('month', created_at)) id
    from homestead_backups
    where created_at <= now() - interval '30 days'
    order by homestead_id, date_trunc('month', created_at), created_at desc
  ),
  doomed as (
    select b.id
    from homestead_backups b
    where b.created_at <= now() - interval '30 days'
      and not exists (select 1 from keep_monthly k where k.id = b.id)
    limit max_rows
  )
  delete from homestead_backups b
  using doomed d
  where b.id = d.id;

  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

-- Only the database owner / cron may run it.
revoke all on function public.prune_homestead_backups(integer) from public;
revoke all on function public.prune_homestead_backups(integer) from anon, authenticated;

-- 3. Run every 10 minutes (re-running this file just updates the job).
select cron.schedule(
  'prune-homestead-backups',
  '*/10 * * * *',
  $cron$select public.prune_homestead_backups(20000)$cron$
);

-- Check progress any time:
--   select count(*) from public.homestead_backups;
--   select * from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'prune-homestead-backups')
--   order by start_time desc limit 5;
