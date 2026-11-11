-- ============================================================================
-- CUSTOMER ORDER REQUESTS (2026-11-11)
-- ----------------------------------------------------------------------------
-- Customers send pre-order requests and "add me to your email list" requests
-- from a homestead's public order page (henalytics.com/o/<token>).
-- api/order-page.js writes them; api/orders.js lets the homestead's members
-- read and update them and emails the customer. Both use the service role,
-- so the table is closed to the app (RLS on, no policies, no grants).
-- No payments: it's a request the owner accepts or declines. Safe to re-run.
-- ============================================================================

create table if not exists public.order_requests (
  id            uuid primary key default gen_random_uuid(),
  homestead_id  uuid not null references public.homesteads(id) on delete cascade,
  kind          text not null default 'order' check (kind in ('order', 'join')),
  status        text not null default 'new'
                check (status in ('new', 'accepted', 'ready', 'done', 'declined', 'added', 'ignored')),
  customer_name text not null check (char_length(customer_name) between 1 and 60),
  email         text not null check (char_length(email) <= 254),
  phone         text check (char_length(phone) <= 30),
  items         jsonb not null default '[]'::jsonb,
  note          text check (char_length(note) <= 600),
  pickup_date   date,
  owner_message text check (char_length(owner_message) <= 600),
  emailed_at    timestamptz,
  ip_hash       text check (char_length(ip_hash) <= 64),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists order_requests_homestead on public.order_requests (homestead_id, created_at desc);
create index if not exists order_requests_rate on public.order_requests (homestead_id, ip_hash, created_at desc);
-- (re-run safe if the table was made before this column existed)
alter table public.order_requests add column if not exists emailed_at timestamptz;

alter table public.order_requests enable row level security;
revoke all on table public.order_requests from anon, authenticated;

-- Finished, declined and handled requests are cleared after a year.
create or replace function public.prune_order_requests() returns void
language sql security definer set search_path = public as $$
  delete from public.order_requests
  where status in ('done', 'declined', 'added', 'ignored')
    and updated_at < now() - interval '365 days';
$$;
revoke all on function public.prune_order_requests() from public, anon, authenticated;
