-- Auth may retain an expired session row. Existence alone is not sufficient.
create or replace function public.sanad_session_context(actor uuid, session uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'principal', jsonb_build_object('id', s.user_id, 'kind', 'HUMAN', 'active', coalesce(p.active,false),
      'roles', array(select role from public.role_assignments where profile_id = p.id order by role)),
    'departmentIds', array(select department_id from public.department_memberships where profile_id = p.id order by department_id)
  )
  from auth.sessions s left join public.profiles p on p.id = s.user_id
  where s.id = session and s.user_id = actor and (s.not_after is null or s.not_after > now())
$$;
revoke all on function public.sanad_session_context(uuid,uuid) from public, anon, authenticated;
grant execute on function public.sanad_session_context(uuid,uuid) to service_role;
