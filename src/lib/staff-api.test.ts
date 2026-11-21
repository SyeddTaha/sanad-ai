import assert from "node:assert/strict";
import test from "node:test";
import { createIdempotencyKey, parseStaffResponse, StaffApiError } from "./staff-api";

test("creates and reuses one idempotency key for a logical mutation", () => {
  const keys = new Map<string, string>();
  const action = "resolve:case-1";
  assert.equal(createIdempotencyKey(keys, action), createIdempotencyKey(keys, action));
  assert.match(keys.get(action)!, /^[A-Za-z0-9_-]{1,128}$/);
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
