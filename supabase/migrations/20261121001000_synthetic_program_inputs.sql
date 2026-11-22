-- Bounded, case-scoped mock inputs for demonstrating the fictitious published policy.
-- Only trusted setup scripts can append them; client evidence never becomes source truth.
create table public.synthetic_program_inputs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id),
  version integer not null check (version>0),
  recipient_match text not null check (recipient_match in ('MATCH','AMBIGUOUS','UNKNOWN')),
  enrollment text not null check (enrollment in ('ACTIVE','INACTIVE','UNKNOWN')),
  monthly_income_minor bigint check (monthly_income_minor between 0 and 9007199254740991),
  recorded_by uuid not null references public.profiles(id),
  recorded_at timestamptz not null default clock_timestamp(),
  unique(case_id,version)
);
create function public.sanad_append_program_input() returns trigger
language plpgsql set search_path='' as $$
declare current_status text; last_version integer;
begin
  perform 1 from public.case_reservations where id=new.case_id for update;
  select status into current_status from public.cases where id=new.case_id;
  if current_status is null or current_status in ('RESOLVED','CLOSED') then
    raise exception 'Program input requires an open submitted Case' using errcode='23514';
  end if;
  if not exists(select 1 from public.profiles p join public.role_assignments r on r.profile_id=p.id
    where p.id=new.recorded_by and p.active and r.role='ADMIN') then
    raise exception 'Synthetic source setup requires an active admin' using errcode='23514';
  end if;
  select coalesce(max(version),0) into last_version from public.synthetic_program_inputs where case_id=new.case_id;
  if new.version<>last_version+1 then raise exception 'Program source version must advance' using errcode='23514'; end if;
  return new;
end $$;
create function public.sanad_program_input_changed() returns trigger
language plpgsql set search_path='' as $$
declare target public.cases;
begin
  update public.cases set evidence_version=evidence_version+1 where id=new.case_id returning * into target;
  insert into public.case_events(case_id,actor_id,action,case_version,evidence_version)
    values(new.case_id,new.recorded_by,'PROGRAM_INPUT_RECORDED',target.version,target.evidence_version);
  insert into public.audit_events(request_id,actor_id,action,outcome,target_id,authorization_ref)
    values(gen_random_uuid(),new.recorded_by,'PROGRAM_INPUT_RECORDED','ALLOWED',new.case_id,new.id);
  return new;
end $$;
create trigger authorization_lock before insert on public.synthetic_program_inputs
  for each row execute function public.sanad_append_program_input();
create trigger source_changed after insert on public.synthetic_program_inputs
  for each row execute function public.sanad_program_input_changed();
create trigger immutable_history before update or delete on public.synthetic_program_inputs
  for each row execute function public.sanad_reject_history_change();
alter table public.synthetic_program_inputs enable row level security;
revoke all on public.synthetic_program_inputs from public, anon, authenticated, service_role;
revoke all on function public.sanad_append_program_input(),public.sanad_program_input_changed() from public, anon, authenticated, service_role;
