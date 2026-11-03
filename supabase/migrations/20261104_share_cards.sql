-- ============================================================================
-- SHARE CARDS — public links like henalytics.com/s/abc123 that preview on
-- Facebook (2026-11-04)
-- ----------------------------------------------------------------------------
-- The app renders a card (e.g. "Slow Build Acres grew $412 of food"), uploads
-- the image to the public "share-cards" bucket under the user's id, and saves
-- the card's numbers here. api/share-page.js (service role) reads a row by id
-- and serves the page + Open Graph tags.
--
-- Users can create and delete their own cards; nobody can list or read rows
-- through the API (the page is served server-side). Rows and images go away
-- with the account. Safe to re-run.
-- ============================================================================

create table if not exists public.share_cards (
  id          text primary key check (id ~ '^[a-z0-9]{10}$'),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text not null default 'stats' check (char_length(kind) <= 30),
  title       text not null check (char_length(title) between 1 and 120),
  subtitle    text check (char_length(subtitle) <= 200),
  emoji       text check (char_length(emoji) <= 8),
  stats       jsonb not null default '[]'::jsonb
              check (jsonb_typeof(stats) = 'array' and jsonb_array_length(stats) <= 6 and pg_column_size(stats) <= 4000),
  image_path  text not null check (char_length(image_path) <= 200),
  views       integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists share_cards_user_idx on public.share_cards (user_id, created_at desc);

alter table public.share_cards enable row level security;
revoke all on table public.share_cards from anon, authenticated;
grant insert, delete on table public.share_cards to authenticated;

drop policy if exists "share_cards insert own" on public.share_cards;
create policy "share_cards insert own" on public.share_cards
  for insert to authenticated
  with check (user_id = auth.uid() and image_path like auth.uid()::text || '/%');

drop policy if exists "share_cards delete own" on public.share_cards;
create policy "share_cards delete own" on public.share_cards
  for delete to authenticated
  using (user_id = auth.uid());

-- Simple abuse brake: at most 30 cards per user per day.
create or replace function public.share_cards_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.share_cards
      where user_id = new.user_id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Too many share links today. Try again tomorrow.';
  end if;
  return new;
end;
$$;

drop trigger if exists share_cards_rate_limit on public.share_cards;
create trigger share_cards_rate_limit before insert on public.share_cards
  for each row execute function public.share_cards_rate_limit();

-- View counter bump, called by api/share-page.js (service role only).
create or replace function public.share_card_viewed(p_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.share_cards set views = views + 1 where id = p_id;
$$;
revoke all on function public.share_card_viewed(text) from public, anon, authenticated;
grant execute on function public.share_card_viewed(text) to service_role;

-- ---------------------------------------------------------------------------
-- Storage: public-read bucket, 1 MB JPEG/PNG max, users write only their own
-- folder ({user id}/...).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('share-cards', 'share-cards', true, 1048576, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg', 'image/png'];

drop policy if exists "share-cards upload own" on storage.objects;
create policy "share-cards upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'share-cards' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "share-cards delete own" on storage.objects;
create policy "share-cards delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'share-cards' and (storage.foldername(name))[1] = auth.uid()::text);
