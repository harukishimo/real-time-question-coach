-- Stores only the relationship between an authenticated user and an encrypted
-- Vault secret. The provider API key itself must be created and updated with
-- vault.create_secret() / vault.update_secret() by a server-only operation.

create table public.user_provider_credentials (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider = 'openai'),
  vault_secret_id uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

comment on table public.user_provider_credentials is
  'User-to-provider mapping. API key values are stored only in Supabase Vault.';
comment on column public.user_provider_credentials.vault_secret_id is
  'UUID returned by vault.create_secret(); never a raw provider API key.';
comment on column public.user_provider_credentials.updated_at is
  'Updated by the server-only credential write operation.';

alter table public.user_provider_credentials enable row level security;

-- Browser-facing Supabase roles must not access credential metadata directly.
-- A later server-only API/RPC will perform scoped operations after authenticating
-- the user and must never return a decrypted Vault secret to the browser.
revoke all on table public.user_provider_credentials from anon, authenticated;
grant select, insert, update, delete on table public.user_provider_credentials to service_role;
