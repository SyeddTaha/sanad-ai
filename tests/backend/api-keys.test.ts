import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { handleApiKeys } from "../../src/backend/api-keys/http";
import { handleConsent } from "../../src/backend/consent/http";
import { handleCase } from "../../src/backend/cases/http";
import { handleOfficerAction, handleStaffQueue } from "../../src/backend/officers/http";
import { ApiErrorEnvelopeSchema } from "../../src/contracts/v1";
import { db, id, request, dependencies } from "../support/case-fixture";

function apiRequest(key: string, body?: unknown, headers: Record<string,string> = {}) {
  return new NextRequest("https://sanad.test/api/v1/cases", { method: body === undefined ? "GET" : "POST",
    headers: { "x-api-key": key, "content-type": "application/json", "idempotency-key": crypto.randomUUID(), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function issue(scopes: string[], actor = 3, expiresAt = new Date(Date.now() + 3600000).toISOString()) {
  const result = await handleApiKeys(request(actor, { name: "Synthetic test integration", scopes, expiresAt }), "issue", undefined, dependencies(actor));
  assert.equal(result.status, 201, "Scoped credential issuance status");
  return (await result.json()).data;
}
async function sharedDraft() {
  const caseId = (await (await handleConsent(request(1, {}), "reserve", undefined, dependencies(1))).json()).data.caseId;
  const grant = (await (await handleConsent(request(1, { recipientType: "PRINCIPAL", recipientId: "00000000-0000-4000-8000-000000000003",
    purpose: "synthetic_helper_assistance", actions: ["READ_CASE", "READ_EVIDENCE", "WRITE_DRAFT", "SUBMIT_CASE", "REQUEST_ASSESSMENT"], expiresAt: new Date(Date.now() + 3600000).toISOString() }), "grant", caseId, dependencies(1))).json()).data;
  return { caseId, grant };
}

test("issuance returns a one-time secret, while retries and listing return only metadata", async () => {
  const input = { name: "Synthetic helper integration", scopes: ["READ_CASE"], expiresAt: new Date(Date.now() + 3600000).toISOString() };
  const key = crypto.randomUUID();
  const issued = await handleApiKeys(request(3, input, key), "issue", undefined, dependencies(3));
  assert.equal(issued.status, 201);
  const first = (await issued.json()).data;
  assert.ok(typeof first.key === "string" && /^sanad_[A-Za-z0-9_-]{43}$/.test(first.key), "Credential uses the documented random format");
  assert.equal(first.credential.principalId, "00000000-0000-4000-8000-000000000003");
  assert.deepEqual(first.credential.scopes, ["READ_CASE"]);
  const retry = await handleApiKeys(request(3, input, key), "issue", undefined, dependencies(3));
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).data.key, null);
  const listed = await handleApiKeys(request(3), "list", undefined, dependencies(3));
  assert.equal(listed.status, 200);
  const body = await listed.text();
  assert.ok(body.includes(first.credential.id));
  assert.ok(!body.includes(first.key));
  assert.ok(!body.includes("hash"));
});

test("valid scoped key reads a consent-authorized draft as its server-derived service principal", async () => {
  const { caseId } = await sharedDraft();
  const issued = await issue(["READ_EVIDENCE"]);
  const response = await handleCase(apiRequest(issued.key), "draft-read", caseId, dependencies(3));
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await response.json()).data.caseId, caseId);
});

test("scopes restrict reads and mutations; role headers and a broad request cannot elevate a helper", async () => {
  const { caseId } = await sharedDraft();
  const issued = await issue(["READ_CASE"]);
  const denied = await handleCase(apiRequest(issued.key, undefined, { "x-roles": "ADMIN", "x-user-id": id(5) }), "draft-read", caseId, dependencies(3));
  assert.equal(denied.status, 403);
  assert.equal(ApiErrorEnvelopeSchema.parse(await denied.json()).error.code, "INSUFFICIENT_SCOPE");
  const write = await handleCase(apiRequest(issued.key, { expectedVersion: 1, noticeToken: null, messageText: "Synthetic", disputeText: null, relatedCaseId: null }), "draft-save", caseId, dependencies(3));
  assert.equal(ApiErrorEnvelopeSchema.parse(await write.json()).error.code, "INSUFFICIENT_SCOPE");
  const elevation = await handleApiKeys(request(3, { name: "Escalation", scopes: ["RESOLVE_CASE"], expiresAt: new Date(Date.now() + 3600000).toISOString() }), "issue", undefined, dependencies(3));
  assert.equal(elevation.status, 403);
  const officerKey = await issue(["RESOLVE_CASE", "READ_EVIDENCE", "REQUEST_ASSESSMENT"], 4);
  assert.equal((await handleOfficerAction(apiRequest(officerKey.key, { expectedVersion: 1, reviewedAssessmentId: id(100), reason: "Synthetic" }), "resolve", caseId, dependencies(4))).status, 403);
  assert.equal((await handleApiKeys(apiRequest(issued.key, {}), "issue", undefined, dependencies(3))).status, 403);
  assert.equal((await handleConsent(apiRequest(issued.key, {}), "reserve", undefined, dependencies(3))).status, 403);
});

test("withdrawal immediately blocks scoped reads and cached mutation responses; unrelated Citizens remain private", async () => {
  const { caseId, grant } = await sharedDraft();
  const issued = await issue(["READ_EVIDENCE", "WRITE_DRAFT"]);
  const body = { expectedVersion: 1, noticeToken: null, messageText: "Synthetic private statement", disputeText: null, relatedCaseId: null };
  const retryKey = crypto.randomUUID();
  const write = () => handleCase(apiRequest(issued.key, body, { "idempotency-key": retryKey }), "draft-save", caseId, dependencies(3));
  assert.equal((await write()).status, 200);
  const foreign = (await (await handleConsent(request(2, {}), "reserve", undefined, dependencies(2))).json()).data.caseId;
  const denied = await handleCase(apiRequest(issued.key), "draft-read", foreign, dependencies(3));
  assert.equal(denied.status, 403);
  assert.ok(!(await denied.text()).includes("Synthetic private statement"));
  assert.equal((await handleConsent(request(1, { expectedVersion: grant.version }), "revoke", grant.id, dependencies(1))).status, 200);
  assert.equal((await handleCase(apiRequest(issued.key), "draft-read", caseId, dependencies(3))).status, 403);
  const retry = await write();
  assert.equal(retry.status, 403);
  assert.ok(!(await retry.text()).includes(body.messageText));
});

test("only the issuing human can revoke; revocation immediately rejects a previously valid credential", async () => {
  const { caseId } = await sharedDraft();
  const issued = await issue(["READ_EVIDENCE"]);
  assert.equal((await handleCase(apiRequest(issued.key), "draft-read", caseId, dependencies(3))).status, 200);
  assert.equal((await handleApiKeys(request(5, {}), "revoke", issued.credential.id, dependencies(5))).status, 403);
  const revoked = await handleApiKeys(request(3, {}), "revoke", issued.credential.id, dependencies(3));
  assert.equal(revoked.status, 200);
  assert.ok((await revoked.json()).data.revokedAt);
  assert.equal((await handleApiKeys(request(3, {}), "revoke", issued.credential.id, dependencies(3))).status, 200);
  const denied = await handleCase(apiRequest(issued.key), "draft-read", caseId, dependencies(3));
  assert.equal(denied.status, 401);
  assert.equal(ApiErrorEnvelopeSchema.parse(await denied.json()).error.code, "INVALID_API_KEY");
});

test("expired, malformed, unknown and conflicting credentials fail closed with shared errors", async () => {
  const { createHash } = await import("node:crypto");
  const { caseId } = await sharedDraft();
  // Seed time at the database boundary, without waiting for wall-clock expiry.
  const expired = "sanad_" + "a".repeat(43);
  await db.query(`insert into public.api_keys(principal_id,name,secret_hash,scopes,created_at,expires_at)
    values($1,'Expired synthetic key',$2,array['READ_EVIDENCE']::public.sanad_consent_action[],clock_timestamp()-interval '2 days',clock_timestamp()-interval '1 day')`,
  [id(3), createHash("sha256").update(expired).digest("hex")]);
  for (const key of [expired, "malformed", "sanad_" + "b".repeat(43)]) {
    const response = await handleCase(apiRequest(key), "draft-read", caseId, dependencies(3));
    assert.equal(response.status, 401);
    assert.equal(ApiErrorEnvelopeSchema.parse(await response.json()).error.code, "INVALID_API_KEY");
  }
  const valid = await issue(["READ_EVIDENCE"]);
  for (const extra of [{ authorization: "Bearer ignored" }, { cookie: "sanad-session=ignored" }] as Record<string,string>[]) {
    const response = await handleCase(apiRequest(valid.key, undefined, extra), "draft-read", caseId, dependencies(3));
    assert.equal(response.status, 400);
    assert.equal(ApiErrorEnvelopeSchema.parse(await response.json()).error.code, "MALFORMED_REQUEST");
  }
});

test("current roles, profile activity and department membership constrain keys on every request", async () => {
  const { caseId } = await sharedDraft();
  const issued = await issue(["READ_EVIDENCE"]);
  await db.query("update public.profiles set active=false where id=$1", [id(3)]);
  try { assert.equal((await handleCase(apiRequest(issued.key), "draft-read", caseId, dependencies(3))).status, 403); }
  finally { await db.query("update public.profiles set active=true where id=$1", [id(3)]); }
  await db.query("delete from public.role_assignments where profile_id=$1 and role='HELPER'", [id(3)]);
  try { assert.equal((await handleCase(apiRequest(issued.key), "draft-read", caseId, dependencies(3))).status, 403); }
  finally { await db.query("insert into public.role_assignments(profile_id,role) values($1,'HELPER')", [id(3)]); }
  const officer = await issue(["READ_CASE"], 4);
  const queue = await handleStaffQueue(apiRequest(officer.key), "officer", dependencies(4));
  assert.equal(queue.status, 403);
  assert.equal((await queue.json()).error.code, "INSUFFICIENT_SCOPE");
});

test("failed issuance audit rolls back the credential and retry record without disclosing a secret", async () => {
  const body = { name: "Synthetic atomic issuance", scopes: ["READ_CASE"], expiresAt: new Date(Date.now()+3600000).toISOString() };
  const operationKey = crypto.randomUUID();
  await db.exec(`create function public.b05_test_audit_failure() returns trigger language plpgsql as $$ begin
    if new.action='API_KEY_ISSUED' and new.outcome='ALLOWED' then raise exception 'Synthetic audit outage'; end if; return new; end $$;
    create trigger b05_test_audit before insert on public.audit_events for each row execute function public.b05_test_audit_failure();`);
  try {
    const failed = await handleApiKeys(request(3, body, operationKey), "issue", undefined, dependencies(3));
    assert.equal(failed.status, 503);
    const text = await failed.text();
    assert.ok(!text.includes("sanad_"));
    assert.equal(ApiErrorEnvelopeSchema.parse(JSON.parse(text)).error.code, "SERVICE_UNAVAILABLE");
  } finally { await db.exec("drop trigger b05_test_audit on public.audit_events; drop function public.b05_test_audit_failure();"); }
  const retry = await handleApiKeys(request(3, body, operationKey), "issue", undefined, dependencies(3));
  assert.equal(retry.status, 201);
  assert.ok((await retry.json()).data.key);
  const list = await handleApiKeys(request(3), "list", undefined, dependencies(3));
  assert.equal((await list.json()).data.items.filter((item: {name:string}) => item.name === body.name).length, 1);
});

test("issuance rejects caller identity, invalid lifetimes, duplicate scopes and scope escalation by a Citizen", async () => {
  const body = { name: "Synthetic bounded credential", scopes: ["READ_CASE"], expiresAt: new Date(Date.now()+3600000).toISOString() };
  for (const input of [
    {...body, principalId: id(5)}, {...body, scopes: ["READ_CASE", "READ_CASE"]},
    {...body, expiresAt: new Date(Date.now()-1000).toISOString()},
    {...body, expiresAt: new Date(Date.now()+31*86400000).toISOString()},
  ]) assert.equal((await handleApiKeys(request(3, input), "issue", undefined, dependencies(3))).status, 422);
  assert.equal((await handleApiKeys(request(1, body), "issue", undefined, dependencies(1))).status, 403);
});

test("an identical issuance retry after credential expiry still returns original metadata without the secret", async () => {
  const expiresAt = new Date(Date.now()+1000).toISOString();
  const body = { name: "Synthetic expired issuance retry", scopes: ["READ_CASE"], expiresAt };
  const operationKey = crypto.randomUUID();
  const first = await handleApiKeys(request(3,body,operationKey),"issue",undefined,dependencies(3));
  assert.equal(first.status,201);
  const original = (await first.json()).data.credential;
  await new Promise(resolve => setTimeout(resolve,Math.max(0,Date.parse(expiresAt)+25-Date.now())));
  const retry = await handleApiKeys(request(3,body,operationKey),"issue",undefined,dependencies(3));
  assert.equal(retry.status,200);
  const result = (await retry.json()).data;
  assert.equal(result.key,null);
  assert.deepEqual(result.credential,original);
});
