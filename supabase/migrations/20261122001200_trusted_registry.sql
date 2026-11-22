-- Server-owned synthetic issuer/key/revocation history. Never populated from notice input.
create table public.trusted_registry_records (
  kind text not null check (kind in ('ISSUER','KEY','NOTICE')),
  record_ref text not null check (record_ref ~ '^[A-Za-z0-9_-]{1,64}$'),
  version integer not null check (version > 0),
  issuer_id text not null check (issuer_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  status text not null check (status in ('ACTIVE','REVOKED','UNTRUSTED')),
  public_key jsonb,
  created_at timestamptz not null default clock_timestamp(),
  primary key (kind,record_ref,version),
  check ((kind = 'KEY') = (public_key is not null)),
  check (kind = 'KEY' or status <> 'UNTRUSTED'),
  check (kind <> 'ISSUER' or record_ref = issuer_id),
  check (public_key is null or (jsonb_typeof(public_key) = 'object'
    and public_key->>'kty' = 'OKP' and public_key->>'crv' = 'Ed25519'
    and public_key->>'x' ~ '^[A-Za-z0-9_-]{43}$'
    and public_key - array['kty','crv','x']::text[] = '{}'::jsonb))
);
alter table public.trusted_registry_records enable row level security;
revoke all on public.trusted_registry_records from public, anon, authenticated, service_role;
create trigger immutable_history before update or delete on public.trusted_registry_records
  for each row execute function public.sanad_reject_history_change();
