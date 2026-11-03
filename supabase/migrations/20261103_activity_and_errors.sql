-- ============================================================================
-- ACTIVITY DAYS, CRASH REPORTS, ADMIN REPORTS  (2026-11-03)
-- ----------------------------------------------------------------------------
-- 1. public.activity_days: one row per signed-in user per day they used the
--    app (the app upserts it once a day). Tiny. Backfilled from the
--    homestead_backups history (owner + day of each save, since May 2026)
--    BEFORE the backup pruning removes that day-by-day detail.
-- 2. public.client_errors: crash / error reports sent by the app.
-- 3. admin.* views: retention by signup week, weekly actives, hobby
--    adoption, top errors. The admin schema is NOT exposed through the API,
--    so only the dashboard / SQL editor can read these.
-- Safe to re-run.
-- ============================================================================

-- 1. ACTIVITY DAYS ------------------------------------------------------------
create table if not exists public.activity_days (
  user_id   uuid not null references auth.users(id) on delete cascade,
  day       date not null,
  platform  text,
  primary key (user_id, day)
);
alter table public.activity_days enable row level security;

drop policy if exists "activity_days insert own" on public.activity_days;
create policy "activity_days insert own" on public.activity_days
  for insert to authenticated with check (user_id = auth.uid());

-- upsert (on conflict do nothing) needs no update/select policy.
revoke all on public.activity_days from anon;
grant insert on public.activity_days to authenticated;

-- Backfill from backup history (owner + the day each save happened).
insert into public.activity_days (user_id, day, platform)
select distinct b.user_id, (b.created_at at time zone 'America/Chicago')::date, 'backfill'
from public.homestead_backups b
where b.user_id is not null
on conflict do nothing;

-- 2. CLIENT ERRORS -------------------------------------------------------------
create table if not exists public.client_errors (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid default auth.uid(),
  platform    text check (char_length(platform) <= 20),
  app_version text check (char_length(app_version) <= 40),
  page        text check (char_length(page) <= 120),
  kind        text check (char_length(kind) <= 40),
  message     text not null check (char_length(message) <= 500),
  stack       text check (char_length(stack) <= 4000),
  url         text check (char_length(url) <= 300)
);
create index if not exists client_errors_created_at_idx on public.client_errors (created_at desc);
alter table public.client_errors enable row level security;

drop policy if exists "client_errors insert" on public.client_errors;
create policy "client_errors insert" on public.client_errors
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

revoke all on public.client_errors from anon, authenticated;
grant insert on public.client_errors to anon, authenticated;

-- Keep 90 days of error reports.
select cron.schedule(
  'prune-client-errors',
  '17 4 * * *',
  $cron$delete from public.client_errors where created_at < now() - interval '90 days'$cron$
);

-- 3. ADMIN REPORTS (dashboard / SQL editor only) --------------------------------
create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

-- Weekly active users (anyone who used the app that week).
create or replace view admin.weekly_actives as
select date_trunc('week', day)::date as week_of,
       count(distinct user_id)        as active_users
from public.activity_days
group by 1
order by 1 desc;

-- Retention by signup week: of the people who signed up that week, what
-- share came back in days 1-7, 8-30, 31-60 and 61-90 after signing up.
-- Only accounts that own a homestead count (skips abandoned/ghost signups).
create or replace view admin.retention_by_signup_week as
with owners as (
  select distinct u.id, (u.created_at at time zone 'America/Chicago')::date as signup_day
  from auth.users u
  join public.homestead_members m on m.user_id = u.id and m.role = 'owner'
),
flags as (
  select o.id, o.signup_day,
    bool_or(a.day between o.signup_day + 1  and o.signup_day + 7)  as d1_7,
    bool_or(a.day between o.signup_day + 8  and o.signup_day + 30) as d8_30,
    bool_or(a.day between o.signup_day + 31 and o.signup_day + 60) as d31_60,
    bool_or(a.day between o.signup_day + 61 and o.signup_day + 90) as d61_90
  from owners o
  left join public.activity_days a on a.user_id = o.id
  group by o.id, o.signup_day
)
select date_trunc('week', signup_day)::date as signup_week,
       count(*)                              as signups,
       round(100.0 * count(*) filter (where d1_7)   / count(*)) as pct_back_week_1,
       round(100.0 * count(*) filter (where d8_30)  / count(*)) as pct_back_days_8_30,
       round(100.0 * count(*) filter (where d31_60) / count(*)) as pct_back_days_31_60,
       round(100.0 * count(*) filter (where d61_90) / count(*)) as pct_back_days_61_90
from flags
group by 1
order by 1 desc;

-- Which hobbies people turn on, and how many of those homesteads were
-- active in the last 30 days.
create or replace view admin.hobby_adoption as
select h->>'type' as hobby,
       count(*)    as homesteads_with_it_on,
       count(*) filter (where hs.updated_at > now() - interval '30 days') as active_last_30d
from public.homesteads hs,
     jsonb_array_elements(coalesce(hs.data->'hobbies', '[]'::jsonb)) h
where coalesce((h->>'hidden')::boolean, false) = false
group by 1
order by 2 desc;

-- Most common errors in the last 14 days.
create or replace view admin.top_errors as
select left(message, 160)                  as message,
       count(*)                            as times,
       count(distinct user_id)             as people,
       max(created_at)                     as last_seen,
       string_agg(distinct platform, ', ') as platforms,
       string_agg(distinct app_version, ', ') as versions,
       (array_agg(page order by created_at desc))[1] as last_page
from public.client_errors
where created_at > now() - interval '14 days'
group by 1
order by 2 desc;

revoke all on all tables in schema admin from public, anon, authenticated;

-- How to look:
--   select * from admin.retention_by_signup_week limit 20;
--   select * from admin.weekly_actives limit 12;
--   select * from admin.hobby_adoption;
--   select * from admin.top_errors;
