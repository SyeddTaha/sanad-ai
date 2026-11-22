import assert from "node:assert/strict";
import { test } from "node:test";
import { CitizenApiError, CitizenMutationKeys, citizenApi } from "./citizen-api";
import { formatEvidenceFindings } from "./citizen-evidence";

test("passport formatting exposes all six independent findings", () => {
  const timestamp = "2026-11-22T11:23:01.263Z";
  const findings = formatEvidenceFindings({
    signature: { result: "VALID", reasonCodes: ["SIGNATURE_VALID"], sourceRefs: [], observedAt: timestamp },
    expiry: { result: "CURRENT", reasonCodes: [], sourceRefs: [], observedAt: timestamp },
    revocation: { result: "REVOKED", reasonCodes: ["NOTICE_REVOKED"], sourceRefs: [], observedAt: timestamp },
    recipientMatch: { result: "MATCH", reasonCodes: [], sourceRefs: [], observedAt: timestamp },
    payment: { result: "UNKNOWN", reasonCodes: ["SOURCE_UNAVAILABLE"], sourceRefs: [], observedAt: timestamp },
    eligibility: { result: "UNKNOWN", reasonCodes: ["SOURCE_UNAVAILABLE"], sourceRefs: [], observedAt: timestamp },
  });

  assert.deepEqual(findings.map(({ key }) => key), [
    "signature",
    "expiry",
    "revocation",
    "recipientMatch",
    "payment",
    "eligibility",
  ]);
  assert.equal(findings.find(({ key }) => key === "payment")?.result, "UNKNOWN");
  assert.deepEqual(findings.find(({ key }) => key === "payment")?.reasonCodes, ["SOURCE_UNAVAILABLE"]);
});

test("mutation keys reuse the same key and payload for ambiguous retry", () => {
  const keys = new CitizenMutationKeys();
  const payload = { expectedVersion: 1, noticeToken: null, messageText: "notice", disputeText: null, relatedCaseId: null };
  const first = keys.get("draft:save:case-1", payload);
  assert.equal(keys.get("draft:save:case-1", payload), first);
});

test("changed mutation payload receives a new key", () => {
  const keys = new CitizenMutationKeys();
  const first = keys.get("draft:save:case-1", { expectedVersion: 1, messageText: "one" });
  const second = keys.get("draft:save:case-1", { expectedVersion: 1, messageText: "two" });
  assert.notEqual(first, second);
});

test("successful mutation retires the logical operation key", () => {
  const keys = new CitizenMutationKeys();
  const first = keys.get("case:submit:case-1", { caseId: "case-1", expectedDraftVersion: 1 });
  keys.retire("case:submit:case-1");
  assert.equal(keys.isTracked("case:submit:case-1"), false);
  assert.notEqual(keys.get("case:submit:case-1", { caseId: "case-1", expectedDraftVersion: 1 }), first);
});

test("session switching clears previous mutation state", () => {
  const keys = new CitizenMutationKeys();
  const previous = keys.get("consent:grant:case-1", { actions: ["READ_CASE"] });
  keys.clear();
  assert.equal(keys.isTracked("consent:grant:case-1"), false);
  assert.notEqual(keys.get("consent:grant:case-1", { actions: ["READ_CASE"] }), previous);
});

test("API errors preserve server code and retryability", () => {
  const error = new CitizenApiError("STALE_VERSION", false);
  assert.equal(error.code, "STALE_VERSION");
  assert.equal(error.retryable, false);
});

test("invalid API success payload is rejected instead of rendered", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ data: { bad: true }, requestId: "00000000-0000-4000-8000-000000000001" }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
  try {
    await assert.rejects(
      citizenApi.getDraft("00000000-0000-4000-8000-000000000002"),
      (error: unknown) => error instanceof CitizenApiError && error.code === "INVALID_API_RESPONSE",
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("anonymous auth response remains a sign-in state instead of a service failure", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({
      requestId: "00000000-0000-4000-8000-000000000001",
      error: { code: "UNAUTHENTICATED", messageKey: "auth.unauthenticated", fieldErrors: [], retryable: false },
    }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );
  try {
    await assert.rejects(
      citizenApi.getSession(),
      (error: unknown) => error instanceof CitizenApiError && error.code === "UNAUTHENTICATED",
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});
