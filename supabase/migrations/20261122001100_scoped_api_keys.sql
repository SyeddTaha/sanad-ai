-- B05: credentials are service capabilities bound to an issuing profile, not sessions.
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  principal_id uuid not null references public.profiles(id),
  name text not null check (length(trim(name)) between 1 and 80),
  secret_hash text not null unique check (secret_hash ~ '^[a-f0-9]{64}$'),
  scopes public.sanad_consent_action[] not null check (public.sanad_valid_actions(scopes)),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '30 days'),
  check (revoked_at is null or revoked_at >= created_at)
);
create index api_keys_principal_idx on public.api_keys(principal_id,id);
alter table public.api_keys enable row level security;
revoke all on public.api_keys from public, anon, authenticated, service_role;

create function public.sanad_api_key_immutable() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Credential history is immutable'; end if;
  if (to_jsonb(new) - 'revoked_at') is distinct from (to_jsonb(old) - 'revoked_at')
     or old.revoked_at is not null or new.revoked_at is null then
    raise exception 'Only credential revocation is permitted';
  end if;
  return new;
end $$;
create trigger api_key_immutable before update or delete on public.api_keys
  for each row execute function public.sanad_api_key_immutable();
revoke all on function public.sanad_api_key_immutable() from public, anon, authenticated, service_role;
