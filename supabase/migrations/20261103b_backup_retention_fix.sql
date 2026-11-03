-- ============================================================================
-- HOMESTEAD BACKUP RETENTION — speed fix  (2026-11-03, follow-up)
-- ----------------------------------------------------------------------------
-- The first prune function used a NOT EXISTS against a DISTINCT ON subquery,
-- which Postgres re-evaluated row by row and hit the statement timeout, so
-- nothing was deleted. This version ranks rows once with a window function
-- (about 2 s to pick a batch of 5,000 on the current table).
--
-- Schedule: every 2 minutes while there's a backlog (~2 hours for the
-- current ~345k old copies). When a run finds nothing left to delete, the
-- job switches itself to once a night (3:23 UTC).
-- Same retention rule: everything from the last 30 days + the newest copy
-- per homestead per month before that.
-- Safe to re-run.
-- ============================================================================

create or replace function public.prune_homestead_backups(max_rows integer default 5000)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
begin
  with ranked as (
    select id,
           row_number() over (
             partition by homestead_id, date_trunc('month', created_at)
             order by created_at desc
           ) as rn
    from homestead_backups
    where created_at <= now() - interval '30 days'
  ),
  doomed as (
    select id from ranked where rn > 1 limit max_rows
  )
  delete from homestead_backups b
  using doomed d
  where b.id = d.id;

  get diagnostics deleted = row_count;

  -- Backlog cleared: drop to a nightly run.
  if deleted = 0 then
    perform cron.alter_job(
      job_id   := (select jobid from cron.job where jobname = 'prune-homestead-backups'),
      schedule := '23 3 * * *'
    );
  end if;

  return deleted;
end;
$$;

revoke all on function public.prune_homestead_backups(integer) from public;
revoke all on function public.prune_homestead_backups(integer) from anon, authenticated;

-- Every 2 minutes, 5,000 rows a run, with room for the TOAST cleanup.
select cron.schedule(
  'prune-homestead-backups',
  '*/2 * * * *',
  $cron$set statement_timeout = '5min'; select public.prune_homestead_backups(5000)$cron$
);

-- Progress:
--   select count(*) from public.homestead_backups;
--   select start_time, status, return_message from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'prune-homestead-backups')
--   order by start_time desc limit 5;
