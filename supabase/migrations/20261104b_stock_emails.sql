-- ============================================================================
-- "WHAT'S FRESH" CUSTOMER EMAILS (2026-11-04)
-- ----------------------------------------------------------------------------
-- api/stock-email.js sends a homestead's in-stock emails to its own customer
-- lists; api/stock-unsubscribe.js records unsubscribes. Both use the service
-- role, so these tables are closed to the app (RLS on, no policies, no
-- grants). Photos people add to an email go in the public "email-photos"
-- bucket under their own user id. Safe to re-run.
-- ============================================================================

create table if not exists public.stock_email_unsubscribes (
  homestead_id uuid not null references public.homesteads(id) on delete cascade,
  email        text not null check (char_length(email) <= 320),
  created_at   timestamptz not null default now(),
  primary key (homestead_id, email)
);
alter table public.stock_email_unsubscribes enable row level security;
revoke all on table public.stock_email_unsubscribes from anon, authenticated;

create table if not exists public.stock_email_sends (
  id           bigint generated always as identity primary key,
  homestead_id uuid not null references public.homesteads(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  kind         text not null check (kind in ('send', 'test')),
  recipients   integer not null default 0,
  subject      text check (char_length(subject) <= 200),
  created_at   timestamptz not null default now()
);
create index if not exists stock_email_sends_recent on public.stock_email_sends (homestead_id, created_at desc);
alter table public.stock_email_sends enable row level security;
revoke all on table public.stock_email_sends from anon, authenticated;

-- Public-read bucket for email photos: 3 MB, JPEG/PNG, own folder only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('email-photos', 'email-photos', true, 3145728, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png'];

drop policy if exists "email-photos upload own" on storage.objects;
create policy "email-photos upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'email-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "email-photos delete own" on storage.objects;
create policy "email-photos delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'email-photos' and (storage.foldername(name))[1] = auth.uid()::text);
