-- These RPCs are callable only with the server's service-role key. They never
-- expose a decrypted API key to a browser-facing Supabase role.

create function public.user_openai_credential_status(p_user_id uuid)
returns table (configured boolean, updated_at timestamptz)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select true, credentials.updated_at
  from public.user_provider_credentials as credentials
  where credentials.user_id = p_user_id
    and credentials.provider = 'openai';
$$;

create function public.upsert_user_openai_credential(p_user_id uuid, p_api_key text)
returns table (configured boolean, updated_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, vault
as $$
declare
  v_api_key text := btrim(p_api_key);
  v_secret_id uuid;
  v_updated_at timestamptz;
begin
  if p_user_id is null or v_api_key is null or char_length(v_api_key) < 20 or char_length(v_api_key) > 512 then
    raise exception 'invalid provider credential';
  end if;

  select credentials.vault_secret_id
    into v_secret_id
    from public.user_provider_credentials as credentials
   where credentials.user_id = p_user_id
     and credentials.provider = 'openai'
   for update;

  if found then
    perform vault.update_secret(v_secret_id, v_api_key);
    update public.user_provider_credentials
       set updated_at = now()
     where user_id = p_user_id
       and provider = 'openai'
     returning updated_at into v_updated_at;
  else
    select vault.create_secret(v_api_key) into v_secret_id;
    insert into public.user_provider_credentials (user_id, provider, vault_secret_id)
    values (p_user_id, 'openai', v_secret_id)
    returning updated_at into v_updated_at;
  end if;

  return query select true, v_updated_at;
end;
$$;

revoke all on function public.user_openai_credential_status(uuid) from public, anon, authenticated;
revoke all on function public.upsert_user_openai_credential(uuid, text) from public, anon, authenticated;
grant execute on function public.user_openai_credential_status(uuid) to service_role;
grant execute on function public.upsert_user_openai_credential(uuid, text) to service_role;
