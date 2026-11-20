import assert from "node:assert/strict";
import { test } from "node:test";
import { SignedNoticePayloadSchema, SignedNoticeHeaderSchema, CompactJwsSchema } from "@/contracts/v1";
import { noticePayloadFixture } from "@/contracts/v1/fixtures";

test("a synthetic signed-notice payload preserves the spec's minor units and references", () => {
  assert.deepEqual(SignedNoticePayloadSchema.parse(noticePayloadFixture), noticePayloadFixture);
});

test("notice headers require exact Ed25519 and prohibit embedded trust sources", () => {
  const header = { alg: "Ed25519", kid: "key_demo_001", typ: "sanad-notice+jws" };
  assert.deepEqual(SignedNoticeHeaderSchema.parse(header), header);
  for (const input of [
    { ...header, alg: "EdDSA" }, { ...header, alg: "none" },
    { ...header, jwk: {} }, { ...header, jku: "https://untrusted.invalid/keys" },
    { ...header, kid: undefined }, { ...header, typ: "JWT" },
  ]) assert.equal(SignedNoticeHeaderSchema.safeParse(input).success, false);
});

test("a notice requires expiry strictly after issuance", () => {
  assert.equal(SignedNoticePayloadSchema.safeParse({
    ...noticePayloadFixture, expiresAt: noticePayloadFixture.issuedAt,
  }).success, false);
});

test("compact notice transport requires three bounded nonempty base64url segments", () => {
  // Deliberately NOT a signed fixture or proof of canonical base64url/JSON.
  assert.equal(CompactJwsSchema.parse("abc.def.ghi"), "abc.def.ghi");
  for (const token of ["", "abc.def", "abc..ghi", "a.b.c.d", "a.b.c=", "a.b.+", "a".repeat(8193)]) {
    assert.equal(CompactJwsSchema.safeParse(token).success, false);
  }
});

test("notice payloads reject coercion, unsafe values, identity fields and unsupported versions", () => {
  for (const patch of [
    { v: 2 }, { amountMinor: "125000" }, { amountMinor: 0.1 },
    { amountMinor: -1 }, { amountMinor: Number.MAX_SAFE_INTEGER + 1 },
    { amountMinor: Infinity }, { amountMinor: NaN }, { currency: "USD" },
    { issuedAt: -1 }, { issuedAt: 1.5 }, { expiresAt: 0 },
    { recipientRef: "recipient demo" }, { issuerId: "x".repeat(65) },
    { name: "Synthetic Citizen" }, { cnic: "not-an-identity" },
    { paymentRef: undefined },
  ]) assert.equal(SignedNoticePayloadSchema.safeParse({ ...noticePayloadFixture, ...patch }).success, false);
});
