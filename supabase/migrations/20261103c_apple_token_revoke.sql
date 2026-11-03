-- ============================================================================
-- APPLE TOKEN STORE — for revoking Sign in with Apple on account deletion
-- (2026-11-03)
-- ----------------------------------------------------------------------------
-- App Store guideline 5.1.1(v): apps that offer Sign in with Apple must revoke
-- the user's Apple tokens when they delete their account. Apple's refresh token
-- is only handed to the app once, right after sign-in, so the app saves it here
-- through save_apple_refresh_token(), and api/delete-account.js (service role)
-- reads it, calls Apple's /auth/revoke, and the row disappears with the user.
--
-- Nobody but the service role can read this table: RLS is on with no policies
-- and the API roles have no grants. Safe to re-run.
-- ============================================================================

create table if not exists public.apple_auth_tokens (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at    timestamptz not null default now()
);

alter table public.apple_auth_tokens enable row level security;
revoke all on table public.apple_auth_tokens from anon, authenticated;

create or replace function public.save_apple_refresh_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if p_token is null or length(p_token) < 10 or length(p_token) > 2000 then
    raise exception 'bad token';
  end if;
  -- Only for accounts that actually have Apple linked.
  if not exists (
    select 1 from auth.identities i where i.user_id = uid and i.provider = 'apple'
  ) then
    return;
  end if;

  insert into public.apple_auth_tokens (user_id, refresh_token, updated_at)
  values (uid, p_token, now())
  on conflict (user_id) do update
    set refresh_token = excluded.refresh_token,
        updated_at    = now();
end;
$$;

revoke all on function public.save_apple_refresh_token(text) from public, anon;
grant execute on function public.save_apple_refresh_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- The Apple .p8 signing key lives in Supabase Vault (encrypted at rest) as the
-- secret named 'apple_private_key', so it doesn't have to be a Vercel env var.
-- Only the service role (api/delete-account.js) can read it.
-- Store / replace it with docs/apple-key-to-vault.sql.
-- ---------------------------------------------------------------------------
create extension if not exists supabase_vault;  -- already on in Supabase projects

create or replace function public.get_apple_private_key()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'apple_private_key'
  order by updated_at desc nulls last
  limit 1
$$;

revoke all on function public.get_apple_private_key() from public, anon, authenticated;
grant execute on function public.get_apple_private_key() to service_role;
