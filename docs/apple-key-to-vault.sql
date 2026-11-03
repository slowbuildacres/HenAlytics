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
  -- Copied without the BEGIN/END lines? Add them back.
  if k not like '-----BEGIN%' then
    k := '-----BEGIN PRIVATE KEY-----' || E'\n' || k || E'\n' || '-----END PRIVATE KEY-----';
  end if;
  if k not like '-----BEGIN PRIVATE KEY-----%-----END PRIVATE KEY-----'
     or length(regexp_replace(k, '-----[A-Z ]+-----|\s', '', 'g')) < 150
     or regexp_replace(k, '-----[A-Z ]+-----|\s', '', 'g') !~ '^[A-Za-z0-9+/=]+$' then
    raise exception 'That doesn''t look like the whole .p8 key. Paste everything in the AuthKey_794HU6VJF5.p8 file in place of the PASTE line.';
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
