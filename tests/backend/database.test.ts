import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const tables = ["profiles", "role_assignments", "departments", "department_memberships",
  "case_reservations", "cases", "consent_grants", "audit_events"];

before(async () => {
  // Emulate the platform-owned objects and Supabase's permissive legacy defaults.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create table auth.sessions (id uuid primary key, user_id uuid not null, not_after timestamptz);
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  `);
  await db.exec(await readFile("supabase/migrations/20261121000100_backend_foundation.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/20261121000200_session_expiry.sql", "utf8"));
});

test("principal lookup binds a live Auth session to its owner and restricts execution", async () => {
  const id = "00000000-0000-4000-8000-000000000002";
  const session = "00000000-0000-4000-8000-000000000020";
  await db.exec(`insert into auth.users values ('${id}');
    insert into auth.sessions(id,user_id) values ('${session}', '${id}');
    insert into public.profiles (id,active) values ('${id}',true);
    insert into public.role_assignments values ('${id}','CITIZEN',now());`);
  const lookup = "select public.sanad_session_context($1,$2) as context";
  try {
    await db.exec("set role service_role");
    const { rows } = await db.query(lookup, [id, session]);
    assert.deepEqual(rows[0], { context: { principal: { id, kind: "HUMAN", roles: ["CITIZEN"], active: true }, departmentIds: [] } });
    assert.deepEqual((await db.query(lookup, [session, session])).rows[0], { context: null });
    await db.exec("set role authenticated");
    await assert.rejects(db.query(lookup, [id, session]), { code: "42501" });
  } finally { await db.exec("reset role"); }
});

test("an Auth session past its server-side expiry cannot resolve a principal", async () => {
  const id = "00000000-0000-4000-8000-000000000002";
  const session = "00000000-0000-4000-8000-000000000020";
  await db.query("update auth.sessions set not_after=now()-interval '1 minute' where id=$1", [session]);
  try {
    await db.exec("set role service_role");
    const { rows } = await db.query("select public.sanad_session_context($1,$2) as context", [id, session]);
    assert.deepEqual(rows, [{ context: null }]);
  } finally { await db.exec("reset role"); }
});
after(async () => { await db.close(); });

test("all foundation tables enforce RLS and deny direct client access, including self-promotion", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    try {
      for (const name of tables) {
        const { rows: [row] } = await db.query<{ relrowsecurity: boolean }>(
          "select relrowsecurity from pg_class where oid=$1::regclass", ["public." + name]);
        assert.equal(row.relrowsecurity, true);
        await assert.rejects(db.exec(`select * from public.${name}`), { code: "42501" });
      }
      await assert.rejects(db.exec("insert into public.role_assignments default values"), { code: "42501" });
      await assert.rejects(db.exec("update public.role_assignments set role='ADMIN'"), { code: "42501" });
    } finally { await db.exec("reset role"); }
  }
});

test("the application's service role cannot edit audit history or query private case tables", async () => {
  await db.exec("set role service_role");
  try {
    await assert.rejects(db.exec("update public.audit_events set outcome='ALLOWED'"), { code: "42501" });
    await assert.rejects(db.exec("delete from public.audit_events"), { code: "42501" });
    await assert.rejects(db.exec("select * from public.cases"), { code: "42501" });
    await assert.rejects(db.exec("update public.role_assignments set role='ADMIN'"), { code: "42501" });
  } finally { await db.exec("reset role"); }
});

test("case submission and consent must retain the reserved citizen owner", async () => {
  const citizenA = "00000000-0000-4000-8000-000000000002";
  const citizenB = "00000000-0000-4000-8000-000000000003";
  const caseId = "00000000-0000-4000-8000-000000000030";
  await db.exec(`insert into auth.users values ('${citizenB}');
    insert into public.profiles(id) values ('${citizenB}');
    insert into public.case_reservations(id,citizen_id) values ('${caseId}','${citizenA}');`);
  await assert.rejects(db.query("insert into public.cases(id,citizen_id,status) values($1,$2,'PENDING_CONSENT')", [caseId, citizenB]), { code: "23503" });
  await assert.rejects(db.query(`insert into public.consent_grants(case_id,grantor_citizen_id,recipient_type,recipient_id,purpose,actions,expires_at)
    values($1,$2,'PRINCIPAL',$3,'synthetic_helper_assistance',array['READ_CASE']::public.sanad_consent_action[],now()+interval '1 hour')`,
  [caseId, citizenB, citizenA]), { code: "23503" });
  await db.query("insert into public.cases(id,citizen_id,status) values($1,$2,'PENDING_CONSENT')", [caseId, citizenA]);
  const original = (await db.query("select version,evidence_version from public.cases where id=$1", [caseId])).rows[0];
  assert.deepEqual(original, { version: 1, evidence_version: 1 });
  await db.query("update public.cases set priority='HIGH' where id=$1", [caseId]);
  assert.deepEqual((await db.query("select version,evidence_version from public.cases where id=$1", [caseId])).rows[0], { version: 2, evidence_version: 1 });
});
