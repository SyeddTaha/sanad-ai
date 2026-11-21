import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiSuccessSchema, ApiCollectionSchema, ApiErrorEnvelopeSchema, ErrorCodeSchema, ErrorHttpStatus, EvidencePassportSchema } from "@/contracts/v1";
import { evidencePassportFixture, evidencePassportSuccessFixture, validationErrorFixture, fixtureIds } from "@/contracts/v1/fixtures";

test("success and collection envelopes validate their concrete data with no error branch", () => {
  const input = evidencePassportSuccessFixture;
  const schema = ApiSuccessSchema(EvidencePassportSchema);
  assert.deepEqual(schema.parse(input), input);
  assert.equal(schema.safeParse({ ...input, error: {} }).success, false);
  assert.equal(schema.safeParse({ ...input, data: { ...input.data, payment: "PAID" } }).success, false);
  const collection = ApiSuccessSchema(ApiCollectionSchema(EvidencePassportSchema));
  assert.equal(collection.safeParse({ data: { items: [evidencePassportFixture], nextCursor: null }, requestId: fixtureIds.request }).success, true);
  assert.equal(collection.safeParse({ data: { items: [], nextCursor: undefined }, requestId: fixtureIds.request }).success, false);
});

test("error envelopes use finite codes, message keys and sanitized field errors", () => {
  const input = validationErrorFixture;
  assert.deepEqual(ApiErrorEnvelopeSchema.parse(input), input);
  assert.equal(ErrorHttpStatus.VALIDATION_FAILED, 422);
  assert.equal(ErrorHttpStatus.IDEMPOTENCY_CONFLICT, 409);
  assert.equal(ErrorHttpStatus.CONSENT_REQUIRED, 403);
  assert.equal(ErrorHttpStatus.SERVICE_UNAVAILABLE, 503);
  assert.equal(ErrorCodeSchema.safeParse("FRAUD_DETECTED").success, false);
  for (const patch of [
    { input: "private raw input" }, { stack: "private exception" }, { message: "raw exception" },
    { fieldErrors: [{ path: "amountMinor", messageKey: "validation.integer_required", value: "private input" }] },
    { retryable: "false" }, { messageKey: "" }, { code: "UNKNOWN_ERROR" },
  ]) assert.equal(ApiErrorEnvelopeSchema.safeParse({ ...input, error: { ...input.error, ...patch } }).success, false);
  assert.equal(ApiErrorEnvelopeSchema.safeParse({ ...input, data: {} }).success, false);
});
