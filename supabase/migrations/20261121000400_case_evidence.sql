-- B03 private append-only evidence, Assessment provenance and Case history.
create table public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.case_reservations(id),
  kind text not null check (kind in ('NOTICE_INPUT','CITIZEN_STATEMENT','CORRECTION','SOURCE_SNAPSHOT')),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  supersedes_id uuid,
  actor_id uuid not null references public.profiles(id),
  evidence_version integer not null check (evidence_version > 0),
  created_at timestamptz not null default clock_timestamp(),
  unique (id,case_id),
  foreign key (supersedes_id,case_id) references public.evidence_items(id,case_id),
  check ((kind = 'CORRECTION') = (supersedes_id is not null)),
  check (supersedes_id is distinct from id)
);
create index evidence_case_idx on public.evidence_items(case_id,evidence_version);

create table public.assessments (
  id uuid primary key,
  case_id uuid not null references public.case_reservations(id),
  evidence_version integer not null check (evidence_version > 0),
  rule_version_id uuid not null,
  assessed_at timestamptz not null,
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  unique (id,case_id),
  check ((record->>'id')::uuid = id and (record->>'caseId')::uuid = case_id
    and (record->>'evidenceVersion')::integer = evidence_version
    and (record->>'ruleVersionId')::uuid = rule_version_id)
);
create index assessments_case_idx on public.assessments(case_id,assessed_at,id);
create table public.assessment_evidence (
  assessment_id uuid not null,
  case_id uuid not null,
  evidence_id uuid not null,
  primary key (assessment_id,evidence_id),
  foreign key (assessment_id,case_id) references public.assessments(id,case_id),
  foreign key (evidence_id,case_id) references public.evidence_items(id,case_id)
);
create table public.assessment_sources (
  assessment_id uuid not null references public.assessments(id),
  ordinal integer not null check (ordinal >= 0),
  service text not null check (service ~ '^[A-Za-z0-9_-]{1,64}$'),
  record_ref text check (record_ref ~ '^[A-Za-z0-9_-]{1,64}$'),
  source_version integer check (source_version > 0),
  observed_at timestamptz not null,
  primary key (assessment_id,ordinal),
  check ((record_ref is null) = (source_version is null))
);
create table public.case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.case_reservations(id),
  actor_id uuid references public.profiles(id),
  action text not null check (action ~ '^[A-Z_]{1,64}$'),
  case_version integer check (case_version > 0),
  evidence_version integer check (evidence_version > 0),
  evidence_id uuid,
  assessment_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (evidence_id,case_id) references public.evidence_items(id,case_id),
  foreign key (assessment_id,case_id) references public.assessments(id,case_id)
);
create index case_events_case_idx on public.case_events(case_id,created_at,id);

create function public.sanad_reject_history_change() returns trigger
language plpgsql set search_path = '' as $$ begin
  raise exception 'Historical records are immutable' using errcode = '23514';
end $$;
do $$ declare object_name text; begin
  foreach object_name in array array['evidence_items','assessments','assessment_evidence','assessment_sources','case_events'] loop
    execute format('alter table public.%I enable row level security', object_name);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', object_name);
    execute format('create trigger immutable_history before update or delete on public.%I for each row execute function public.sanad_reject_history_change()', object_name);
  end loop;
end $$;
revoke all on function public.sanad_reject_history_change() from public, anon, authenticated, service_role;
