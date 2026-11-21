-- Match B02's reservation-lock protocol for new B03 writes, including trusted SQL writers.
create function public.sanad_lock_evidence_target() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform 1 from public.case_reservations where id=new.case_id for update;
  return new;
end $$;
do $$ declare object_name text; begin
  foreach object_name in array array['evidence_items','assessments','case_events','case_operation_keys'] loop
    execute format('create trigger authorization_lock before insert on public.%I for each row execute function public.sanad_lock_evidence_target()', object_name);
  end loop;
end $$;

create function public.sanad_guard_case_inputs() returns trigger
language plpgsql set search_path = '' as $$
declare target uuid; owner_id uuid;
begin
  target := case when tg_op='DELETE' then old.case_id else new.case_id end;
  select citizen_id into owner_id from public.case_reservations where id=target for update;
  if tg_op='DELETE' or exists(select 1 from public.cases where id=target) then
    raise exception 'Submitted inputs and historical pointers cannot be changed' using errcode='23514';
  end if;
  if tg_op='UPDATE' and (new.case_id<>old.case_id or new.version<>old.version+1
      or new.evidence_version<>old.evidence_version+1 or new.created_at<>old.created_at) then
    raise exception 'Input revisions must advance together with stable ownership' using errcode='23514';
  end if;
  if new.related_case_id is not null and not exists(select 1 from public.cases where id=new.related_case_id and citizen_id=owner_id) then
    raise exception 'Related Case must belong to the same Citizen' using errcode='23514';
  end if;
  return new;
end $$;
create trigger authorization_lock before insert or update or delete on public.case_inputs
  for each row execute function public.sanad_guard_case_inputs();
revoke all on function public.sanad_lock_evidence_target(), public.sanad_guard_case_inputs() from public, anon, authenticated, service_role;
