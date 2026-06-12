-- ============================================================================
-- Homestead Games — regional standings migration
-- Run once in the Supabase SQL editor.
--
-- Builds on the EXISTING community pipeline:
--   community_contributions(user_id, year, metrics jsonb)  ← client-pushed
-- and adds:
--   homestead_regions     — where each homestead is + display preference
--   games_category_config — which metrics are Games categories + caps
--   region_stats          — nightly country/state/county rollups (read-only)
--   recompute_region_stats(year) — the rollup function
--
-- Privacy model:
--   * display_mode = 'hidden' homesteads contribute to NOTHING.
--   * k-anonymity: a region/category row below the homestead threshold has
--     its total zeroed and visible=false — small cohorts never leak totals.
--     homestead_count stays real so the UI can show "2 more to unlock".
--   * Regional boards never show homestead names. anon_handle exists for
--     future individual boards / pulse feed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Region + display identity
-- ----------------------------------------------------------------------------
create table if not exists public.homestead_regions (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  country_code     text not null check (country_code ~ '^[A-Z]{2}$'),
  subdivision_code text     check (subdivision_code ~ '^[A-Z]{2}-[A-Za-z0-9]{1,4}$'),
  county_code      text     check (county_code ~ '^[0-9]{5}$'),  -- US FIPS, v1
  display_mode     text not null default 'anonymous'
                   check (display_mode in ('anonymous', 'named', 'hidden')),
  anon_handle      text not null,
  updated_at       timestamptz not null default now()
);

alter table public.homestead_regions enable row level security;

create policy "regions: read own"
  on public.homestead_regions for select
  using (auth.uid() = user_id);

create policy "regions: insert own"
  on public.homestead_regions for insert
  with check (auth.uid() = user_id);

create policy "regions: update own"
  on public.homestead_regions for update
  using (auth.uid() = user_id);

create policy "regions: delete own"
  on public.homestead_regions for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 2. Games categories — a subset of the community_contributions metric keys.
--    Caps are per homestead per year, deliberately generous: they exist only
--    to keep one fat-fingered entry from corrupting a whole region's total.
--    Adding a category later = one INSERT here (key must exist in the metrics
--    jsonb that extractCommunityMetrics writes).
-- ----------------------------------------------------------------------------
create table if not exists public.games_category_config (
  category      text primary key,   -- must match a community metric key
  hard_cap_year numeric not null,
  active        boolean not null default true
);

alter table public.games_category_config enable row level security;

create policy "games_category_config: readable by all"
  on public.games_category_config for select
  using (true);
-- no write policies → service role only

insert into public.games_category_config (category, hard_cap_year) values
  ('eggs',    150000),   -- ≈ 400 hens laying daily
  ('harvest',  55000),   -- lbs; serious market-garden territory
  ('hatched',   6000),
  ('jars',      3000),
  ('honey',     2000),   -- lbs
  ('milk',      4000)    -- gallons
on conflict (category) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Regional rollups — written only by the recompute, read by everyone.
-- ----------------------------------------------------------------------------
create table if not exists public.region_stats (
  year            integer not null,
  category        text not null,
  region_level    text not null check (region_level in ('country', 'subdivision', 'county')),
  region_code     text not null,
  total           numeric not null default 0,
  homestead_count integer not null default 0,   -- homesteads with activity in this category
  per_homestead   numeric generated always as
                  (case when homestead_count > 0
                        then round(total / homestead_count, 1)
                        else 0 end) stored,
  visible         boolean not null default false,
  updated_at      timestamptz not null default now(),
  primary key (year, category, region_level, region_code)
);

alter table public.region_stats enable row level security;

create policy "region_stats: readable by everyone"
  on public.region_stats for select
  using (true);
-- no write policies → service role only

create index if not exists region_stats_board_idx
  on public.region_stats (year, category, region_level, visible, total desc);

-- ----------------------------------------------------------------------------
-- 4. Recompute. Idempotent per year — safe to run any time.
--    k thresholds: country 3, subdivision 3, county 5 (per category — a
--    county can be unlocked for eggs while still locked for honey).
--    Below-k rows: total forced to 0 so small-cohort totals never leak;
--    homestead_count kept real to power the "N more to unlock" card.
-- ----------------------------------------------------------------------------
create or replace function public.recompute_region_stats(p_year integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.region_stats where year = p_year;

  insert into public.region_stats
        (year, category, region_level, region_code, total, homestead_count, visible)
  select p_year,
         g.category,
         lvl.region_level,
         lvl.region_code,
         case when count(*) filter (where v.val > 0) >= lvl.k
              then sum(v.val) else 0 end                as total,
         count(*) filter (where v.val > 0)              as homestead_count,
         count(*) filter (where v.val > 0) >= lvl.k     as visible
    from public.community_contributions c
    join public.homestead_regions r
      on r.user_id = c.user_id
     and r.display_mode <> 'hidden'
    cross join public.games_category_config g
    cross join lateral (
      values
        ('country',     r.country_code,     3),
        ('subdivision', r.subdivision_code, 3),
        ('county',      r.county_code,      5)
    ) as lvl (region_level, region_code, k)
    cross join lateral (
      select least(
               case when jsonb_typeof(c.metrics -> g.category) = 'number'
                    then (c.metrics ->> g.category)::numeric
                    else 0 end,
               g.hard_cap_year
             ) as val
    ) as v
   where c.year = p_year
     and g.active
     and lvl.region_code is not null
   group by g.category, lvl.region_level, lvl.region_code, lvl.k
  having count(*) filter (where v.val > 0) > 0;
end;
$$;

-- Service role only (the Vercel cron calls this; clients never do).
revoke execute on function public.recompute_region_stats(integer) from public, anon, authenticated;
grant execute on function public.recompute_region_stats(integer) to service_role;

-- ============================================================================
-- After running this file:
--   1. Deploy the new /api/recompute-region-stats route (already in this
--      patch) — vercel.json schedules it daily at 09:00 UTC, matching the
--      "totals are gathered once a day" copy.
--   2. Kick it once manually so boards aren't empty on launch day:
--        curl -H "Authorization: Bearer $CRON_SECRET" \
--          https://henalytics.com/api/recompute-region-stats
-- ============================================================================
