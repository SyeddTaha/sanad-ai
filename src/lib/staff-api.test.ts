import assert from "node:assert/strict";
import test from "node:test";
import {
  createIdempotencyKey,
  markMutationSucceeded,
  parseStaffResponse,
  StaffApiError,
  createStaffApi,
  getStaffModeLabel,
  isLiveResolutionAvailable,
} from "./staff-api";

test("creates and reuses one idempotency key for a logical mutation", () => {
  const keys = new Map();
  const action = "resolve:case-1";
  const payload = { expectedVersion: 4, reason: "reviewed" };
  assert.equal(createIdempotencyKey(keys, action, payload), createIdempotencyKey(keys, action, payload));
  assert.match(keys.get(action)!.key, /^[A-Za-z0-9_-]{1,128}$/);
});

test("uses new keys for successive or changed mutations", () => {
  const keys = new Map();
  const first = createIdempotencyKey(keys, "resolve:case-1", { expectedVersion: 4, reason: "first" });
  const secondAction = createIdempotencyKey(keys, "resolve:case-2", { expectedVersion: 4, reason: "first" });
  const changedPayload = createIdempotencyKey(keys, "resolve:case-1", { expectedVersion: 5, reason: "changed" });
  assert.notEqual(first, secondAction);
  assert.notEqual(first, changedPayload);
});

test("validates strict staff API payloads", () => {
  const parsed = parseStaffResponse({
    data: { items: [], nextCursor: null },
    requestId: "00000000-0000-4000-8000-000000000001",
  }, "officerQueue");
  assert.deepEqual(parsed, {
    data: { items: [], nextCursor: null },
    requestId: "00000000-0000-4000-8000-000000000001",
  });
});

test("rejects malformed staff API payloads", () => {
  assert.throws(() => parseStaffResponse({ items: "bad", nextCursor: null }, "officerQueue"));
});

test("preserves exact backend error codes", () => {
  const error = new StaffApiError("STALE_VERSION", "stale.case.version", false);
  assert.equal(error.code, "STALE_VERSION");
  assert.equal(error.message, "STALE_VERSION: stale.case.version");
});

test("keeps pending keys through ambiguous retries and does not reuse a succeeded key for changed payload", () => {
  const keys = new Map();
  const action = "close:case-1";
  const payload = { expectedVersion: 8 };
  const key = createIdempotencyKey(keys, action, payload);
  assert.equal(keys.get(action)?.status, "pending");
  assert.equal(createIdempotencyKey(keys, action, payload), key);
  markMutationSucceeded(keys, action, payload);
  assert.equal(keys.get(action)?.status, "succeeded");
  assert.equal(createIdempotencyKey(keys, action, payload), key);
  assert.notEqual(createIdempotencyKey(keys, action, { expectedVersion: 9 }), key);
});

test("maps authentication authorization stale and consent failures exactly", () => {
  for (const [code, messageKey] of [
    ["UNAUTHENTICATED", "authentication.required"],
    ["FORBIDDEN", "authorization.denied"],
    ["STALE_VERSION", "stale.case.version"],
    ["CONSENT_REQUIRED", "department.consent.required"],
  ] as const) {
    const error = new StaffApiError(code, messageKey, code === "UNAUTHENTICATED");
    assert.equal(error.code, code);
    assert.equal(error.messageKey, messageKey);
  }
});

test("live mode exposes fetch failures and never substitutes fixture data", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    requestId: "00000000-0000-4000-8000-000000000001",
    error: {
      code: "FORBIDDEN",
      messageKey: "authorization.denied",
      fieldErrors: [],
      retryable: false,
    },
  }), { status: 403, headers: { "Content-Type": "application/json" } });
  try {
    await assert.rejects(
      createStaffApi(new Map(), "live").getOfficerQueue(),
      (error: unknown) => error instanceof StaffApiError && error.code === "FORBIDDEN",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("status labels distinguish fixture and live configuration", () => {
  assert.match(getStaffModeLabel("fixture"), /Fixture demo/);
  assert.match(getStaffModeLabel("live"), /Live configuration/);
});

test("live resolution stays disabled until an Assessment ID is obtained", () => {
  assert.equal(isLiveResolutionAvailable("live", null), false);
  assert.equal(isLiveResolutionAvailable("live", ""), false);
  assert.equal(isLiveResolutionAvailable("live", "70000000-0000-4000-8000-000000000001"), true);
  assert.equal(isLiveResolutionAvailable("fixture", null), true);
});
