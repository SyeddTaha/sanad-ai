-- B02: server-only operations retain the B01 deny-all client database boundary.
alter table public.cases add column assigned_department_id uuid references public.departments(id);
-- Existing assignments without an explicit department fail authorization until B04 supplies it.
alter table public.cases add constraint assignment_department_requires_officer
  check (assigned_department_id is null or assigned_officer_id is not null);

create table public.consent_operation_keys (
  actor_id uuid not null references public.profiles(id),
  operation text not null,
  key text not null check (length(key) between 1 and 128),
  digest text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_id, operation, key)
);
alter table public.consent_operation_keys enable row level security;
revoke all on public.consent_operation_keys from public, anon, authenticated, service_role;

-- Serialize even SQL-level case/grant changes with the server authorization lock.
create function public.sanad_lock_case_authorization() returns trigger
language plpgsql set search_path = '' as $$
declare target uuid;
begin
  if tg_table_name = 'cases' then
    target := case when tg_op = 'DELETE' then old.id else new.id end;
    if tg_op = 'UPDATE' and (new.id <> old.id or new.citizen_id <> old.citizen_id) then
      raise exception 'Case ownership is immutable' using errcode = '23514';
    end if;
  else
    target := case when tg_op = 'DELETE' then old.case_id else new.case_id end;
    if tg_op = 'UPDATE' and (new.case_id <> old.case_id or new.grantor_citizen_id <> old.grantor_citizen_id
      or new.recipient_type <> old.recipient_type or new.recipient_id <> old.recipient_id
      or new.purpose <> old.purpose or new.actions <> old.actions or new.expires_at <> old.expires_at
      or new.created_at <> old.created_at or old.revoked_at is not null) then
      raise exception 'Replace a grant by revoking and creating a new grant' using errcode = '23514';
    end if;
  end if;
  perform 1 from public.case_reservations where id = target for update;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger authorization_lock before insert or update or delete on public.cases
  for each row execute function public.sanad_lock_case_authorization();
create trigger authorization_lock before insert or update or delete on public.consent_grants
  for each row execute function public.sanad_lock_case_authorization();
revoke all on function public.sanad_lock_case_authorization() from public, anon, authenticated, service_role;
