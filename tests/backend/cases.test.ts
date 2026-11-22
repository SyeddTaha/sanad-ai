import assert from "node:assert/strict";
import { test } from "node:test";
import { handleCase } from "../../src/backend/cases/http";
import { handleConsent } from "../../src/backend/consent/http";
import { AssessmentSchema, CaseSchema, EvidencePassportSchema } from "../../src/contracts/v1";
import { assessmentFixture as sharedAssessmentFixture } from "../../src/contracts/v1/fixtures";
const assessmentFixture = {...sharedAssessmentFixture,ruleVersionId:"b3000000-0000-4000-8000-000000000001"};
import { DraftResponseSchema } from "../../src/lib/case-contract";
import { SANAD_AI_PROCESSOR_ID } from "../../src/lib/consent-contract";
import { db, id, request, dependencies } from "../support/case-fixture";

test("Case detail returns only metadata to its Citizen and denies cross-Citizen and privileged-role access", async () => {
  const reservation = await handleConsent(request(1, {}), "reserve", undefined, dependencies(1));
  const caseId = (await reservation.json()).data.caseId;
  await db.query("insert into public.cases(id,citizen_id,status) values($1,$2,'PENDING_CONSENT')", [caseId, id(1)]);
  const response = await handleCase(request(1), "detail", caseId, dependencies(1));
  assert.equal(response.status, 200);
  const record = CaseSchema.parse((await response.json()).data);
  assert.equal(record.citizenId, id(1));
  assert.equal(record.status, "PENDING_CONSENT");
  assert.match(response.headers.get("cache-control")!, /no-store/);
  for (const actor of [2,3,4,5,6]) assert.equal((await handleCase(request(actor), "detail", caseId, dependencies(actor))).status, 403);
});

test("an explicitly authorized helper submits under department sharing; role and live consent are required on every replay", async () => {
  const caseId = (await (await handleConsent(request(1, {}), "reserve", undefined, dependencies(1))).json()).data.caseId;
  const grant = (await (await handleConsent(request(1, { recipientType: "PRINCIPAL", recipientId: id(3), purpose: "synthetic_helper_assistance",
    actions: ["WRITE_DRAFT", "SUBMIT_CASE", "READ_CASE", "READ_EVIDENCE", "REQUEST_ASSESSMENT"], expiresAt: new Date(Date.now() + 3600000).toISOString() }), "grant", caseId, dependencies(1))).json()).data;
  const body = { expectedVersion: 1, noticeToken: null, messageText: "Synthetic helper input", disputeText: null, relatedCaseId: null };
  assert.equal((await handleCase(request(2, body), "draft-save", caseId, dependencies(2))).status, 403);
  assert.equal((await handleCase(request(3, body), "draft-save", caseId, dependencies(3))).status, 200);
  await handleConsent(request(1, { recipientType: "DEPARTMENT", recipientId: id(30), purpose: "synthetic_department_review",
    actions: ["READ_CASE", "READ_EVIDENCE", "REVIEW_CASE"], expiresAt: new Date(Date.now() + 3600000).toISOString() }), "grant", caseId, dependencies(1));
  const input = { caseId, expectedDraftVersion: 2 };
  const key = crypto.randomUUID();
  const submitted = await handleCase(request(3, input, key), "submit", "", dependencies(3));
  assert.equal(submitted.status, 201);
  const original = CaseSchema.parse((await submitted.json()).data);
  assert.equal(original.status, "SUBMITTED");
  assert.equal(original.citizenId, id(1));
  await db.query("update public.cases set priority='HIGH' where id=$1", [caseId]);
  assert.deepEqual((await (await handleCase(request(3, input, key), "submit", "", dependencies(3))).json()).data, original);
  await handleConsent(request(1, { expectedVersion: 1 }), "revoke", grant.id, dependencies(1));
  assert.equal((await handleCase(request(3, input, key), "submit", "", dependencies(3))).status, 403);
  assert.equal((await handleCase(request(3, { expectedEvidenceVersion: 2, includeAi: false }), "assess", caseId, dependencies(3))).status, 403);
});

test("AI is explicitly unavailable only with processing consent; consent withdrawal denies Assessment replay", async () => {
  const caseId = (await (await handleConsent(request(1, {}), "reserve", undefined, dependencies(1))).json()).data.caseId;
  const grant = (await (await handleConsent(request(1, { recipientType: "AI_PROCESSOR", recipientId: SANAD_AI_PROCESSOR_ID, purpose: "synthetic_ai_assistance",
    actions: ["PROCESS_AI"], expiresAt: new Date(Date.now() + 3600000).toISOString() }), "grant", caseId, dependencies(1))).json()).data;
  const key = crypto.randomUUID();
  const body = { expectedEvidenceVersion: 1, includeAi: true };
  const response = await handleCase(request(1, body, key), "assess", caseId, dependencies(1));
  assert.equal(response.status, 201);
  const assessment = AssessmentSchema.parse((await response.json()).data);
  assert.equal(assessment.ai.status, "UNAVAILABLE");
  assert.equal(assessment.ai.runId, null);
  assert.equal(assessment.ai.modelVersion, null);
  assert.equal(assessment.ai.failureCode, "provider_not_configured");
  assert.equal((await handleCase(request(1), "trace", caseId, dependencies(1), assessment.id)).status, 200);
  await handleConsent(request(1, { expectedVersion: 1 }), "revoke", grant.id, dependencies(1));
  assert.equal((await handleCase(request(1, body, key), "assess", caseId, dependencies(1))).status, 403);
  assert.equal((await handleCase(request(1, { expectedEvidenceVersion: 1, includeAi: false }), "assess", caseId, dependencies(1))).status, 201);
});

test("Assessments without integrations retain UNKNOWN findings, unavailable provenance and immutable earlier input versions", async () => {
  const caseId = (await (await handleConsent(request(1, {}), "reserve", undefined, dependencies(1))).json()).data.caseId;
  const body = { expectedVersion: 1, noticeToken: null, messageText: "Untrusted synthetic claim: paid and eligible", disputeText: "Synthetic dispute", relatedCaseId: null };
  assert.equal((await handleCase(request(1, body), "draft-save", caseId, dependencies(1))).status, 200);
  const key = crypto.randomUUID();
  const input = { expectedEvidenceVersion: 2, includeAi: false };
  const response = await handleCase(request(1, input, key), "assess", caseId, dependencies(1));
  assert.equal(response.status, 201);
  const original = AssessmentSchema.parse((await response.json()).data);
  assert.equal(original.findings.signature.result, "NOT_VERIFIED");
  for (const name of ["expiry", "revocation", "recipientMatch", "payment", "eligibility"] as const) assert.equal(original.findings[name].result, "UNKNOWN");
  assert.equal(original.ruleVersionId, "b3000000-0000-4000-8000-000000000001");
  assert.equal(original.ai.status, "NOT_AUTHORIZED");
  assert.equal(original.ai.confidence, null);
  assert.equal(original.evidenceRefs.length, 2);
  assert.ok(original.missingEvidence.includes("rule_basis_unavailable"));
  assert.ok(original.sourceVersions.some((source) => source.service === "mock_payment" && source.recordRef === null));
  assert.deepEqual((await (await handleCase(request(1, input, key), "assess", caseId, dependencies(1))).json()).data, original);
  assert.equal((await handleCase(request(1, { ...body, expectedVersion: 2, messageText: "Changed synthetic input" }), "draft-save", caseId, dependencies(1))).status, 200);
  const stale = await handleCase(request(1, input), "assess", caseId, dependencies(1));
  assert.equal((await stale.json()).error.code, "STALE_ASSESSMENT");
  const current = AssessmentSchema.parse((await (await handleCase(request(1, { expectedEvidenceVersion: 3, includeAi: true }), "assess", caseId, dependencies(1))).json()).data);
  assert.equal(current.evidenceVersion, 3);
  assert.equal(current.ai.status, "NOT_AUTHORIZED");
  const historicalRequest = request(1);
  historicalRequest.nextUrl.searchParams.set("assessmentId", original.id);
  const historical = EvidencePassportSchema.parse((await (await handleCase(historicalRequest, "passport", caseId, dependencies(1))).json()).data);
  assert.equal(historical.evidenceVersion, 2);
  assert.equal(historical.assessmentId, original.id);
  assert.equal(historical.caseStatus, null);
});

test("Citizen saves reserved input and submits the same Case once, with original-outcome replay", async () => {
  const caseId = (await (await handleConsent(request(1, {}), "reserve", undefined, dependencies(1))).json()).data.caseId;
  const initial = await handleCase(request(1), "draft-read", caseId, dependencies(1));
  assert.equal(initial.status, 200);
  assert.equal(DraftResponseSchema.parse(await initial.json()).data.version, 1);
  const body = { expectedVersion: 1, noticeToken: null, messageText: "Synthetic untrusted notice", disputeText: "Synthetic payment dispute", relatedCaseId: null };
  const saved = await handleCase(request(1, body), "draft-save", caseId, dependencies(1));
  assert.equal(saved.status, 200);
  const draft = DraftResponseSchema.parse(await saved.json()).data;
  assert.equal(draft.version, 2);
  assert.equal(draft.evidenceVersion, 2);
  const key = crypto.randomUUID();
  const submission = { caseId, expectedDraftVersion: 2 };
  const response = await handleCase(request(1, submission, key), "submit", "", dependencies(1));
  assert.equal(response.status, 201);
  const record = CaseSchema.parse((await response.json()).data);
  assert.equal(record.id, caseId);
  assert.equal(record.citizenId, id(1));
  assert.equal(record.status, "PENDING_CONSENT");
  assert.equal(record.evidenceVersion, 2);
  assert.deepEqual((await (await handleCase(request(1, submission, key), "submit", "", dependencies(1))).json()).data, record);
  const changed = await handleCase(request(1, { ...submission, expectedDraftVersion: 3 }, key), "submit", "", dependencies(1));
  assert.equal((await changed.json()).error.code, "IDEMPOTENCY_CONFLICT");
  assert.equal((await handleCase(request(1, submission), "submit", "", dependencies(1))).status, 409);
  assert.equal((await handleCase(request(1, { ...body, expectedVersion: 2 }), "draft-save", caseId, dependencies(1))).status, 409);
  assert.equal((await handleCase(request(2), "draft-read", caseId, dependencies(2))).status, 403);
});

test("evidence addition is immutable, versioned, replayable and reauthorizes after helper withdrawal", async () => {
  const caseId = (await (await handleConsent(request(1, {}), "reserve", undefined, dependencies(1))).json()).data.caseId;
  await db.query("insert into public.cases(id,citizen_id,status) values($1,$2,'PENDING_CONSENT')", [caseId, id(1)]);
  const grant = (await (await handleConsent(request(1, { recipientType: "PRINCIPAL", recipientId: id(3), purpose: "synthetic_helper_assistance",
    actions: ["ADD_EVIDENCE"], expiresAt: new Date(Date.now() + 3600000).toISOString() }), "grant", caseId, dependencies(1))).json()).data;
  const body = { expectedVersion: 1, kind: "CITIZEN_STATEMENT", content: { text: "Synthetic payment not received" }, supersedesId: null };
  const key = crypto.randomUUID();
  const response = await handleCase(request(3, body, key), "evidence-add", caseId, dependencies(3));
  assert.equal(response.status, 201);
  const data = (await response.json()).data;
  assert.equal(data.evidence.actorId, id(3));
  assert.equal(data.evidenceVersion, 2);
  assert.equal(data.caseVersion, 2);
  assert.deepEqual((await (await handleCase(request(3, body, key), "evidence-add", caseId, dependencies(3))).json()).data, data);
  const conflict = await handleCase(request(3, { ...body, content: { text: "changed" } }, key), "evidence-add", caseId, dependencies(3));
  assert.equal((await conflict.json()).error.code, "IDEMPOTENCY_CONFLICT");
  const stale = await handleCase(request(1, body), "evidence-add", caseId, dependencies(1));
  assert.equal((await stale.json()).error.code, "STALE_VERSION");
  await handleConsent(request(1, { expectedVersion: 1 }), "revoke", grant.id, dependencies(1));
  assert.equal((await handleCase(request(3, body, key), "evidence-add", caseId, dependencies(3))).status, 403);
  const correction = await handleCase(request(1, { ...body, expectedVersion: 2, kind: "CORRECTION", content: { text: "Synthetic correction" }, supersedesId: data.evidence.id }), "evidence-add", caseId, dependencies(1));
  assert.equal(correction.status, 201);
  assert.equal((await correction.json()).data.evidence.supersedesId, data.evidence.id);
  const metadata = CaseSchema.parse((await (await handleCase(request(1), "detail", caseId, dependencies(1))).json()).data);
  assert.equal(metadata.evidenceVersion, 3);
});

test("Passport reads preserve six independent findings and immutable historical Assessments with current sharing checks", async () => {
  const caseId = (await (await handleConsent(request(1, {}), "reserve", undefined, dependencies(1))).json()).data.caseId;
  const initial = { ...assessmentFixture, id: crypto.randomUUID(), caseId, evidenceRefs: [],
    contradictions: [{ fields: ["payment_amount"], sourceRefs: assessmentFixture.sourceVersions }], missingEvidence: ["synthetic_missing_record"] };
  const latest = { ...initial, id: crypto.randomUUID(), assessedAt: "2026-11-21T14:00:00Z", evidenceVersion: 2,
    findings: { ...initial.findings, payment: { ...initial.findings.payment, result: "UNKNOWN" as const, reasonCodes: ["SOURCE_UNAVAILABLE" as const] } } };
  for (const record of [initial, latest]) await db.query("insert into public.assessments(id,case_id,evidence_version,rule_version_id,assessed_at,record) values($1,$2,$3,$4,$5,$6)",
    [record.id, caseId, record.evidenceVersion, record.ruleVersionId, record.assessedAt, record]);
  const passport = await handleCase(request(1), "passport", caseId, dependencies(1));
  assert.equal(passport.status, 200);
  const data = EvidencePassportSchema.parse((await passport.json()).data);
  assert.equal(data.signature.result, "VALID"); // Synthetic persisted fixture, never client-assigned findings.
  assert.equal(data.payment.result, "UNKNOWN");
  assert.equal(data.caseStatus, null);
  const historicalRequest = request(1);
  historicalRequest.nextUrl.searchParams.set("assessmentId", initial.id);
  const old = EvidencePassportSchema.parse((await (await handleCase(historicalRequest, "passport", caseId, dependencies(1))).json()).data);
  assert.equal(old.payment.result, "PENDING");
  assert.equal(old.assessmentId, initial.id);
  assert.deepEqual(old.contradictions, initial.contradictions);
  assert.deepEqual(old.missingEvidence, ["synthetic_missing_record"]);
  const trace = await handleCase(request(1), "trace", caseId, dependencies(1), initial.id);
  assert.deepEqual(AssessmentSchema.parse((await trace.json()).data), initial);
  for (const actor of [2,3,5,6]) assert.equal((await handleCase(request(actor), "passport", caseId, dependencies(actor))).status, 403);
});

test("withdrawing evidence sharing denies subsequent Passport reads while independent Case metadata sharing survives", async () => {
  const caseId = (await (await handleConsent(request(1, {}), "reserve", undefined, dependencies(1))).json()).data.caseId;
  const initial = { ...assessmentFixture, id: crypto.randomUUID(), caseId, evidenceRefs: [] };
  await db.query("insert into public.assessments(id,case_id,evidence_version,rule_version_id,assessed_at,record) values($1,$2,$3,$4,$5,$6)",
    [initial.id, caseId, initial.evidenceVersion, initial.ruleVersionId, initial.assessedAt, initial]);
  await db.query("insert into public.cases(id,citizen_id,status) values($1,$2,'PENDING_CONSENT')", [caseId, id(1)]);
  const share = async (actions: string[]) => (await (await handleConsent(request(1, { recipientType: "PRINCIPAL", recipientId: id(3),
    purpose: "synthetic_helper_assistance", actions, expiresAt: new Date(Date.now() + 3600000).toISOString() }), "grant", caseId, dependencies(1))).json()).data;
  await share(["READ_CASE"]);
  const grant = await share(["READ_EVIDENCE"]);
  assert.equal((await handleCase(request(3), "passport", caseId, dependencies(3))).status, 200);
  assert.equal((await handleConsent(request(1, { expectedVersion: 1 }), "revoke", grant.id, dependencies(1))).status, 200);
  assert.equal((await handleCase(request(3), "passport", caseId, dependencies(3))).status, 403);
  assert.equal((await handleCase(request(3), "detail", caseId, dependencies(3))).status, 200);
});

test("Case history includes append-only evidence and consent events and uses validated bounded pagination", async () => {
  const caseId = (await (await handleConsent(request(1, {}), "reserve", undefined, dependencies(1))).json()).data.caseId;
  await db.query("insert into public.cases(id,citizen_id,status) values($1,$2,'PENDING_CONSENT')", [caseId, id(1)]);
  await handleCase(request(1, { expectedVersion: 1, kind: "CITIZEN_STATEMENT", content: { text: "Synthetic history" }, supersedesId: null }), "evidence-add", caseId, dependencies(1));
  const response = await handleCase(request(1), "history", caseId, dependencies(1));
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.ok(data.items.some((item: { action: string }) => item.action === "EVIDENCE_ADDED"));
  assert.ok(data.items.some((item: { action: string }) => item.action === "CASE_RESERVED"));
  assert.equal(JSON.stringify(data).includes("Synthetic history"), false);
  const paged = request(1);
  paged.nextUrl.searchParams.set("limit", "1");
  const first = (await (await handleCase(paged, "history", caseId, dependencies(1))).json()).data;
  assert.equal(first.items.length, 1);
  assert.equal(typeof first.nextCursor, "string");
  paged.nextUrl.searchParams.set("cursor", first.nextCursor);
  const second = (await (await handleCase(paged, "history", caseId, dependencies(1))).json()).data;
  assert.equal(second.items.length, 1);
  assert.notEqual(second.items[0].id, first.items[0].id);
  paged.nextUrl.searchParams.set("limit", "101");
  assert.equal((await handleCase(paged, "history", caseId, dependencies(1))).status, 422);
  assert.equal((await handleCase(request(2), "history", caseId, dependencies(2))).status, 403);
});

test("invalid evidence and terminal Case changes fail without private values in errors", async () => {
  const reserve = async () => (await (await handleConsent(request(1, {}), "reserve", undefined, dependencies(1))).json()).data.caseId;
  const caseId = await reserve();
  const other = await reserve();
  for (const target of [caseId, other]) await db.query("insert into public.cases(id,citizen_id,status) values($1,$2,'PENDING_CONSENT')", [target, id(1)]);
  const body = { expectedVersion: 1, kind: "CITIZEN_STATEMENT", content: { text: "Private synthetic input" }, supersedesId: null };
  for (const bad of [{ ...body, actorId: id(2) }, { ...body, kind: "SOURCE_SNAPSHOT" }, { ...body, content: { text: " " } },
    { ...body, content: { text: "x".repeat(2001) } }, { ...body, expectedVersion: "1" }, { ...body, kind: "CORRECTION" }]) {
    const response = await handleCase(request(1, bad), "evidence-add", caseId, dependencies(1));
    assert.equal(response.status, 422);
    assert.equal(JSON.stringify(await response.json()).includes("Private synthetic input"), false);
  }
  const foreign = (await (await handleCase(request(1, body), "evidence-add", other, dependencies(1))).json()).data.evidence.id;
  assert.equal((await handleCase(request(1, { ...body, kind: "CORRECTION", supersedesId: foreign }), "evidence-add", caseId, dependencies(1))).status, 422);
  await db.query("update public.cases set status='CLOSED' where id=$1", [caseId]);
  const response = await handleCase(request(1, { ...body, expectedVersion: 2 }), "evidence-add", caseId, dependencies(1));
  assert.equal((await response.json()).error.code, "INVALID_TRANSITION");
  assert.equal((await handleCase(request(2, body), "evidence-add", caseId, dependencies(2))).status, 403);
});

test("audit failure rolls back evidence, versions, history and replay keys; retry can then succeed", async () => {
  const caseId = (await (await handleConsent(request(1, {}), "reserve", undefined, dependencies(1))).json()).data.caseId;
  await db.query("insert into public.cases(id,citizen_id,status) values($1,$2,'PENDING_CONSENT')", [caseId, id(1)]);
  const body = { expectedVersion: 1, kind: "CITIZEN_STATEMENT", content: { text: "Synthetic rollback" }, supersedesId: null };
  const key = crypto.randomUUID();
  await db.exec(`create function public.test_reject_evidence_audit() returns trigger language plpgsql as $$ begin
    if new.action='EVIDENCE_ADDED' then raise exception 'synthetic audit failure'; end if; return new; end $$;
    create trigger test_evidence_audit_failure before insert on public.audit_events for each row execute function public.test_reject_evidence_audit();`);
  try {
    assert.equal((await handleCase(request(1, body, key), "evidence-add", caseId, dependencies(1))).status, 503);
    const record = (await (await handleCase(request(1), "detail", caseId, dependencies(1))).json()).data;
    assert.equal(record.version, 1);
    assert.equal(record.evidenceVersion, 1);
    const history = (await (await handleCase(request(1), "history", caseId, dependencies(1))).json()).data;
    assert.equal(history.items.some((event: { action: string }) => event.action === "EVIDENCE_ADDED"), false);
  } finally { await db.exec("drop trigger test_evidence_audit_failure on public.audit_events; drop function public.test_reject_evidence_audit()"); }
  assert.equal((await handleCase(request(1, body, key), "evidence-add", caseId, dependencies(1))).status, 201);
});

test("draft retries preserve original content; empty, stale, malformed and foreign-linked submissions fail safely", async () => {
  const reserve = async (actor = 1) => (await (await handleConsent(request(actor, {}), "reserve", undefined, dependencies(actor))).json()).data.caseId;
  const caseId = await reserve();
  const empty = await handleCase(request(1, { caseId, expectedDraftVersion: 1 }), "submit", "", dependencies(1));
  assert.equal(empty.status, 422);
  for (const input of [{}, { caseId, expectedDraftVersion: "1" }, { caseId, expectedDraftVersion: 1, citizenId: id(2) }]) {
    assert.equal((await handleCase(request(1, input), "submit", "", dependencies(1))).status, 422);
  }
  const body = { expectedVersion: 1, noticeToken: null, messageText: "Original synthetic draft", disputeText: null, relatedCaseId: null };
  const key = crypto.randomUUID();
  const first = (await (await handleCase(request(1, body, key), "draft-save", caseId, dependencies(1))).json()).data;
  assert.equal((await handleCase(request(1, { ...body, expectedVersion: 2, messageText: "Later synthetic draft" }), "draft-save", caseId, dependencies(1))).status, 200);
  assert.deepEqual((await (await handleCase(request(1, body, key), "draft-save", caseId, dependencies(1))).json()).data, first);
  const stale = await handleCase(request(1, { caseId, expectedDraftVersion: 2 }), "submit", "", dependencies(1));
  assert.equal((await stale.json()).error.code, "STALE_VERSION");
  const foreign = await reserve(2);
  await db.query("insert into public.cases(id,citizen_id,status) values($1,$2,'CLOSED')", [foreign, id(2)]);
  assert.equal((await handleCase(request(1, { ...body, expectedVersion: 3, relatedCaseId: foreign }), "draft-save", caseId, dependencies(1))).status, 403);
  const absent = await handleCase(request(1), "detail", crypto.randomUUID(), dependencies(1));
  const inaccessible = await handleCase(request(1), "detail", foreign, dependencies(1));
  assert.equal((await absent.json()).error.code, (await inaccessible.json()).error.code);
});

test("an expired assigned officer request commits the consent interruption while denying evidence", async () => {
  const caseId = (await (await handleConsent(request(1, {}), "reserve", undefined, dependencies(1))).json()).data.caseId;
  await db.query("insert into public.cases(id,citizen_id,status,assigned_officer_id,assigned_department_id) values($1,$2,'UNDER_REVIEW',$3,$4)", [caseId, id(1), id(4), id(30)]);
  await db.query(`insert into public.consent_grants(case_id,grantor_citizen_id,recipient_type,recipient_id,purpose,actions,created_at,expires_at)
    values($1,$2,'DEPARTMENT',$3,'synthetic_department_review',array['READ_CASE','READ_EVIDENCE','REVIEW_CASE']::public.sanad_consent_action[],now()-interval '2 hours',now()-interval '1 hour')`, [caseId,id(1),id(30)]);
  const denied = await handleCase(request(4), "passport", caseId, dependencies(4));
  assert.equal(denied.status, 403);
  const history = (await (await handleCase(request(1), "history", caseId, dependencies(1))).json()).data;
  const interrupted = history.items.filter((item: { action: string }) => item.action === "CONSENT_INTERRUPTED");
  assert.equal(interrupted.length, 1);
  assert.equal(interrupted[0].actorId, id(4));
});
