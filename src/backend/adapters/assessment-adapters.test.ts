import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPair } from "jose";
import { assessmentFixture, noticePayloadFixture } from "@/contracts/v1/fixtures";
import { createSignedNotice, type TrustedIssuerRegistry } from "@/backend/notices/signed-notice";
import type { ReliefMessageProvider } from "@/backend/ai/assessment";
import { assessForCase, mergeNoticeFindings, verifyNoticeForCase } from "./assessment-adapters";

const NOW = 1_795_300_000;

async function signedNotice() {
  const { publicKey, privateKey } = await generateKeyPair("Ed25519", { extractable: false });
  const registry: TrustedIssuerRegistry = {
    resolveKey: async (kid) => ({ status: "FOUND", kid, issuerId: noticePayloadFixture.issuerId, publicKey, trustStatus: "ACTIVE", sourceVersion: 7 }),
    resolveIssuer: async () => ({ status: "ACTIVE", sourceVersion: 4 }),
    resolveNotice: async () => ({ status: "REVOKED", sourceVersion: 9 }),
  };
  const token = await createSignedNotice(noticePayloadFixture, {
    getSigningKey: async (issuerId) => ({ kid: "key_demo_001", issuerId, privateKey }),
  });
  return { token, registry };
}

function providerReturning(response: string): ReliefMessageProvider {
  return { name: "fixture-provider", model: "fixture-model", complete: async () => response };
}

const successfulOutput = JSON.stringify({ schemaVersion: 1, extractedIssuerClaim: "Sindh Relief Authority",
  claimedAmountMinor: 2500000, paymentRef: "PAY-77821", classification: "CLARIFICATION",
  missingInformation: [], confidence: 0.91, suggestedRoute: "INFORMATION_ONLY", explanation: "Claims are not verified." });

test("signed-notice adapter preserves independent signature, expiry, revocation and trust findings", async () => {
  const { token, registry } = await signedNotice();
  const result = await verifyNoticeForCase(token, registry, NOW);

  assert.equal(result.findings.signature.result, "VALID");
  assert.equal(result.findings.expiry.result, "CURRENT");
  assert.equal(result.findings.revocation.result, "REVOKED");
  assert.equal(result.issuer.result, "TRUSTED");
  assert.equal(result.findings.revocation.sourceRefs[0]?.sourceVersion, 9);
  assert.deepEqual(result.payload, noticePayloadFixture);
  assert.equal("payment" in result.findings, false);
  assert.equal("eligibility" in result.findings, false);
  const merged = mergeNoticeFindings(assessmentFixture.findings, result.findings);
  assert.deepEqual(merged.payment, assessmentFixture.findings.payment);
  assert.deepEqual(merged.eligibility, assessmentFixture.findings.eligibility);
  assert.deepEqual(merged.recipientMatch, assessmentFixture.findings.recipientMatch);
  assert.equal(merged.revocation.result, "REVOKED");
});

test("malformed signed-notice input remains unknown and does not consult a notice-supplied key", async () => {
  const result = await verifyNoticeForCase("not-a-jws", {
    resolveKey: async () => { throw new Error("must not resolve"); },
    resolveIssuer: async () => { throw new Error("must not resolve"); },
    resolveNotice: async () => { throw new Error("must not resolve"); },
  }, NOW);

  assert.equal(result.findings.signature.result, "NOT_VERIFIED");
  assert.equal(result.findings.expiry.result, "UNKNOWN");
  assert.equal(result.findings.revocation.result, "UNKNOWN");
  assert.equal(result.payload, null);
});

test("successful AI assessment retains the internal trace and projects advisory metadata only", async () => {
  const result = await assessForCase("Sindh Relief Authority will pay PKR 25000 PAY-77821", {
    provider: providerReturning(successfulOutput),
  });

  assert.equal(result.kind, "ASSESSED");
  if (result.kind !== "ASSESSED") return;
  assert.equal(result.assessment.status, "SUCCEEDED");
  assert.deepEqual(result.assessment.extractedClaims, { issuer: "Sindh Relief Authority", amountMinor: 2500000, paymentReference: "PAY-77821" });
  assert.equal(result.metadata.status, "SUCCEEDED");
  assert.equal(result.metadata.recommendedRoute, result.assessment.recommendedRoute);
  assert.equal(result.metadata.failureCode, null);
  assert.equal(result.metadata.runId.length, 36);
  assert.deepEqual(result.metadata.explanationRefs, []);
  assert.equal("payment" in result, false);
  assert.equal("eligibility" in result, false);
});

test("AI abstention preserves the failure code and routes to officer review", async () => {
  const result = await assessForCase("Please send your OTP", {
    provider: providerReturning("not-json"),
  });

  assert.equal(result.kind, "ASSESSED");
  if (result.kind !== "ASSESSED") return;
  assert.equal(result.assessment.status, "INVALID_OUTPUT");
  assert.equal(result.assessment.failureCode, "MALFORMED_JSON");
  assert.equal(result.assessment.recommendedRoute, "OFFICER_REVIEW");
  assert.equal(result.metadata.status, "INVALID_OUTPUT");
  assert.equal(result.metadata.recommendedRoute, null);
  assert.equal(result.metadata.failureCode, "MALFORMED_JSON");
  assert.equal(result.metadata.runId.length, 36);
});

test("unconfigured AI remains a no-run abstention with null provenance fields", async () => {
  const result = await assessForCase("message", { env: { NODE_ENV: "test" } });

  assert.equal(result.kind, "ASSESSED");
  if (result.kind !== "ASSESSED") return;
  assert.equal(result.assessment.status, "UNAVAILABLE");
  assert.equal(result.assessment.failureCode, "PROVIDER_UNAVAILABLE");
  assert.equal(result.metadata.status, "UNAVAILABLE");
  assert.equal(result.metadata.runId, null);
  assert.equal(result.metadata.modelVersion, null);
});

test("invalid AI input is surfaced for caller validation rather than persisted as an Assessment", async () => {
  const result = await assessForCase(" ", { provider: providerReturning(successfulOutput) });

  assert.equal(result.kind, "INVALID_INPUT");
  assert.equal("metadata" in result, false);
});
