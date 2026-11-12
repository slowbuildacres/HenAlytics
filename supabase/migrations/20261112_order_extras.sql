-- ============================================================================
-- ORDER REQUESTS: STATUS LINKS, "TELL ME WHEN IT'S BACK", STANDING ORDERS,
-- DELIVERY (2026-11-12)
-- ----------------------------------------------------------------------------
-- status_token  a random link id so a customer can check on their order
--               (henalytics.com/o/<page>?s=<status_token>), no account
-- kind 'notify' "Email me when it's back" for a sold-out item; items holds
--               the item(s), status new until the farm sends the note
-- repeat_weeks  a standing order: the same order every 1, 2, 3 or 4 weeks
-- fulfil        'pickup' or 'delivery'; address for delivery
-- status 'cancelled' the customer cancelled it from their status link
-- api/order-page.js and api/orders.js work before this runs (they skip what
-- isn't there yet). Safe to re-run.
-- ============================================================================

alter table public.order_requests drop constraint if exists order_requests_kind_check;
alter table public.order_requests add constraint order_requests_kind_check
  check (kind in ('order', 'join', 'notify'));

alter table public.order_requests drop constraint if exists order_requests_status_check;
alter table public.order_requests add constraint order_requests_status_check
  check (status in ('new', 'accepted', 'ready', 'done', 'declined', 'added', 'ignored', 'cancelled'));

alter table public.order_requests add column if not exists status_token text
  check (status_token ~ '^[a-f0-9]{32}$');
create unique index if not exists order_requests_status_token
  on public.order_requests (status_token) where status_token is not null;

alter table public.order_requests add column if not exists repeat_weeks smallint
  check (repeat_weeks between 1 and 4);
alter table public.order_requests add column if not exists fulfil text not null default 'pickup'
  check (fulfil in ('pickup', 'delivery'));
alter table public.order_requests add column if not exists address text
  check (char_length(address) <= 200);

-- Cancelled requests are cleared after a year like the other finished ones.
create or replace function public.prune_order_requests() returns void
language sql security definer set search_path = public as $$
  delete from public.order_requests
  where status in ('done', 'declined', 'added', 'ignored', 'cancelled')
    and updated_at < now() - interval '365 days';
$$;
revoke all on function public.prune_order_requests() from public, anon, authenticated;
