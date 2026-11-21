import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server";
import { handleConsent } from "../../src/backend/consent/http";
import { authClients } from "../../src/backend/auth/supabase";
import { CaseReservationResponseSchema, ConsentResponseSchema, ConsentListResponseSchema, SANAD_AI_PROCESSOR_ID } from "../../src/lib/consent-contract";
import { withAuthorizedCase } from "../../src/backend/authorization/service";

const db = new PGlite();
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const roles = ["CITIZEN", "CITIZEN", "HELPER", "OFFICER", "ADMIN", "AUDITOR"];
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);`);
  for (const file of (await readdir("supabase/migrations")).sort()) await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  for (const [i, role] of roles.entries()) {
    await db.query("insert into auth.users values($1)", [id(i + 1)]);
    await db.query("insert into auth.sessions values($1,$2,null)", [id(i + 101), id(i + 1)]);
    await db.query("insert into public.profiles(id,active) values($1,true)", [id(i + 1)]);
    await db.query("insert into public.role_assignments(profile_id,role) values($1,$2)", [id(i + 1), role]);
  }
  await db.query("insert into public.departments(id,name) values($1,'Synthetic Department')", [id(30)]);
  await db.query("insert into public.department_memberships values($1,$2,now())", [id(4), id(30)]);
});
after(async () => { await db.close(); });

function dependencies(actor: number) {
  const transport: typeof fetch = async (input) => {
    const path = new URL(String(input instanceof Request ? input.url : input)).pathname;
    if (path === "/auth/v1/user") return Response.json({ id: id(actor), user_metadata: { roles: ["ADMIN"] } });
    if (path === "/rest/v1/rpc/sanad_session_context") return Response.json({ principal: { id: id(actor), kind: "HUMAN", roles: [roles[actor - 1]], active: true }, departmentIds: actor === 4 ? [id(30)] : [] });
    throw new Error("Unexpected Auth request");
  };
  return { clients: authClients("https://project.example.test", "public-test", "secret-test", transport),
    database: async () => ({ query: (sql: string, values?: unknown[]) => db.query<Record<string, unknown>>(sql, values), end: async () => {} }) };
}
function request(actor: number, body?: unknown, key = crypto.randomUUID(), extra: Record<string,string> = {}) {
  const token = ["header", Buffer.from(JSON.stringify({ session_id: id(actor + 100) })).toString("base64url"), "signature"].join(".");
  return new NextRequest("https://sanad.test/api/v1/case-drafts", {
    method: body === undefined ? "GET" : "POST", headers: { authorization: "Bearer " + token, origin: "https://sanad.test", "content-type": "application/json", "idempotency-key": key, ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function call(actor: number, operation: "reserve" | "list" | "grant" | "revoke", target?: string, body?: unknown, key?: string, extra?: Record<string,string>) {
  return handleConsent(request(actor, body, key, extra), operation, target, dependencies(actor));
}

let caseId: string;
test("Citizen reservation is owner-bound, idempotent and rejects client identity claims", async () => {
  const key = crypto.randomUUID();
  const response = await call(1, "reserve", undefined, {}, key, { "x-roles": "ADMIN", "x-user-id": id(2) });
  assert.equal(response.status, 201);
  const { data } = CaseReservationResponseSchema.parse(await response.json());
  caseId = data.caseId;
  assert.equal(data.citizenId, id(1));
  assert.deepEqual((await (await call(1, "reserve", undefined, {}, key)).json()).data, data);
  assert.equal((await call(1, "reserve", undefined, { citizenId: id(2) })).status, 422);
  assert.equal((await call(3, "reserve", undefined, {})).status, 403);
  assert.equal((await call(2, "list", caseId)).status, 403);
});

const helperBody = () => ({ recipientType: "PRINCIPAL", recipientId: id(3), purpose: "synthetic_helper_assistance", actions: ["READ_CASE", "READ_EVIDENCE", "ADD_EVIDENCE"], expiresAt: new Date(Date.now() + 3600000).toISOString() });
async function access(actor: number, action: "READ_EVIDENCE" | "ADD_EVIDENCE" | "RESOLVE_CASE", purpose = "synthetic_helper_assistance") {
  return withAuthorizedCase(request(actor), { caseId, action, purpose }, async () => "protected result", dependencies(actor));
}

test("citizen creates scoped sharing; helper cannot self-authorize or exceed scope; withdrawal stops subsequent reads and retries", async () => {
  await assert.rejects(access(3, "READ_EVIDENCE"), { code: "CONSENT_REQUIRED" });
  assert.equal((await call(3, "grant", caseId, helperBody())).status, 403);
  assert.equal((await call(1, "grant", caseId, { ...helperBody(), purpose: "undisclosed" })).status, 422);
  assert.equal((await call(1, "grant", caseId, { ...helperBody(), actions: ["RESOLVE_CASE"] })).status, 422);
  const key = crypto.randomUUID();
  const body = helperBody();
  const response = await call(1, "grant", caseId, body, key);
  assert.equal(response.status, 201);
  const { data } = ConsentResponseSchema.parse(await response.json());

  assert.equal(data.grantorCitizenId, id(1));
  assert.deepEqual((await (await call(1, "grant", caseId, body, key)).json()).data, data);
  assert.equal((await call(1, "grant", caseId, { ...body, actions: ["READ_CASE"] }, key)).status, 409);
  assert.equal(await access(3, "READ_EVIDENCE"), "protected result");
  await assert.rejects(access(3, "RESOLVE_CASE"), { code: "CONSENT_REQUIRED" });
  const list = ConsentListResponseSchema.parse(await (await call(1, "list", caseId)).json());
  assert.equal(list.data.items.length, 1);
  assert.equal((await call(2, "revoke", data.id, { expectedVersion: 1 })).status, 403);
  assert.equal((await call(1, "revoke", data.id, { expectedVersion: 2 })).status, 409);
  assert.equal((await call(1, "revoke", data.id, { expectedVersion: 1 })).status, 200);
  await assert.rejects(access(3, "READ_EVIDENCE"), { code: "CONSENT_REQUIRED" });
  await assert.rejects(access(3, "ADD_EVIDENCE"), { code: "CONSENT_REQUIRED" });
});

const departmentBody = () => ({ recipientType: "DEPARTMENT", recipientId: id(30), purpose: "synthetic_department_review", actions: ["READ_CASE", "READ_EVIDENCE", "REVIEW_CASE", "RESOLVE_CASE", "CLOSE_CASE"], expiresAt: new Date(Date.now() + 3600000).toISOString() });
test("department withdrawal interrupts review, restoration requires fresh review, helper withdrawal is independent and terminal history survives", async () => {
  await db.query("insert into public.cases(id,citizen_id,status,assigned_officer_id,assigned_department_id) values($1,$2,'PENDING_CONSENT',$3,$4)", [caseId, id(1), id(4), id(30)]);
  await assert.rejects(access(4, "READ_EVIDENCE", "synthetic_department_review"), { code: "CONSENT_REQUIRED" });
  const department = ConsentResponseSchema.parse(await (await call(1, "grant", caseId, departmentBody())).json()).data;
  assert.equal((await db.query<{ status: string }>("select status from public.cases where id=$1", [caseId])).rows[0].status, "SUBMITTED");
  assert.equal(await access(4, "READ_EVIDENCE", "synthetic_department_review"), "protected result");
  const helper = ConsentResponseSchema.parse(await (await call(1, "grant", caseId, helperBody())).json()).data;
  assert.equal((await call(1, "revoke", helper.id, { expectedVersion: 1 })).status, 200);
  assert.equal(await access(4, "READ_EVIDENCE", "synthetic_department_review"), "protected result");
  await db.query("update public.cases set status='UNDER_REVIEW' where id=$1", [caseId]);
  assert.equal((await call(1, "revoke", department.id, { expectedVersion: 1 })).status, 200);
  assert.equal((await db.query<{ status: string }>("select status from public.cases where id=$1", [caseId])).rows[0].status, "PENDING_CONSENT");
  await assert.rejects(access(4, "READ_EVIDENCE", "synthetic_department_review"), { code: "CONSENT_REQUIRED" });
  const restored = ConsentResponseSchema.parse(await (await call(1, "grant", caseId, departmentBody())).json()).data;
  assert.equal((await db.query<{ status: string }>("select status from public.cases where id=$1", [caseId])).rows[0].status, "SUBMITTED");
  for (const status of ["RESOLVED", "CLOSED"]) {
    await db.query("update public.cases set status=$2 where id=$1", [caseId, status]);
    const current = status === "RESOLVED" ? restored : ConsentResponseSchema.parse(await (await call(1, "grant", caseId, departmentBody())).json()).data;
    assert.equal((await call(1, "revoke", current.id, { expectedVersion: 1 })).status, 200);
    assert.equal((await db.query<{ status: string }>("select status from public.cases where id=$1", [caseId])).rows[0].status, status);
  }
});

test("failed audit persistence rolls back consent and case changes; failed protected writes leave no allowed audit", async () => {
  await db.query("update public.cases set status='PENDING_CONSENT' where id=$1", [caseId]);
  const before = (await call(1, "list", caseId));
  const count = ConsentListResponseSchema.parse(await before.json()).data.items.length;
  await db.exec(`create function public.test_reject_consent_audit() returns trigger language plpgsql as $$ begin
    if new.action='CONSENT_RESTORED' then raise exception 'synthetic audit failure'; end if; return new; end $$;
    create trigger test_audit_failure before insert on public.audit_events for each row execute function public.test_reject_consent_audit();`);
  try {
    assert.equal((await call(1, "grant", caseId, departmentBody())).status, 503);
    assert.equal(ConsentListResponseSchema.parse(await (await call(1, "list", caseId)).json()).data.items.length, count);
    assert.equal((await db.query<{status: string}>("select status from public.cases where id=$1", [caseId])).rows[0].status, "PENDING_CONSENT");
  } finally { await db.exec("drop trigger test_audit_failure on public.audit_events; drop function public.test_reject_consent_audit()"); }
  await assert.rejects(withAuthorizedCase(request(1), { caseId, action: "ADD_EVIDENCE", purpose: "synthetic_helper_assistance" }, async (tx) => {
    await tx.db.query("update public.cases set priority='HIGH' where id=$1", [caseId]);
    throw new Error("synthetic write failure");
  }, dependencies(1)), { code: "SERVICE_UNAVAILABLE" });
  assert.equal((await db.query<{priority: string}>("select priority from public.cases where id=$1", [caseId])).rows[0].priority, "NORMAL");
  const { rows } = await db.query<{action: string; outcome: string}>("select action,outcome from public.audit_events order by created_at desc limit 1");
  assert.deepEqual(rows[0], { action: "ADD_EVIDENCE", outcome: "FAILED" });
});

test("expired department grants deny reads immediately and lazy reconciliation records one interruption", async () => {
  await db.query(`insert into public.consent_grants(case_id,grantor_citizen_id,recipient_type,recipient_id,purpose,actions,created_at,expires_at)
    values($1,$2,'DEPARTMENT',$3,'synthetic_department_review',array['READ_CASE','READ_EVIDENCE','REVIEW_CASE']::public.sanad_consent_action[],now()-interval '2 hours',now()-interval '1 hour')`, [caseId,id(1),id(30)]);
  await db.query("update public.cases set status='UNDER_REVIEW' where id=$1", [caseId]);
  const before = (await db.query<{count: number}>("select count(*)::int as count from public.audit_events where action='CONSENT_INTERRUPTED'")).rows[0].count;
  await assert.rejects(access(4, "READ_EVIDENCE", "synthetic_department_review"), { code: "CONSENT_REQUIRED" });
  await assert.rejects(access(4, "READ_EVIDENCE", "synthetic_department_review"), { code: "CONSENT_REQUIRED" });
  assert.equal((await db.query<{status: string}>("select status from public.cases where id=$1", [caseId])).rows[0].status, "PENDING_CONSENT");
  assert.equal((await db.query<{count: number}>("select count(*)::int as count from public.audit_events where action='CONSENT_INTERRUPTED'")).rows[0].count, before + 1);
});

test("new storage and mutation triggers cannot be used by browser database roles", async () => {
  for (const role of ["anon", "authenticated", "service_role"]) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(db.query("select * from public.consent_operation_keys"), { code: "42501" });
      await assert.rejects(db.query("update public.consent_grants set revoked_at=now()"), { code: "42501" });
    } finally { await db.exec("reset role"); }
  }
});

test("HTTP validates processor consent, expiry, recipient roles, idempotency and cookie CSRF", async () => {
  const ai = { recipientType: "AI_PROCESSOR", recipientId: SANAD_AI_PROCESSOR_ID, purpose: "synthetic_ai_assistance", actions: ["PROCESS_AI"], expiresAt: new Date(Date.now() + 3600000).toISOString() };
  assert.equal((await call(1, "grant", caseId, ai)).status, 201);
  for (const body of [{ ...ai, recipientId: id(99) }, { ...helperBody(), recipientId: id(5) },
    { ...helperBody(), expiresAt: "2020-01-01T00:00:00Z" }, { ...helperBody(), actions: ["READ_CASE", "READ_CASE"] },
    { ...helperBody(), roles: ["ADMIN"] }, { ...helperBody(), recipientType: "DEPARTMENT" }]) assert.equal((await call(1, "grant", caseId, body)).status, 422);
  assert.equal((await call(1, "grant", caseId, helperBody(), undefined, { "idempotency-key": "" })).status, 400);
  assert.equal((await call(1, "grant", caseId, helperBody(), undefined, { "content-type": "text/plain" })).status, 415);
  assert.equal((await call(1, "reserve", undefined, {}, undefined, { cookie: "sanad-session=fake" })).status, 400);
  const token = request(1).headers.get("authorization")!.slice(7);
  const csrf = new NextRequest("https://sanad.test/api/v1/case-drafts", { method: "POST", headers: { cookie: "sanad-session=" + token, origin: "https://foreign.test", "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: "{}" });
  assert.equal((await handleConsent(csrf, "reserve", undefined, dependencies(1))).status, 403);
});

test("protected operations reload server roles and active status instead of trusting resolved or client roles", async () => {
  await db.query("delete from public.role_assignments where profile_id=$1", [id(1)]);
  try { assert.equal((await call(1, "list", caseId)).status, 403); }
  finally { await db.query("insert into public.role_assignments(profile_id,role) values($1,'CITIZEN')", [id(1)]); }
  await db.query("update public.profiles set active=false where id=$1", [id(1)]);
  try { assert.equal((await call(1, "list", caseId)).status, 403); }
  finally { await db.query("update public.profiles set active=true where id=$1", [id(1)]); }
});



