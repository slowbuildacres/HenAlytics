-- Store the Sign in with Apple key (AuthKey_794HU6VJF5.p8) in Supabase Vault.
-- 1. Replace the PASTE line below with the whole contents of the .p8 file,
--    including the -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY----- lines.
-- 2. Run. Safe to run again later to replace the key.
do $outer$
declare
  k   text := $key$
PASTE_THE_WHOLE_P8_FILE_HERE
$key$;
  sid uuid;
begin
  k := btrim(k, E' \n\r\t');
  if k not like '-----BEGIN PRIVATE KEY-----%' then
    raise exception 'Paste the whole .p8 file (starting with -----BEGIN PRIVATE KEY-----) in place of the PASTE line first.';
  end if;
  select id into sid from vault.secrets where name = 'apple_private_key';
  if sid is null then
    perform vault.create_secret(k, 'apple_private_key', 'Sign in with Apple key, used to revoke tokens on account deletion');
  else
    perform vault.update_secret(sid, k);
  end if;
end
$outer$;

select name, updated_at from vault.secrets where name = 'apple_private_key';
