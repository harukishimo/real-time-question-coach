-- Avoid PL/pgSQL's output-column name (updated_at) colliding with the
-- user_provider_credentials.updated_at column in the update branch.

create or replace function public.upsert_user_openai_credential(p_user_id uuid, p_api_key text)
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
    update public.user_provider_credentials as credentials
       set updated_at = now()
     where credentials.user_id = p_user_id
       and credentials.provider = 'openai'
     returning credentials.updated_at into v_updated_at;
  else
    select vault.create_secret(v_api_key) into v_secret_id;
    if v_secret_id is null then
      raise exception 'Vault did not return a secret id';
    end if;
    insert into public.user_provider_credentials (user_id, provider, vault_secret_id)
    values (p_user_id, 'openai', v_secret_id);
    select credentials.updated_at
      into v_updated_at
      from public.user_provider_credentials as credentials
     where credentials.user_id = p_user_id
       and credentials.provider = 'openai';
  end if;

  return query select true, v_updated_at;
end;
$$;
