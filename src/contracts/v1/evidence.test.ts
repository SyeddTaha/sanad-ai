import assert from "node:assert/strict";
import { test } from "node:test";
import { EvidenceFindingsSchema, SourceReferenceSchema } from "@/contracts/v1";
import { pendingFindingsFixture, sourceRefFixture } from "@/contracts/v1/fixtures";

test("an Evidence Passport can report valid origin, pending payment and unknown eligibility independently", () => {
  assert.deepEqual(EvidenceFindingsSchema.parse(pendingFindingsFixture), pendingFindingsFixture);
});

test("source attempts carry no fabricated record identity or version", () => {
  const attempt = { ...sourceRefFixture, recordRef: null, sourceVersion: null };
  assert.deepEqual(SourceReferenceSchema.parse(attempt), attempt);
  assert.equal(SourceReferenceSchema.safeParse({ ...attempt, sourceVersion: 1 }).success, false);
  assert.equal(SourceReferenceSchema.safeParse({ ...sourceRefFixture, sourceVersion: null }).success, false);
});

test("valid signature remains representable with expiry, revocation or missing payment without a combined verdict", () => {
  const input = {
    ...pendingFindingsFixture,
    expiry: { ...pendingFindingsFixture.expiry, result: "EXPIRED", reasonCodes: ["NOTICE_EXPIRED"] },
    revocation: { ...pendingFindingsFixture.revocation, result: "REVOKED", reasonCodes: ["NOTICE_REVOKED"] },
    payment: { ...pendingFindingsFixture.payment, result: "UNKNOWN", reasonCodes: ["RECORD_NOT_FOUND"], sourceRefs: [] },
  };
  const result = EvidenceFindingsSchema.parse(input);
  assert.equal(result.signature.result, "VALID");
  assert.equal(result.payment.result, "UNKNOWN");
  assert.equal(EvidenceFindingsSchema.safeParse({ ...input, verified: true }).success, false);
  assert.equal(EvidenceFindingsSchema.safeParse({ ...input, signature: { ...input.signature, result: "FRAUD" } }).success, false);
  assert.equal(EvidenceFindingsSchema.safeParse({ ...input, payment: { ...input.payment, reasonCodes: ["AI_SAYS_PAID"] } }).success, false);
});
