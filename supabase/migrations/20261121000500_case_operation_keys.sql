-- Store only immutable result references and original revisions, never raw input.
create table public.case_operation_keys (
  actor_id uuid not null references public.profiles(id),
  case_id uuid not null references public.case_reservations(id),
  operation text not null,
  key text not null check (key ~ '^[A-Za-z0-9_-]{1,128}$'),
  digest text not null check (digest ~ '^[a-f0-9]{64}$'),
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (actor_id,case_id,operation,key)
);
alter table public.case_operation_keys enable row level security;
revoke all on public.case_operation_keys from public, anon, authenticated, service_role;
create trigger immutable_history before update or delete on public.case_operation_keys
  for each row execute function public.sanad_reject_history_change();
