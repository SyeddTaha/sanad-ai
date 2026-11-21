// Real development Supabase Auth + PostgreSQL + production Next.js HTTP. No provider fixtures.
import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { NextRequest } from "next/server";
import { connectDatabase } from "../../scripts/database";
import { withAuthorizedCase } from "../../src/backend/authorization/service";
import { CaseReservationResponseSchema, ConsentResponseSchema, ConsentListResponseSchema } from "../../src/lib/consent-contract";
import { ApiErrorEnvelopeSchema, type ConsentAction } from "../../src/contracts/v1";

const base = process.env.B02_BASE_URL ?? "http://localhost:3200";
const origin = new URL(base).origin;
test("B02 live consent HTTP, authorization, transactions and revocation", async (t) => {
  const db = await connectDatabase();
  const cookies = new Map<string,string>();
  const ids = new Map<string,string>();
  const keys: string[] = [];
  const cases: string[] = [];
  const request = (path: string, actor?: string, body?: unknown, key?: string, extra: Record<string,string> = {}) => {
    if (body !== undefined) { key ??= crypto.randomUUID(); keys.push(key); }
    return fetch(base + path, { method: body === undefined ? "GET" : "POST", headers: {
      ...(actor ? { cookie: cookies.get(actor)! } : {}), ...(body === undefined ? {} : { origin, "content-type": "application/json", "idempotency-key": key! }), ...extra,
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  };
  async function error(response: Response, status: number, code: string) {
    assert.equal(response.status, status);
    assert.equal(ApiErrorEnvelopeSchema.parse(await response.json()).error.code, code);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  }
  const serviceRequest = (actor: string) => new NextRequest(base + "/api/v1/cases", { headers: { cookie: cookies.get(actor)! } });
  const permission = (caseId: string, action: ConsentAction, purpose = "synthetic_helper_assistance") => ({ caseId, action, purpose });
  const read = (actor: string, caseId: string, purpose = "synthetic_helper_assistance") => withAuthorizedCase(serviceRequest(actor), permission(caseId, "READ_EVIDENCE", purpose), async (tx) => {
    const { rows: [row] } = await tx.db.query("select citizen_id from public.cases where id=$1", [caseId]);
    return row.citizen_id;
  });
  let caseId = "";
  let department = "";
  const helperBody = () => ({ recipientType: "PRINCIPAL", recipientId: ids.get("HELPER"), purpose: "synthetic_helper_assistance", actions: ["READ_CASE", "READ_EVIDENCE", "ADD_EVIDENCE"], expiresAt: new Date(Date.now() + 3600000).toISOString() });
  const departmentBody = () => ({ recipientType: "DEPARTMENT", recipientId: department, purpose: "synthetic_department_review", actions: ["READ_CASE", "READ_EVIDENCE", "REVIEW_CASE", "RESOLVE_CASE", "CLOSE_CASE"], expiresAt: new Date(Date.now() + 3600000).toISOString() });
  async function grant(body: unknown) {
    const response = await request(`/api/v1/cases/${caseId}/consents`, "CITIZEN_A", body);
    assert.equal(response.status, 201);
    return ConsentResponseSchema.parse(await response.json()).data;
  }
  const revoke = (id: string, version = 1) => request(`/api/v1/consents/${id}/revoke`, "CITIZEN_A", { expectedVersion: version });
  async function blockedBy(pid: number) {
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
      const { rows } = await db.query("select pid from pg_stat_activity where $1::int=any(pg_blocking_pids(pid))", [pid]);
      if (rows.length) return;
      await delay(40);
    }
    throw new Error("Expected PostgreSQL lock barrier was not reached");
  }
  try {
    await t.test("real logins and migration ledger", async () => {
      const { rows } = await db.query("select name from sanad_private.migrations order by name");
      assert.ok(rows.some((r) => r.name === "20261121000300_rbac_consent.sql"));
      for (const name of ["CITIZEN_A", "CITIZEN_B", "HELPER", "OFFICER", "ADMIN", "AUDITOR"]) {
        const email = name.toLowerCase().replaceAll("_", "-") + "@demo.sanad.test";
        const response = await request("/api/v1/auth/login", undefined, { email, password: process.env["DEMO_" + name + "_PASSWORD"] });
        assert.equal(response.status, 200, name + " login");
        const payload = await response.json();
        ids.set(name, payload.data.principal.id);
        cookies.set(name, response.headers.get("set-cookie")!.split(";")[0]);
        if (name === "OFFICER") department = payload.data.departmentIds[0];
      }
    });
    await t.test("HTTP reservation binds authenticated owner, retries once, and rejects hostile claims", async () => {
      const key = crypto.randomUUID();
      const response = await request("/api/v1/case-drafts", "CITIZEN_A", {}, key, { "x-user-id": ids.get("CITIZEN_B")!, "x-roles": "ADMIN" });
      assert.equal(response.status, 201);
      const { data } = CaseReservationResponseSchema.parse(await response.json());
      caseId = data.caseId; cases.push(caseId);
      assert.equal(data.citizenId, ids.get("CITIZEN_A"));
      assert.deepEqual((await (await request("/api/v1/case-drafts", "CITIZEN_A", {}, key)).json()).data, data);
      await error(await request("/api/v1/case-drafts", "CITIZEN_A", { roles: ["ADMIN"] }), 422, "VALIDATION_FAILED");
      await error(await request("/api/v1/case-drafts", "HELPER", {}), 403, "FORBIDDEN");
      await error(await request(`/api/v1/cases/${caseId}/consents`, "CITIZEN_B"), 403, "FORBIDDEN");
      await error(await request(`/api/v1/cases/${crypto.randomUUID()}/consents`, "CITIZEN_B"), 403, "FORBIDDEN");
      await error(await request(`/api/v1/cases/${caseId}/consents`), 401, "UNAUTHENTICATED");
      await error(await request(`/api/v1/cases/${caseId}/consents`, "CITIZEN_A", helperBody(), undefined, { origin: "https://foreign.test" }), 403, "FORBIDDEN");
      await db.query("insert into public.cases(id,citizen_id,status,assigned_officer_id,assigned_department_id) values($1,$2,'PENDING_CONSENT',$3,$4)", [caseId, ids.get("CITIZEN_A"), ids.get("OFFICER"), department]);
    });
    await t.test("real authorization boundary enforces owner isolation and scoped helper sharing", async () => {
      assert.equal(await read("CITIZEN_A", caseId), ids.get("CITIZEN_A"));
      await assert.rejects(read("CITIZEN_B", caseId));
      await assert.rejects(read("HELPER", caseId), { code: "CONSENT_REQUIRED" });
      await error(await request(`/api/v1/cases/${caseId}/consents`, "HELPER", helperBody()), 403, "FORBIDDEN");
      await error(await request(`/api/v1/cases/${caseId}/consents`, "CITIZEN_A", { ...helperBody(), purpose: "undisclosed" }), 422, "VALIDATION_FAILED");
      await error(await request(`/api/v1/cases/${caseId}/consents`, "CITIZEN_A", { ...helperBody(), actions: ["RESOLVE_CASE"] }), 422, "VALIDATION_FAILED");
      const shared = await grant(helperBody());
      assert.equal(await read("HELPER", caseId), ids.get("CITIZEN_A"));
      const completed = { citizenId: await read("HELPER", caseId) };
      const replay = () => withAuthorizedCase(serviceRequest("HELPER"), permission(caseId, "READ_EVIDENCE"), async () => completed);
      assert.deepEqual(await replay(), completed);
      await assert.rejects(withAuthorizedCase(serviceRequest("HELPER"), permission(caseId, "RESOLVE_CASE"), async () => null));
      for (const actor of ["ADMIN", "AUDITOR"]) {
        await assert.rejects(read(actor, caseId));
        await assert.rejects(withAuthorizedCase(serviceRequest(actor), permission(caseId, "ADD_EVIDENCE"), async () => null));
      }
      const departmentGrant = await grant(departmentBody());
      assert.equal(await read("OFFICER", caseId, "synthetic_department_review"), ids.get("CITIZEN_A"));
      assert.equal((await revoke(shared.id)).status, 200);
      await assert.rejects(read("HELPER", caseId));
      await assert.rejects(replay(), { code: "CONSENT_REQUIRED" });
      assert.equal(await read("OFFICER", caseId, "synthetic_department_review"), ids.get("CITIZEN_A"));
      await db.query("update public.cases set assigned_department_id=null,assigned_officer_id=null where id=$1", [caseId]);
      await assert.rejects(read("OFFICER", caseId, "synthetic_department_review"));
      await db.query("update public.cases set assigned_department_id=$2,assigned_officer_id=$3 where id=$1", [caseId, department, ids.get("OFFICER")]);
      assert.equal((await revoke(departmentGrant.id)).status, 200);
      await assert.rejects(read("OFFICER", caseId, "synthetic_department_review"));
      assert.equal((await db.query("select status from public.cases where id=$1", [caseId])).rows[0].status, "PENDING_CONSENT");
      await grant(departmentBody());
      assert.equal((await db.query("select status from public.cases where id=$1", [caseId])).rows[0].status, "SUBMITTED");
      const list = await request(`/api/v1/cases/${caseId}/consents`, "CITIZEN_A");
      assert.equal(list.status, 200);
      assert.ok(ConsentListResponseSchema.parse(await list.json()).data.items.some((g) => g.id === shared.id && g.revokedAt !== null));
    });
    await t.test("failed protected transaction rolls back changes and its allowed audit", async () => {
      const before = (await db.query("select count(*)::int as count from public.audit_events where action='ADD_EVIDENCE' and outcome='ALLOWED' and target_id=$1", [caseId])).rows[0].count;
      await assert.rejects(withAuthorizedCase(serviceRequest("CITIZEN_A"), permission(caseId, "ADD_EVIDENCE"), async (tx) => {
        await tx.db.query("update public.cases set priority='HIGH' where id=$1", [caseId]);
        throw new Error("Synthetic failure after protected write");
      }), { code: "SERVICE_UNAVAILABLE" });
      assert.equal((await db.query("select priority from public.cases where id=$1", [caseId])).rows[0].priority, "NORMAL");
      assert.equal((await db.query("select count(*)::int as count from public.audit_events where action='ADD_EVIDENCE' and outcome='ALLOWED' and target_id=$1", [caseId])).rows[0].count, before);
    });
    await t.test("write-first ordering completes before waiting HTTP revocation; later writes are denied", async () => {
      const shared = await grant(helperBody());
      let release!: () => void;
      const barrier = new Promise<void>((resolve) => { release = resolve; });
      let entered!: (pid: number) => void;
      const acquired = new Promise<number>((resolve) => { entered = resolve; });
      const write = withAuthorizedCase(serviceRequest("HELPER"), permission(caseId, "ADD_EVIDENCE"), async (tx) => {
        entered(Number((await tx.db.query("select pg_backend_pid() as pid")).rows[0].pid));
        await barrier;
        await tx.db.query("update public.cases set priority='HIGH' where id=$1", [caseId]);
      });
      const pid = await acquired;
      const withdrawal = revoke(shared.id);
      try { await blockedBy(pid); } finally { release(); }
      await write;
      assert.equal((await withdrawal).status, 200);
      await assert.rejects(withAuthorizedCase(serviceRequest("HELPER"), permission(caseId, "ADD_EVIDENCE"), async () => assert.fail("Revoked write callback ran")));
      await db.query("update public.cases set priority='NORMAL' where id=$1", [caseId]);
    });
    await t.test("revocation-first ordering blocks a concurrent protected write until it can observe revocation", async () => {
      const shared = await grant(helperBody());
      await db.query("begin");
      let write: Promise<unknown> | undefined;
      let outcome: Promise<unknown> | undefined;
      try {
        await db.query("select id from public.case_reservations where id=$1 for update", [caseId]);
        const pid = Number((await db.query("select pg_backend_pid() as pid")).rows[0].pid);
        write = withAuthorizedCase(serviceRequest("HELPER"), permission(caseId, "ADD_EVIDENCE"), async (tx) => {
          await tx.db.query("update public.cases set priority='HIGH' where id=$1", [caseId]);
          assert.fail("Write ran after committed revocation");
        });
        // Attach the rejection assertion before the transaction releases its lock.
        outcome = assert.rejects(write, { code: "CONSENT_REQUIRED" });
        await blockedBy(pid);
        await db.query(`with revoked as (update public.consent_grants set revoked_at=clock_timestamp() where id=$1 returning id)
          insert into public.audit_events(request_id,actor_id,action,outcome,target_id,authorization_ref)
          select $2,$3,'CONSENT_WITHDRAWN','ALLOWED',$4,id from revoked`, [shared.id, crypto.randomUUID(), ids.get("CITIZEN_A"), caseId]);
        await db.query("commit");
      } finally { await db.query("rollback"); }
      await outcome;
      assert.equal((await db.query("select priority from public.cases where id=$1", [caseId])).rows[0].priority, "NORMAL");
    });
    await t.test("direct database clients still cannot access case, grant or replay storage", async () => {
      for (const role of ["anon", "authenticated", "service_role"]) {
        await db.query("begin");
        try {
          await db.query(`set local role ${role}`);
          await assert.rejects(db.query("select * from public.consent_operation_keys"), { code: "42501" });
        } finally { await db.query("rollback"); }
      }
    });
  } finally {
    await db.query("rollback");
    for (const id of cases) {
      await db.query("delete from public.consent_grants where case_id=$1", [id]);
      await db.query("delete from public.cases where id=$1", [id]);
      await db.query("delete from public.case_reservations where id=$1", [id]);
    }
    if (keys.length) await db.query("delete from public.consent_operation_keys where key=any($1::text[])", [keys]);
    for (const actor of cookies.keys()) await request("/api/v1/auth/logout", actor, {});
    await db.end();
  }
});
