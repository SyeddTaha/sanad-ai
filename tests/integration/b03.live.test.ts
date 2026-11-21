// Real development Supabase/Auth/PostgreSQL and production HTTP. Synthetic inputs only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { connectDatabase } from "../../scripts/database";
import { AssessmentSchema, CaseSchema, EvidencePassportSchema } from "../../src/contracts/v1";

const base = process.env.B03_BASE_URL ?? "http://localhost:3300";
const origin = new URL(base).origin;
test("B03 live protected evidence persistence, concurrent writes and rollback", async (t) => {
  const db = await connectDatabase();
  const observer = await connectDatabase();
  const cookies = new Map<string,string>();
  const ids = new Map<string,string>();
  let departmentId = "";
  const call = (path: string, actor: string, body?: unknown, key = crypto.randomUUID(), method = body === undefined ? "GET" : "POST") => fetch(base + "/api/v1" + path, {
    method, headers: { cookie: cookies.get(actor)!, origin,
      ...(body === undefined ? {} : { "content-type": "application/json", "idempotency-key": key }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let caseId = "";
  const evidenceBody = (expectedVersion: number, text = "Synthetic live evidence") => ({ expectedVersion, kind: "CITIZEN_STATEMENT", content: { text }, supersedesId: null });
  const detail = async () => CaseSchema.parse((await (await call(`/cases/${caseId}`, "CITIZEN_A")).json()).data);
  async function grant() {
    const response = await call(`/cases/${caseId}/consents`, "CITIZEN_A", { recipientType: "PRINCIPAL", recipientId: ids.get("HELPER"), purpose: "synthetic_helper_assistance",
      actions: ["READ_CASE", "READ_EVIDENCE", "ADD_EVIDENCE"], expiresAt: new Date(Date.now() + 3600000).toISOString() });
    assert.equal(response.status, 201);
    return (await response.json()).data;
  }
  async function waitForBlocker(pid: number) {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const { rows } = await observer.query("select pid from pg_stat_activity where $1::int=any(pg_blocking_pids(pid))", [pid]);
      if (rows.length) return;
      await delay(40);
    }
    throw new Error("Database lock barrier not reached");
  }
  try {
    await t.test("real Auth logins and development migration ledger", async () => {
      for (const actor of ["CITIZEN_A", "CITIZEN_B", "HELPER", "ADMIN", "OFFICER"]) {
        const response = await fetch(base + "/api/v1/auth/login", { method: "POST", headers: { origin, "content-type": "application/json" },
          body: JSON.stringify({ email: actor.toLowerCase().replaceAll("_", "-") + "@demo.sanad.test", password: process.env["DEMO_" + actor + "_PASSWORD"] }) });
        assert.equal(response.status, 200, actor + " login");
        const data = (await response.json()).data;
        ids.set(actor, data.principal.id);
        if (actor === "OFFICER") departmentId = data.departmentIds[0];
        cookies.set(actor, response.headers.get("set-cookie")!.split(";")[0]);
      }
      const { rows } = await db.query("select name from sanad_private.migrations");
      assert.ok(rows.some((row) => row.name === "20261121000600_case_inputs_and_basis.sql"));
      const response = await call("/case-drafts", "CITIZEN_A", {});
      assert.equal(response.status, 201);
      caseId = (await response.json()).data.caseId;
    });
    await t.test("persisted draft and concurrent submission retain the reservation and create exactly one Case", async () => {
      const saved = await call(`/case-drafts/${caseId}`, "CITIZEN_A", { expectedVersion: 1, noticeToken: null, messageText: "Synthetic live draft", disputeText: "Synthetic dispute", relatedCaseId: null }, crypto.randomUUID(), "PATCH");
      assert.equal(saved.status, 200);
      assert.equal((await saved.json()).data.version, 2);
      const key = crypto.randomUUID();
      const body = { caseId, expectedDraftVersion: 2 };
      const responses = await Promise.all([call("/cases", "CITIZEN_A", body, key), call("/cases", "CITIZEN_A", body, key)]);
      assert.deepEqual(responses.map((response) => response.status), [201,201]);
      const original = CaseSchema.parse((await responses[0].json()).data);
      assert.deepEqual((await responses[1].json()).data, original);
      assert.equal(original.id, caseId);
      assert.equal(original.status, "PENDING_CONSENT");
      assert.equal(original.evidenceVersion, 2);
      assert.equal((await call("/cases", "CITIZEN_A", body)).status, 409);
      const conflict = await call("/cases", "CITIZEN_A", { ...body, expectedDraftVersion: 3 }, key);
      assert.equal((await conflict.json()).error.code, "IDEMPOTENCY_CONFLICT");
    });
    await t.test("metadata ownership, denied roles and absent Passport stay private", async () => {
      assert.equal((await detail()).citizenId, ids.get("CITIZEN_A"));
      for (const actor of ["CITIZEN_B", "HELPER", "ADMIN"]) assert.equal((await call(`/cases/${caseId}`, actor)).status, 403);
      const absent = await call(`/cases/${caseId}/evidence-passport`, "CITIZEN_A");
      assert.equal(absent.status, 404);
      assert.match(absent.headers.get("cache-control")!, /no-store/);
    });
    await t.test("evidence retries return original content and versions; changed payload conflicts", async () => {
      const key = crypto.randomUUID();
      const body = evidenceBody(1);
      const first = await call(`/cases/${caseId}/evidence`, "CITIZEN_A", body, key);
      assert.equal(first.status, 201);
      const data = (await first.json()).data;
      assert.equal(data.caseVersion, 2);
      assert.deepEqual((await (await call(`/cases/${caseId}/evidence`, "CITIZEN_A", body, key)).json()).data, data);
      const conflict = await call(`/cases/${caseId}/evidence`, "CITIZEN_A", evidenceBody(1, "Changed synthetic text"), key);
      assert.equal(conflict.status, 409);
      assert.equal((await conflict.json()).error.code, "IDEMPOTENCY_CONFLICT");
      assert.equal((await detail()).evidenceVersion, 3);
    });
    await t.test("concurrent independent writes reject stale versions; concurrent identical retries commit once", async () => {
      const replies = await Promise.all([call(`/cases/${caseId}/evidence`, "CITIZEN_A", evidenceBody(2, "Synthetic A")), call(`/cases/${caseId}/evidence`, "CITIZEN_A", evidenceBody(2, "Synthetic B"))]);
      assert.deepEqual(replies.map((response) => response.status).sort(), [201,409]);
      assert.equal((await detail()).evidenceVersion, 4);
      const key = crypto.randomUUID();
      const identical = await Promise.all([call(`/cases/${caseId}/evidence`, "CITIZEN_A", evidenceBody(3), key), call(`/cases/${caseId}/evidence`, "CITIZEN_A", evidenceBody(3), key)]);
      assert.deepEqual(identical.map((response) => response.status), [201,201]);
      assert.deepEqual((await identical[0].json()).data, (await identical[1].json()).data);
      assert.equal((await detail()).evidenceVersion, 5);
    });
    await t.test("withdrawal blocks cached evidence responses", async () => {
      const shared = await grant();
      const key = crypto.randomUUID();
      const body = evidenceBody(4);
      assert.equal((await call(`/cases/${caseId}/evidence`, "HELPER", body, key)).status, 201);
      assert.equal((await call(`/consents/${shared.id}/revoke`, "CITIZEN_A", { expectedVersion: 1 })).status, 200);
      assert.equal((await call(`/cases/${caseId}/evidence`, "HELPER", body, key)).status, 403);
      assert.equal((await call(`/cases/${caseId}/history`, "HELPER")).status, 403);
    });
    await t.test("withdrawal committed first denies an already waiting HTTP write", async () => {
      const shared = await grant();
      let pending: Promise<Response> | undefined;
      await db.query("begin");
      try {
        await db.query("select id from public.case_reservations where id=$1 for update", [caseId]);
        const pid = Number((await db.query("select pg_backend_pid() as pid")).rows[0].pid);
        pending = call(`/cases/${caseId}/evidence`, "HELPER", evidenceBody(5));
        await waitForBlocker(pid);
        await db.query("update public.consent_grants set revoked_at=clock_timestamp() where id=$1", [shared.id]);
        await db.query("commit");
      } finally { await db.query("rollback"); }
      assert.equal((await pending!).status, 403);
      assert.equal((await detail()).evidenceVersion, 6);
    });
    await t.test("Passport generation stores independent unknowns, sources and immutable historical Assessments", async () => {
      const body = { expectedEvidenceVersion: 6, includeAi: false };
      const key = crypto.randomUUID();
      const response = await call(`/cases/${caseId}/assessments`, "CITIZEN_A", body, key);
      assert.equal(response.status, 201);
      const original = AssessmentSchema.parse((await response.json()).data);
      assert.equal(original.findings.signature.result, "NOT_VERIFIED");
      for (const name of ["expiry", "revocation", "recipientMatch", "payment", "eligibility"] as const) assert.equal(original.findings[name].result, "UNKNOWN");
      assert.equal(original.ai.status, "NOT_AUTHORIZED");
      assert.ok(original.evidenceRefs.length >= 2);
      assert.equal(original.ruleVersionId, "b3000000-0000-4000-8000-000000000001");
      assert.deepEqual((await (await call(`/cases/${caseId}/assessments`, "CITIZEN_A", body, key)).json()).data, original);
      assert.equal((await call(`/cases/${caseId}/evidence`, "CITIZEN_A", evidenceBody(5, "Later synthetic evidence"))).status, 201);
      const latestResponse = await call(`/cases/${caseId}/assessments`, "CITIZEN_A", { expectedEvidenceVersion: 7, includeAi: false });
      assert.equal(latestResponse.status, 201);
      const latest = AssessmentSchema.parse((await latestResponse.json()).data);
      assert.notEqual(latest.id, original.id);
      const passport = EvidencePassportSchema.parse((await (await call(`/cases/${caseId}/evidence-passport`, "CITIZEN_A")).json()).data);
      assert.equal(passport.assessmentId, latest.id);
      const historical = EvidencePassportSchema.parse((await (await call(`/cases/${caseId}/evidence-passport?assessmentId=${original.id}`, "CITIZEN_A")).json()).data);
      assert.equal(historical.evidenceVersion, 6);
      const trace = await call(`/cases/${caseId}/assessments/${original.id}/trace`, "CITIZEN_A");
      assert.equal(trace.status, 200);
      assert.deepEqual(AssessmentSchema.parse((await trace.json()).data), original);
      assert.equal((await call(`/cases/${caseId}/evidence-passport`, "CITIZEN_B")).status, 403);
    });
    await t.test("HTTP audit failure rolls back evidence, revisions and replay keys on real PostgreSQL", async () => {
      const before = await detail();
      const key = crypto.randomUUID();
      const body = evidenceBody(before.version, "Synthetic rollback evidence");
      await db.query(`create function public.test_b03_audit_failure() returns trigger language plpgsql as $$ begin
        if new.action='EVIDENCE_ADDED' and new.outcome='ALLOWED' and new.target_id='${caseId}'::uuid then raise exception 'synthetic audit failure'; end if; return new; end $$;
        create trigger test_b03_audit_failure before insert on public.audit_events for each row execute function public.test_b03_audit_failure()`);
      try {
        assert.equal((await call(`/cases/${caseId}/evidence`, "CITIZEN_A", body, key)).status, 503);
        assert.equal((await detail()).evidenceVersion, before.evidenceVersion);
      } finally { await db.query("drop trigger test_b03_audit_failure on public.audit_events; drop function public.test_b03_audit_failure()"); }
      assert.equal((await call(`/cases/${caseId}/evidence`, "CITIZEN_A", body, key)).status, 201);
    });
    await t.test("real helper submission, department sharing, withdrawal replay denial and assigned-officer expiry", async () => {
      const target = (await (await call("/case-drafts", "CITIZEN_A", {})).json()).data.caseId;
      const helper = (await (await call(`/cases/${target}/consents`, "CITIZEN_A", { recipientType: "PRINCIPAL", recipientId: ids.get("HELPER"), purpose: "synthetic_helper_assistance",
        actions: ["WRITE_DRAFT", "SUBMIT_CASE", "READ_CASE"], expiresAt: new Date(Date.now() + 3600000).toISOString() })).json()).data;
      const department = (await (await call(`/cases/${target}/consents`, "CITIZEN_A", { recipientType: "DEPARTMENT", recipientId: departmentId, purpose: "synthetic_department_review",
        actions: ["READ_CASE", "READ_EVIDENCE", "REVIEW_CASE"], expiresAt: new Date(Date.now() + 3600000).toISOString() })).json()).data;
      const saved = await call(`/case-drafts/${target}`, "HELPER", { expectedVersion: 1, noticeToken: null, messageText: "Synthetic helper submission", disputeText: null, relatedCaseId: null }, crypto.randomUUID(), "PATCH");
      assert.equal(saved.status, 200);
      const key = crypto.randomUUID();
      const body = { caseId: target, expectedDraftVersion: 2 };
      const submission = await call("/cases", "HELPER", body, key);
      assert.equal(submission.status, 201);
      assert.equal((await submission.json()).data.status, "SUBMITTED");
      assert.equal((await call(`/consents/${helper.id}/revoke`, "CITIZEN_A", { expectedVersion: 1 })).status, 200);
      assert.equal((await call("/cases", "HELPER", body, key)).status, 403);
      assert.equal((await call(`/consents/${department.id}/revoke`, "CITIZEN_A", { expectedVersion: 1 })).status, 200);
      // B04 assignment/review is fixture setup, not a claimed implemented HTTP workflow.
      await db.query("update public.cases set assigned_officer_id=$2,assigned_department_id=$3,status='UNDER_REVIEW' where id=$1", [target, ids.get("OFFICER"), departmentId]);
      await db.query(`insert into public.consent_grants(case_id,grantor_citizen_id,recipient_type,recipient_id,purpose,actions,created_at,expires_at)
        values($1,$2,'DEPARTMENT',$3,'synthetic_department_review',array['READ_CASE','READ_EVIDENCE','REVIEW_CASE']::public.sanad_consent_action[],now()-interval '2 hours',now()-interval '1 hour')`, [target, ids.get("CITIZEN_A"), departmentId]);
      assert.equal((await call(`/cases/${target}/evidence-passport`, "OFFICER")).status, 403);
      const history = (await (await call(`/cases/${target}/history`, "CITIZEN_A")).json()).data;
      assert.equal(history.items.filter((item: { action: string }) => item.action === "CONSENT_INTERRUPTED").at(-1).actorId, ids.get("OFFICER"));
    });
    await t.test("immutable database history and direct-client permissions", async () => {
      for (const sql of ["update public.evidence_items set content='{}' where case_id=$1", "delete from public.case_events where case_id=$1", "update public.assessments set record='{}' where case_id=$1"]) {
        await db.query("begin");
        try { await assert.rejects(db.query(sql, [caseId]), { code: "23514" }); }
        finally { await db.query("rollback"); }
      }
      for (const role of ["anon", "authenticated", "service_role"]) {
        await db.query("begin");
        try {
          await db.query(`set local role ${role}`);
          await assert.rejects(db.query("select * from public.evidence_items"), { code: "42501" });
        } finally { await db.query("rollback"); }
      }
      const history = (await (await call(`/cases/${caseId}/history`, "CITIZEN_A")).json()).data;
      assert.equal(JSON.stringify(history).includes("Synthetic live evidence"), false);
    });
  } finally {
    await db.query("rollback");
    // Keep synthetic immutable Case/evidence history. End every real test session.
    for (const actor of cookies.keys()) await call("/auth/logout", actor, {});
    await db.end();
    await observer.end();
  }
});
