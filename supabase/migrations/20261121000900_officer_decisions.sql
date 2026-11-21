create table public.case_decisions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id),
  actor_id uuid not null references public.profiles(id),
  action text not null check (action in ('CASE_ASSIGNED','PRIORITY_CHANGED','CASE_ESCALATED','REVIEW_STARTED','EVIDENCE_REQUESTED','CASE_RESOLVED','CASE_CLOSED','CASE_RESUBMITTED')),
  reason text check (length(btrim(reason)) between 1 and 2000),
  previous_officer_id uuid references public.profiles(id),
  officer_id uuid references public.profiles(id),
  previous_department_id uuid references public.departments(id),
  department_id uuid references public.departments(id),
  previous_status text not null check (previous_status in ('SUBMITTED','UNDER_REVIEW','NEEDS_EVIDENCE','PENDING_CONSENT','RESOLVED','CLOSED')),
  status text not null check (status in ('SUBMITTED','UNDER_REVIEW','NEEDS_EVIDENCE','PENDING_CONSENT','RESOLVED','CLOSED')),
  case_version integer not null check (case_version>0),
  evidence_version integer not null check (evidence_version>0),
  assessment_id uuid,
  reviewed_assessment_id uuid,
  rule_version_id uuid references public.rule_versions(id),
  created_at timestamptz not null default clock_timestamp(),
  unique(case_id,case_version),
  foreign key(assessment_id,case_id) references public.assessments(id,case_id),
  foreign key(reviewed_assessment_id,case_id) references public.assessments(id,case_id),
  check ((action='CASE_RESOLVED') = (assessment_id is not null and reviewed_assessment_id is not null and rule_version_id is not null)),
  check (action not in ('CASE_ASSIGNED','PRIORITY_CHANGED','CASE_ESCALATED','EVIDENCE_REQUESTED','CASE_RESOLVED') or reason is not null)
);
create index decisions_case_idx on public.case_decisions(case_id,case_version);
create trigger immutable_history before update or delete on public.case_decisions
  for each row execute function public.sanad_reject_history_change();
create trigger authorization_lock before insert on public.case_decisions
  for each row execute function public.sanad_lock_evidence_target();
alter table public.case_decisions enable row level security;
revoke all on public.case_decisions from public, anon, authenticated, service_role;
