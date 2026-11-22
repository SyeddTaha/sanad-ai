import assert from "node:assert/strict";
import test from "node:test";
import { assessmentFixture, caseFixture } from "@/contracts/v1/fixtures";
import {
  createIdempotencyKey,
  markMutationSucceeded,
  markMutationRejected,
  bindStaffSession,
  clearStaffMutationState,
  parseStaffResponse,
  StaffApiError,
  createStaffApi,
  getStaffModeLabel,
  isLiveResolutionAvailable,
  isLiveAssessmentFresh,
  isStaffNotFoundError,
} from "./staff-api";

test("identifies the rule 404 as an optional not-published state", () => {
  assert.equal(isStaffNotFoundError(new StaffApiError("NOT_FOUND", "resource.not_found", false)), true);
  assert.equal(isStaffNotFoundError(new StaffApiError("FORBIDDEN", "authorization.denied", false)), false);
  assert.equal(isStaffNotFoundError(new Error("network")), false);
});

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
  assert.equal(keys.has(action), false);
  assert.notEqual(createIdempotencyKey(keys, action, payload), key);
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

test("live staff status label identifies server-backed configuration", () => {
  assert.match(getStaffModeLabel("live"), /Live configuration/);
});

test("live resolution stays disabled until an Assessment ID is obtained", () => {
  assert.equal(isLiveResolutionAvailable("live", null), false);
  assert.equal(isLiveResolutionAvailable("live", ""), false);
  assert.equal(isLiveResolutionAvailable("live", "70000000-0000-4000-8000-000000000001"), true);
});

test("live resolution stays disabled when evidence has changed after Assessment creation", () => {
  const assessmentId = "70000000-0000-4000-8000-000000000001";
  assert.equal(isLiveAssessmentFresh(assessmentId, 4, 4), true);
  assert.equal(isLiveAssessmentFresh(assessmentId, 4, 5), false);
  assert.equal(isLiveAssessmentFresh(null, 4, 4), false);
  assert.equal(isLiveAssessmentFresh(assessmentId, null, 4), false);
});

test("repeat success starts a new logical mutation", () => {
  const keys = new Map();
  const action = "resolve:case-1";
  const payload = { expectedVersion: 4, reviewedAssessmentId: "70000000-0000-4000-8000-000000000001", reason: "review complete" };
  const first = createIdempotencyKey(keys, action, payload);
  markMutationSucceeded(keys, action, payload);
  const repeat = createIdempotencyKey(keys, action, payload);
  assert.notEqual(repeat, first);
});

test("timeout retry reuses the pending key", () => {
  const keys = new Map();
  const action = "escalate:case-1";
  const payload = { expectedVersion: 3, reason: "needs priority review" };
  const first = createIdempotencyKey(keys, action, payload);
  const retry = createIdempotencyKey(keys, action, payload);
  assert.equal(retry, first);
});

test("definitive rejection retains the original key for exact rejection replay", () => {
  const keys = new Map();
  const action = "resolve:case-1";
  const payload = { expectedVersion: 4, reviewedAssessmentId: "70000000-0000-4000-8000-000000000001", reason: "review complete" };
  const first = createIdempotencyKey(keys, action, payload);
  markMutationRejected(keys, action, payload);
  assert.equal(createIdempotencyKey(keys, action, payload), first);
  assert.notEqual(createIdempotencyKey(keys, action, { ...payload, reason: "changed reason" }), first);
});

test("switching staff sessions clears mutation keys", () => {
  const keys = new Map();
  bindStaffSession(keys, "officer-a");
  const first = createIdempotencyKey(keys, "close:case-1", { expectedVersion: 5 });
  bindStaffSession(keys, "officer-b");
  const afterSwitch = createIdempotencyKey(keys, "close:case-1", { expectedVersion: 5 });
  assert.notEqual(afterSwitch, first);
  clearStaffMutationState(keys);
  assert.equal(keys.size, 0);
});

test("simulated B04 successful officer workflow uses returned versions and Assessment", async () => {
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    paths.push(url);
    if (url.includes("/cases?")) {
      return new Response(JSON.stringify({
        data: { items: [{
          caseId: caseFixture.id,
          departmentId: "d0000000-0000-4000-8000-000000000001",
          assignedOfficerId: "60000000-0000-4000-8000-000000000001",
          status: "SUBMITTED",
          priority: "HIGH",
          version: 2,
          createdAt: "2026-11-21T10:00:00.000Z",
          updatedAt: "2026-11-21T10:05:00.000Z",
          confidence: null,
        }], nextCursor: null },
        requestId: "00000000-0000-4000-8000-000000000001",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/assessments")) {
      return new Response(JSON.stringify({
        data: assessmentFixture,
        requestId: "00000000-0000-4000-8000-000000000001",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/resolve")) {
      return new Response(JSON.stringify({
        data: {
          case: { ...caseFixture, status: "RESOLVED", version: 5 },
          assessmentId: assessmentFixture.id,
          resolutionId: "80000000-0000-4000-8000-000000000001",
        },
        requestId: "00000000-0000-4000-8000-000000000001",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.endsWith("/close")) {
      return new Response(JSON.stringify({
        data: { case: { ...caseFixture, status: "CLOSED", version: 6 } },
        requestId: "00000000-0000-4000-8000-000000000001",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({
      data: { case: { ...caseFixture, status: "UNDER_REVIEW", version: 3 } },
      requestId: "00000000-0000-4000-8000-000000000001",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const api = createStaffApi(new Map(), "live");
    const queue = await api.getOfficerQueue(undefined, "SUBMITTED", 20, "priority");
    if (!queue) throw new Error("Expected live queue");
    assert.equal(queue.data.items[0].confidence, null);
    const started = await api.mutate("start-review", caseFixture.id, { expectedVersion: 2 });
    assert.equal(started.case.status, "UNDER_REVIEW");
    const assessment = await api.createAssessment(caseFixture.id, { expectedEvidenceVersion: caseFixture.evidenceVersion, includeAi: false });
    if (!assessment) throw new Error("Expected live Assessment");
    assert.equal(assessment.evidenceVersion, caseFixture.evidenceVersion);
    const resolved = await api.mutate("resolve", caseFixture.id, {
      expectedVersion: 4,
      reviewedAssessmentId: assessment.id,
      reason: "Reviewed synthetic dispute; missing evidence remains unknown.",
    });
    assert.equal(resolved.case.status, "RESOLVED");
    const closed = await api.mutate("close", caseFixture.id, { expectedVersion: 5 });
    assert.equal(closed.case.status, "CLOSED");
    assert.ok(paths.every((path) => path.startsWith("/api/v1/")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("simulated live API errors cover 401 403 cross-department consent stale and conflict", async () => {
  const originalFetch = globalThis.fetch;
  const scenarios = [
    [401, "UNAUTHENTICATED", "authentication.required"],
    [403, "FORBIDDEN", "authorization.denied"],
    [403, "ASSIGNMENT_REQUIRED", "department.assignment.required"],
    [403, "CONSENT_REQUIRED", "department.consent.required"],
    [409, "STALE_VERSION", "stale.case.version"],
    [409, "STALE_ASSESSMENT", "stale.assessment.evidence"],
    [409, "IDEMPOTENCY_CONFLICT", "mutation.idempotency.conflict"],
  ] as const;
  try {
    for (const [status, code, messageKey] of scenarios) {
      globalThis.fetch = async () => new Response(JSON.stringify({
        requestId: "00000000-0000-4000-8000-000000000001",
        error: { code, messageKey, fieldErrors: [], retryable: status === 401 },
      }), { status, headers: { "Content-Type": "application/json" } });
      await assert.rejects(
        createStaffApi(new Map(), "live").getOfficerQueue(),
        (error: unknown) => error instanceof StaffApiError && error.code === code,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("simulated live mutation retry reuses the pending idempotency key", async () => {
  const originalFetch = globalThis.fetch;
  const keys = new Map();
  const action = `resolve:${caseFixture.id}`;
  const payload = { expectedVersion: 4, reviewedAssessmentId: assessmentFixture.id, reason: "Review complete" };
  const first = createIdempotencyKey(keys, action, payload);
  let observedKey = "";
  globalThis.fetch = async (_input, init) => {
    observedKey = new Headers(init?.headers).get("Idempotency-Key") ?? "";
    return new Response(JSON.stringify({
      data: {
        case: { ...caseFixture, status: "RESOLVED", version: 5 },
        assessmentId: assessmentFixture.id,
        resolutionId: "80000000-0000-4000-8000-000000000001",
      },
      requestId: "00000000-0000-4000-8000-000000000001",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    await createStaffApi(keys, "live").mutate("resolve", caseFixture.id, payload);
    assert.equal(observedKey, first);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
