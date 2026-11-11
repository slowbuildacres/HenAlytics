-- ============================================================================
-- ORDER REQUESTS: HOW THE CUSTOMER WILL PAY, AND OK TO TEXT (2026-11-11)
-- ----------------------------------------------------------------------------
-- The order page can ask "How will you pay?" (cash, Venmo, Cash App, PayPal,
-- Zelle, card at pickup, check). Customers pay the farm directly; these
-- columns only record their choice and whether the owner marked it paid.
-- text_ok: the customer ticked "It's OK to text me" on the order page.
-- Safe to re-run.
-- ============================================================================

alter table public.order_requests add column if not exists pay_method text
  check (pay_method in ('cash', 'venmo', 'cashapp', 'paypal', 'zelle', 'card', 'check'));
alter table public.order_requests add column if not exists paid boolean not null default false;
alter table public.order_requests add column if not exists text_ok boolean not null default false;
