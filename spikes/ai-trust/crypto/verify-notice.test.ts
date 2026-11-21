import assert from "node:assert/strict";
import { test } from "node:test";
import { CompactSign, compactVerify, exportJWK } from "jose";
import { SignedNoticePayloadSchema } from "@/contracts/v1";
import { noticePayloadFixture } from "@/contracts/v1/fixtures";
import { assertUniqueJsonMembers, JsonMemberError } from "@/lib/json-members";
import { memoryIssuerRegistry } from "./registry";
import { generateSyntheticIssuerKeyPair, signReliefNotice, verifySignedNotice } from "./verify-notice";

const NOW = 1_795_300_000;
const EXPIRED_NOW = noticePayloadFixture.expiresAt;

const issuer = (async () => {
  const { publicKey, privateKey } = await generateSyntheticIssuerKeyPair();
  const registry = memoryIssuerRegistry([
    { issuerId: noticePayloadFixture.issuerId, kid: "key_demo_001", publicKey },
  ]);
  const token = await signReliefNotice(noticePayloadFixture, privateKey, "key_demo_001");
  return { publicKey, privateKey, registry, token };
})();

function replacePayload(token: string, mutate: (json: string) => string): string {
  const [header, payload, signature] = token.split(".");
  const json = Buffer.from(payload!, "base64url").toString("utf8");
  return `${header}.${Buffer.from(mutate(json)).toString("base64url")}.${signature}`;
}

function replaceHeader(token: string, header: object): string {
  const [, payload, signature] = token.split(".");
  return `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${payload}.${signature}`;
}

test("a valid compact Ed25519 notice verifies and does not decide payment or eligibility", async () => {
  const { token, registry, privateKey, publicKey } = await issuer;
  assert.equal(privateKey.extractable, false);
  await assert.rejects(() => exportJWK(privateKey));
  const publicJwk = await exportJWK(publicKey);
  assert.equal("d" in publicJwk, false);

  const header = JSON.parse(Buffer.from(token.split(".")[0]!, "base64url").toString("utf8")) as { alg: string };
  assert.equal(header.alg, "Ed25519");

  const result = await verifySignedNotice(token, registry, NOW);
  assert.equal(result.signature, "VALID");
  assert.equal(result.signatureReason, "SIGNATURE_VALID");
  assert.equal(result.expiry, "CURRENT");
  assert.equal(result.expiryReason, "NOTICE_CURRENT");
  assert.equal(result.issuerId, "issuer_demo");
  assert.equal("payment" in result, false);
  assert.equal("eligibility" in result, false);
  assert.equal("paymentStatus" in result, false);
});

test("changing the amount without re-signing invalidates the signature", async () => {
  const { token, registry } = await issuer;
  const tampered = replacePayload(token, (json) => json.replace('"amountMinor":125000', '"amountMinor":125001'));
  const result = await verifySignedNotice(tampered, registry, NOW);
  assert.equal(result.signature, "INVALID");
  assert.equal(result.signatureReason, "SIGNATURE_INVALID");
  assert.equal(result.expiry, "UNKNOWN");
});

test("changing the recipient reference without re-signing invalidates the signature", async () => {
  const { token, registry } = await issuer;
  const tampered = replacePayload(token, (json) => json.replace("recipient_demo_001", "recipient_demo_009"));
  const result = await verifySignedNotice(tampered, registry, NOW);
  assert.equal(result.signature, "INVALID");
  assert.equal(result.expiry, "UNKNOWN");
});

test("changing the payment reference without re-signing invalidates the signature", async () => {
  const { token, registry } = await issuer;
  const tampered = replacePayload(token, (json) => json.replace("payment_demo_001", "payment_demo_009"));
  const result = await verifySignedNotice(tampered, registry, NOW);
  assert.equal(result.signature, "INVALID");
  assert.equal(result.expiry, "UNKNOWN");
});

test("an issuer that does not own the trusted key stays not verified", async () => {
  const { privateKey, registry } = await issuer;
  const token = await signReliefNotice(
    { ...noticePayloadFixture, issuerId: "issuer_unknown" },
    privateKey,
    "key_demo_001",
  );
  const result = await verifySignedNotice(token, registry, NOW);
  assert.equal(result.signature, "NOT_VERIFIED");
  assert.equal(result.signatureReason, "UNKNOWN_ISSUER");
  assert.equal(result.expiry, "CURRENT");
  assert.notEqual(result.signatureReason, "SIGNATURE_INVALID");
});

test("an unknown key id is not verified from any other registry key", async () => {
  const { privateKey, publicKey } = await issuer;
  const token = await signReliefNotice(noticePayloadFixture, privateKey, "key_missing");
  const registry = memoryIssuerRegistry([
    { issuerId: noticePayloadFixture.issuerId, kid: "key_demo_001", publicKey },
  ]);
  const result = await verifySignedNotice(token, registry, NOW);
  assert.equal(result.signature, "NOT_VERIFIED");
  assert.equal(result.signatureReason, "UNKNOWN_KEY");
  assert.equal(result.kid, "key_missing");
});

test("EdDSA is rejected instead of being treated as Ed25519", async () => {
  const { token, registry } = await issuer;
  const tampered = replaceHeader(token, { alg: "EdDSA", kid: "key_demo_001", typ: "sanad-notice+jws" });
  const result = await verifySignedNotice(tampered, registry, NOW);
  assert.equal(result.signature, "NOT_VERIFIED");
  assert.equal(result.signatureReason, "UNSUPPORTED_ALGORITHM");
});

test("a malformed compact JWS is not verified", async () => {
  const { registry } = await issuer;
  for (const token of ["", "abc", "abc.def", "abc..ghi", "a.b.c.d", "a.b.+", "@@@.@@@.@@@"]) {
    const result = await verifySignedNotice(token, registry, NOW);
    assert.equal(result.signature, "NOT_VERIFIED", token);
    assert.equal(result.signatureReason, "MALFORMED_JWS", token);
  }
});

test("an attacker-supplied public key cannot establish issuer trust", async () => {
  const { registry } = await issuer;
  const attacker = await generateSyntheticIssuerKeyPair();
  const jwk = await exportJWK(attacker.publicKey);
  assert.equal("d" in jwk, false);
  const payload = new TextEncoder().encode(JSON.stringify(SignedNoticePayloadSchema.parse(noticePayloadFixture)));
  const token = await new CompactSign(payload)
    .setProtectedHeader({ alg: "Ed25519", kid: "key_demo_001", typ: "sanad-notice+jws", jwk })
    .sign(attacker.privateKey);

  const acceptedUnderAttackerKey = await compactVerify(token, attacker.publicKey, { algorithms: ["Ed25519"] });
  assert.ok(acceptedUnderAttackerKey.payload.byteLength > 0);

  const result = await verifySignedNotice(token, registry, NOW);
  assert.equal(result.signature, "NOT_VERIFIED");
  assert.equal(result.signatureReason, "EMBEDDED_KEY");
  assert.notEqual(result.signature, "VALID");
});

test("an authentic expired notice keeps a valid signature and a separate expiry finding", async () => {
  const { token, registry } = await issuer;
  const result = await verifySignedNotice(token, registry, EXPIRED_NOW);
  assert.equal(result.signature, "VALID");
  assert.equal(result.signatureReason, "SIGNATURE_VALID");
  assert.equal(result.expiry, "EXPIRED");
  assert.equal(result.expiryReason, "NOTICE_EXPIRED");
});

test("duplicate JSON members are rejected before parse", async () => {
  assert.throws(() => assertUniqueJsonMembers('{"alg":"Ed25519","alg":"none"}'), JsonMemberError);
  const { token, registry } = await issuer;
  const duplicateHeader = Buffer.from(
    '{"alg":"Ed25519","kid":"key_demo_001","typ":"sanad-notice+jws","alg":"none"}',
  ).toString("base64url");
  const [, payload, signature] = token.split(".");
  const result = await verifySignedNotice(`${duplicateHeader}.${payload}.${signature}`, registry, NOW);
  assert.equal(result.signature, "NOT_VERIFIED");
  assert.equal(result.signatureReason, "DUPLICATE_JSON_MEMBER");
});

test("a registry outage stays not verified", async () => {
  const { token, publicKey } = await issuer;
  const registry = memoryIssuerRegistry(
    [{ issuerId: noticePayloadFixture.issuerId, kid: "key_demo_001", publicKey }],
    { unavailable: true },
  );
  const result = await verifySignedNotice(token, registry, NOW);
  assert.equal(result.signature, "NOT_VERIFIED");
  assert.equal(result.signatureReason, "REGISTRY_UNAVAILABLE");
  assert.notEqual(result.signature, "INVALID");
});
