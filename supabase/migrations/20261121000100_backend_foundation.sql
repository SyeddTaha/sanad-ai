-- Only new B01 objects are touched. Apply atomically via npm run db:migrate.
create table public.profiles (
  id uuid primary key references auth.users(id),
  active boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.sanad_role as enum ('CITIZEN','HELPER','OFFICER','ADMIN','AUDITOR');
create table public.role_assignments (
  profile_id uuid not null references public.profiles(id),
  role public.sanad_role not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, role)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 120),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.department_memberships (
  profile_id uuid not null references public.profiles(id),
  department_id uuid not null references public.departments(id),
  created_at timestamptz not null default now(),
  primary key (profile_id, department_id)
);
create index memberships_department_idx on public.department_memberships(department_id);

-- The same immutable owner/ID pair anchors both pre-submission grants and the Case.
create table public.case_reservations (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (id, citizen_id)
);
create index reservations_owner_idx on public.case_reservations(citizen_id);
create table public.cases (
  id uuid primary key,
  citizen_id uuid not null,
  status text not null check (status in ('SUBMITTED','UNDER_REVIEW','NEEDS_EVIDENCE','PENDING_CONSENT','RESOLVED','CLOSED')),
  version integer not null default 1 check (version > 0),
  evidence_version integer not null default 1 check (evidence_version > 0),
  related_case_id uuid check (related_case_id <> id),
  assigned_officer_id uuid references public.profiles(id),
  priority text not null default 'NORMAL' check (priority in ('NORMAL','HIGH')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, citizen_id),
  foreign key (id, citizen_id) references public.case_reservations(id, citizen_id),
  foreign key (related_case_id, citizen_id) references public.cases(id, citizen_id),
  check (created_at <= submitted_at and submitted_at <= updated_at)
);
create index cases_owner_idx on public.cases(citizen_id);
create index cases_officer_idx on public.cases(assigned_officer_id);

create type public.sanad_consent_action as enum (
  'READ_CASE','READ_EVIDENCE','WRITE_DRAFT','ADD_EVIDENCE','SUBMIT_CASE','REQUEST_ASSESSMENT',
  'REVIEW_CASE','RESOLVE_CASE','CLOSE_CASE','PROCESS_AI','ASSIGN_CASE','ESCALATE_CASE'
);
create function public.sanad_valid_actions(items public.sanad_consent_action[])
returns boolean language sql immutable strict set search_path = '' as $$
  select array_ndims(items) = 1 and cardinality(items) > 0
     and cardinality(items) = (select count(distinct action) from unnest(items) as action)
$$;

create table public.consent_grants (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  grantor_citizen_id uuid not null,
  recipient_type text not null check (recipient_type in ('PRINCIPAL','DEPARTMENT','AI_PROCESSOR')),
  recipient_id uuid not null,
  principal_recipient uuid generated always as (case when recipient_type = 'PRINCIPAL' then recipient_id end) stored references public.profiles(id),
  department_recipient uuid generated always as (case when recipient_type = 'DEPARTMENT' then recipient_id end) stored references public.departments(id),
  purpose text not null check (purpose ~ '^[A-Za-z0-9_-]{1,64}$'),
  actions public.sanad_consent_action[] not null check (public.sanad_valid_actions(actions)),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  foreign key (case_id, grantor_citizen_id) references public.case_reservations(id, citizen_id),
  check (expires_at > created_at and (revoked_at is null or revoked_at >= created_at))
);
create index consent_case_recipient_idx on public.consent_grants(case_id, recipient_type, recipient_id);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  actor_id uuid,
  action text not null check (action ~ '^[A-Z_]{1,64}$'),
  outcome text not null check (outcome in ('ALLOWED','DENIED','FAILED')),
  authorization_ref uuid,
  target_id uuid,
  created_at timestamptz not null default now()
);
create index audit_request_idx on public.audit_events(request_id);

create function public.sanad_bump_version() returns trigger language plpgsql set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.updated_at := statement_timestamp();
  return new;
end
$$;
create trigger version_update before update on public.profiles
  for each row execute function public.sanad_bump_version();
create trigger version_update before update on public.departments
  for each row execute function public.sanad_bump_version();
create trigger version_update before update on public.cases
  for each row execute function public.sanad_bump_version();
create trigger version_update before update on public.consent_grants
  for each row execute function public.sanad_bump_version();

alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.role_assignments enable row level security;
alter table public.department_memberships enable row level security;
alter table public.case_reservations enable row level security;
alter table public.cases enable row level security;
alter table public.consent_grants enable row level security;
alter table public.audit_events enable row level security;
-- No direct-client policies. The authenticated HTTP boundary owns disclosure.
revoke all privileges on public.profiles, public.departments, public.role_assignments,
  public.department_memberships, public.case_reservations, public.cases,
  public.consent_grants, public.audit_events from public, anon, authenticated, service_role;
grant select, insert on public.profiles, public.departments, public.role_assignments,
  public.department_memberships to service_role;
grant insert on public.audit_events to service_role;
revoke all on function public.sanad_bump_version(), public.sanad_valid_actions(public.sanad_consent_action[])
  from public, anon, authenticated;

-- The server first verifies this JWT with Auth. Only this narrow lookup needs access to auth.sessions.
create function public.sanad_session_context(actor uuid, session uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'principal', jsonb_build_object('id', s.user_id, 'kind', 'HUMAN', 'active', coalesce(p.active,false),
      'roles', array(select role from public.role_assignments where profile_id = p.id order by role)),
    'departmentIds', array(select department_id from public.department_memberships where profile_id = p.id order by department_id)
  )
  from auth.sessions s left join public.profiles p on p.id = s.user_id
  where s.id = session and s.user_id = actor
$$;
revoke all on function public.sanad_session_context(uuid,uuid) from public, anon, authenticated;
grant execute on function public.sanad_session_context(uuid,uuid) to service_role;
