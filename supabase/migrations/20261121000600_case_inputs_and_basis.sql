-- Owner-approved B03 compositions: draft pointers and an explicit unavailable rule basis.
-- Inputs reference immutable evidence, so submission creates no second raw-content store.
create table public.case_inputs (
  case_id uuid primary key references public.case_reservations(id),
  version integer not null default 1 check (version > 0),
  evidence_version integer not null default 1 check (evidence_version > 0),
  notice_evidence_id uuid,
  statement_evidence_id uuid,
  related_case_id uuid references public.cases(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (notice_evidence_id,case_id) references public.evidence_items(id,case_id),
  foreign key (statement_evidence_id,case_id) references public.evidence_items(id,case_id),
  check (related_case_id is distinct from case_id)
);
alter table public.case_inputs enable row level security;
revoke all on public.case_inputs from public, anon, authenticated, service_role;

create table public.assessment_rule_bases (
  id uuid primary key,
  availability text not null check (availability = 'UNAVAILABLE'),
  version integer not null check (version = 1),
  created_at timestamptz not null default clock_timestamp()
);
insert into public.assessment_rule_bases(id,availability,version) values('b3000000-0000-4000-8000-000000000001','UNAVAILABLE',1);
alter table public.assessment_rule_bases enable row level security;
revoke all on public.assessment_rule_bases from public, anon, authenticated, service_role;
create trigger immutable_history before update or delete on public.assessment_rule_bases
  for each row execute function public.sanad_reject_history_change();

-- A JSON CHECK must reject absent identifiers as well as contradictory ones.
alter table public.assessments add constraint assessment_record_identifiers check (coalesce(
  (record->>'id')::uuid = id and (record->>'caseId')::uuid = case_id
  and (record->>'evidenceVersion')::integer = evidence_version
  and (record->>'ruleVersionId')::uuid = rule_version_id, false));
