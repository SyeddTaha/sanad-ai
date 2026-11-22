-- One explicitly synthetic program; no real government policy or configurable security checks.
create table public.rule_versions (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version>0),
  program_ref text not null check (program_ref='program_demo'),
  policy_label text not null check (policy_label='SANAD Synthetic Relief Demo'),
  parameters jsonb not null check (jsonb_typeof(parameters)='object'),
  content_digest text not null check (content_digest ~ '^[a-f0-9]{64}$'),
  published_by uuid not null references public.profiles(id),
  published_at timestamptz not null default clock_timestamp()
);
create table public.rule_publication (
  singleton boolean primary key default true check (singleton),
  current_rule_id uuid references public.rule_versions(id)
);
insert into public.rule_publication(singleton) values(true);
create trigger immutable_history before update or delete on public.rule_versions
  for each row execute function public.sanad_reject_history_change();
alter table public.rule_versions enable row level security;
alter table public.rule_publication enable row level security;
revoke all on public.rule_versions, public.rule_publication from public, anon, authenticated, service_role;

-- Preserve B03's unavailable basis, and require a known immutable basis for all new Assessments.
create function public.sanad_guard_assessment_rule() returns trigger
language plpgsql set search_path='' as $$ begin
  if not exists(select 1 from public.rule_versions where id=new.rule_version_id)
    and not exists(select 1 from public.assessment_rule_bases where id=new.rule_version_id) then
    raise exception 'Assessment requires a known rule basis' using errcode='23514';
  end if;
  return new;
end $$;
create trigger assessment_rule before insert on public.assessments
  for each row execute function public.sanad_guard_assessment_rule();
revoke all on function public.sanad_guard_assessment_rule() from public, anon, authenticated, service_role;
