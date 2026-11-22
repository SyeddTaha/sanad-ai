import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPair, exportJWK } from "jose";
import { handleCase } from "../../src/backend/cases/http";
import { handleConsent } from "../../src/backend/consent/http";
import { handleRules } from "../../src/backend/rules/http";
import { createSignedNotice } from "../../src/backend/notices/signed-notice";
import { noticePayloadFixture } from "../../src/contracts/v1/fixtures";
import { AssessmentSchema } from "../../src/contracts/v1";
import { SANAD_AI_PROCESSOR_ID } from "../../src/lib/consent-contract";
import type { ReliefMessageProvider } from "../../src/backend/ai/assessment";
import { db, request, dependencies } from "../support/case-fixture";

const output = JSON.stringify({ schemaVersion: 1, extractedIssuerClaim: "Sindh Relief Authority", claimedAmountMinor: 2500000,
  paymentRef: "PAY-77821", classification: "CLARIFICATION", missingInformation: [], confidence: 0.9,
  suggestedRoute: "INFORMATION_ONLY", explanation: "payment is settled" });
const message = "Sindh Relief Authority will pay PKR 25000 PAY-77821";
const aiGrant = (caseId: string) => handleConsent(request(1, { recipientType: "AI_PROCESSOR", recipientId: SANAD_AI_PROCESSOR_ID,
  purpose: "synthetic_ai_assistance", actions: ["PROCESS_AI"], expiresAt: new Date(Date.now() + 3600000).toISOString() }), "grant", caseId, dependencies(1));
async function setup() {
  const caseId = (await (await handleConsent(request(1, {}), "reserve", undefined, dependencies(1))).json()).data.caseId as string;
  const draft = { expectedVersion: 1, noticeToken: null, messageText: message, disputeText: null, relatedCaseId: null };
  assert.equal((await handleCase(request(1, draft), "draft-save", caseId, dependencies(1))).status, 200);
  const grant = (await (await aiGrant(caseId)).json()).data;
  return { caseId, draft, grant };
}
function provider(complete: ReliefMessageProvider["complete"]): ReliefMessageProvider { return { name: "test-only", model: "test-model", complete }; }
const assess = (caseId: string, complete: ReliefMessageProvider["complete"], key = crypto.randomUUID(), includeAi = true, actor = 1) =>
  handleCase(request(actor, { expectedEvidenceVersion: 2, includeAi }, key), "assess", caseId,
    { ...dependencies(actor), assessmentOptions: { provider: provider(complete) } });
async function assertNoAssessment(caseId: string) {
  assert.equal((await db.query("select id from public.assessments where case_id=$1", [caseId])).rows.length, 0);
  assert.equal((await db.query("select key from public.case_operation_keys where case_id=$1 and operation='assess'", [caseId])).rows.length, 0);
}

test("Assessment calls adapters after commit, uses current routing policy and replays immutable metadata without another provider call", async () => {
  assert.equal((await handleRules(request(5, { programRef: "program_demo", expectedCurrentVersion: null,
    parameters: { maxMonthlyIncomeMinor: 800000, minRoutingConfidence: 0.95, integrityFailurePriority: "HIGH" } }), "publish", dependencies(5))).status, 201);
  const { caseId } = await setup();
  let calls = 0;
  let active = 0;
  const deps = { ...dependencies(1), database: async () => ({ query: async (sql: string, values?: unknown[]) => {
    const result = await db.query<Record<string, unknown>>(sql, values);
    if (sql === "begin") active++;
    if (sql === "commit" || sql === "rollback") active--;
    return result;
  }, end: async () => {} }), assessmentOptions: { provider: provider(async () => { calls++; assert.equal(active, 0); return output; }) } };
  const key = crypto.randomUUID();
  const body = { expectedEvidenceVersion: 2, includeAi: true };
  const response = await handleCase(request(1, body, key), "assess", caseId, deps);
  assert.equal(response.status, 201);
  const record = AssessmentSchema.parse((await response.json()).data);
  assert.equal(record.ai.status, "SUCCEEDED");
  assert.equal(record.ai.confidence, 0.9);
  assert.equal(record.ai.recommendedRoute, "OFFICER_REVIEW");
  assert.equal(record.findings.payment.result, "UNKNOWN");
  assert.equal(record.findings.eligibility.result, "UNKNOWN");
  assert.deepEqual(record.aiRunIds, [record.ai.runId]);
  assert.deepEqual((await (await handleCase(request(1, body, key), "assess", caseId, deps)).json()).data, record);
  assert.equal(calls, 1);
  assert.equal((await handleCase(request(1, { ...body, includeAi: false }, key), "assess", caseId, deps)).status, 409);
  assert.equal(calls, 1);
  await assert.rejects(db.query("update public.assessments set record='{}' where id=$1", [record.id]), /immutable/);
});

test("includeAi false, missing processing consent and denied roles never invoke the provider", async () => {
  const { caseId, grant } = await setup();
  const fail = async () => { assert.fail("unauthorized provider call"); };
  assert.equal((await assess(caseId, fail, undefined, false)).status, 201);
  assert.equal((await assess(caseId, fail, undefined, true, 2)).status, 403);
  assert.equal((await handleConsent(request(1, { expectedVersion: 1 }), "revoke", grant.id, dependencies(1))).status, 200);
  const response = await assess(caseId, fail);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).data.ai.status, "NOT_AUTHORIZED");
});

test("AI withdrawal during provider work discards output and consumes no successful mutation key", async () => {
  const { caseId, grant } = await setup();
  const response = await assess(caseId, async () => {
    assert.equal((await handleConsent(request(1, { expectedVersion: 1 }), "revoke", grant.id, dependencies(1))).status, 200);
    return output;
  });
  assert.equal(response.status, 403);
  await assertNoAssessment(caseId);
});

test("withdrawing then replacing AI consent cannot authorize the earlier output", async () => {
  const { caseId, grant } = await setup();
  const response = await assess(caseId, async () => {
    await handleConsent(request(1, { expectedVersion: 1 }), "revoke", grant.id, dependencies(1));
    assert.equal((await aiGrant(caseId)).status, 201);
    return output;
  });
  assert.equal(response.status, 403);
  await assertNoAssessment(caseId);
});

test("evidence modified during provider work rejects stale output", async () => {
  const { caseId, draft } = await setup();
  const response = await assess(caseId, async () => {
    assert.equal((await handleCase(request(1, { ...draft, expectedVersion: 2, messageText: "Changed synthetic evidence" }), "draft-save", caseId, dependencies(1))).status, 200);
    return output;
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "STALE_ASSESSMENT");
  await assertNoAssessment(caseId);
});

test("rule publication during provider work rejects stale policy", async () => {
  const { caseId } = await setup();
  const response = await assess(caseId, async () => {
    const rule = (await (await handleRules(request(5), "current", dependencies(5))).json()).data.rule;
    assert.equal((await handleRules(request(5, { programRef: "program_demo", expectedCurrentVersion: rule.version,
      parameters: { ...rule.parameters, minRoutingConfidence: 0.8 } }), "publish", dependencies(5))).status, 201);
    return output;
  });
  assert.equal(response.status, 409);
  await assertNoAssessment(caseId);
});

test("real Ed25519 uses durable server records; tampering and revocation remain separate from payment", async () => {
  const { publicKey, privateKey } = await generateKeyPair("Ed25519", { extractable: false });
  const jwk = await exportJWK(publicKey);
  const now = Math.floor(Date.now() / 1000);
  await db.query("insert into public.trusted_registry_records(kind,record_ref,version,issuer_id,status) values('ISSUER','synthetic_issuer',1,'synthetic_issuer','ACTIVE')");
  await db.query("insert into public.trusted_registry_records(kind,record_ref,version,issuer_id,status,public_key) values('KEY','synthetic_key',1,'synthetic_issuer','ACTIVE',$1)", [{ kty: jwk.kty, crv: jwk.crv, x: jwk.x }]);
  await db.query("insert into public.trusted_registry_records(kind,record_ref,version,issuer_id,status) values('NOTICE','synthetic_notice',1,'synthetic_issuer','ACTIVE')");
  const token = await createSignedNotice({ ...noticePayloadFixture, issuerId: "synthetic_issuer", noticeId: "synthetic_notice", issuedAt: now - 60, expiresAt: now + 3600 },
    { getSigningKey: () => ({ issuerId: "synthetic_issuer", kid: "synthetic_key", privateKey }) });
  async function check(noticeToken: string) {
    const { caseId, draft } = await setup();
    assert.equal((await handleCase(request(1, { ...draft, expectedVersion: 2, noticeToken }), "draft-save", caseId, dependencies(1))).status, 200);
    const response = await handleCase(request(1, { expectedEvidenceVersion: 3, includeAi: false }), "assess", caseId, dependencies(1));
    assert.equal(response.status, 201);
    return (await response.json()).data;
  }
  const valid = await check(token);
  assert.equal(valid.findings.signature.result, "VALID");
  assert.equal(valid.findings.expiry.result, "CURRENT");
  assert.equal(valid.findings.revocation.result, "ACTIVE");
  assert.equal(valid.findings.payment.result, "UNKNOWN");
  assert.equal(valid.findings.eligibility.result, "UNKNOWN");
  const [header, payload, signature] = token.split(".");
  assert.equal((await check(`${header}.${payload}.${signature![0] === "A" ? "B" : "A"}${signature!.slice(1)}`)).findings.signature.result, "INVALID");
  await db.query("insert into public.trusted_registry_records(kind,record_ref,version,issuer_id,status) values('NOTICE','synthetic_notice',2,'synthetic_issuer','REVOKED')");
  const revoked = await check(token);
  assert.equal(revoked.findings.signature.result, "VALID");
  assert.equal(revoked.findings.revocation.result, "REVOKED");
  assert.deepEqual((await (await handleCase(request(1), "trace", valid.caseId, dependencies(1), valid.id)).json()).data, valid);
  await assert.rejects(db.query("delete from public.trusted_registry_records"), /immutable/);
  for (const role of ["anon", "authenticated", "service_role"]) {
    await db.exec("set role " + role);
    try { await assert.rejects(db.query("select * from public.trusted_registry_records"), /permission denied/); }
    finally { await db.exec("reset role"); }
  }
});
