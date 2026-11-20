import assert from "node:assert/strict";
import { test } from "node:test";
import { AuthorizationContextSchema, ConsentGrantSchema, RoleSchema } from "@/contracts/v1";
import { authorizationContextFixture, departmentGrantFixture, helperGrantFixture } from "@/contracts/v1/fixtures";

test("a scoped helper grant preserves explicit recipient, actions, purpose and withdrawal history", () => {
  assert.deepEqual(ConsentGrantSchema.parse(helperGrantFixture), helperGrantFixture);
});

test("authorization context represents verified principal, ownership, assignment and independent grants", () => {
  assert.deepEqual(AuthorizationContextSchema.parse(authorizationContextFixture), authorizationContextFixture);
  assert.equal(RoleSchema.safeParse("SHOPKEEPER").success, false);
  assert.equal(RoleSchema.safeParse("AI").success, false);
  const withdrawnHelper = { ...helperGrantFixture, revokedAt: "2026-11-21T09:00:00Z" };
  const context = { ...authorizationContextFixture, grants: [withdrawnHelper, departmentGrantFixture] };
  assert.equal(AuthorizationContextSchema.parse(context).grants[1].revokedAt, null);
  assert.equal(AuthorizationContextSchema.safeParse({ ...context, bypassConsent: true }).success, false);
});

test("grant shapes reject empty or duplicate scopes and impossible grant chronology", () => {
  for (const patch of [
    { actions: [] }, { actions: ["READ_CASE", "READ_CASE"] },
    { expiresAt: helperGrantFixture.createdAt },
    { revokedAt: "2026-11-20T08:00:00Z" },
    { recipientType: "EVERYONE" }, { purpose: "" },
    { revokedAt: undefined }, { version: 0 },
    { expiresAt: "2026-11-22T13:00:00+00:00" },
    { expiresAt: "2026-11-22T13:00Z" }, { active: true },
  ]) assert.equal(ConsentGrantSchema.safeParse({ ...helperGrantFixture, ...patch }).success, false);
});

test("grant chronology preserves RFC3339 fractional precision instead of rounding to milliseconds", () => {
  const input = {
    ...helperGrantFixture,
    createdAt: "2026-11-21T08:00:00.000000001Z",
    expiresAt: "2026-11-21T08:00:00.000000002Z",
  };
  assert.deepEqual(ConsentGrantSchema.parse(input), input);
  assert.equal(ConsentGrantSchema.safeParse({
    ...input, revokedAt: "2026-11-21T08:00:00.000000000Z",
  }).success, false);
});
