import assert from "node:assert/strict";
import { test } from "node:test";
import { exportJWK, generateKeyPair } from "jose";
import {
  ExpiryFindingSchema,
  RevocationFindingSchema,
  SignatureFindingSchema,
} from "@/contracts/v1";
import { noticePayloadFixture } from "@/contracts/v1/fixtures";
import {
  createSignedNotice,
  verifySignedNotice,
  type NoticeRevocationResolution,
  type RegistryIssuerResolution,
  type RegistryKeyResolution,
  type TrustedIssuerRegistry,
} from "./signed-notice";

const NOW = 1_795_300_000;

type TestOptions = {
  payload?: unknown;
  kid?: string;
  keyStatus?: "ACTIVE" | "REVOKED" | "UNTRUSTED" | "UNKNOWN_KEY" | "UNAVAILABLE";
  issuerStatus?: "ACTIVE" | "REVOKED" | "UNKNOWN_ISSUER" | "UNAVAILABLE";
  noticeStatus?: "ACTIVE" | "REVOKED" | "UNAVAILABLE";
};

async function signedContext(options: TestOptions = {}) {
  const { publicKey, privateKey } = await generateKeyPair("Ed25519", { extractable: false });
  const kid = options.kid ?? "key_demo_001";
  const keyStatus = options.keyStatus ?? "ACTIVE";
  const issuerStatus = options.issuerStatus ?? "ACTIVE";
  const noticeStatus = options.noticeStatus ?? "ACTIVE";
  const registry: TrustedIssuerRegistry = {
    resolveKey: async (): Promise<RegistryKeyResolution> => {
      if (keyStatus === "UNKNOWN_KEY" || keyStatus === "UNAVAILABLE") return { status: keyStatus };
      return {
        status: "FOUND",
        kid,
        issuerId: noticePayloadFixture.issuerId,
        publicKey,
        trustStatus: keyStatus,
        sourceVersion: keyStatus === "REVOKED" ? 2 : 1,
      };
    },
    resolveIssuer: async (): Promise<RegistryIssuerResolution> => {
      if (issuerStatus === "UNKNOWN_ISSUER" || issuerStatus === "UNAVAILABLE") return { status: issuerStatus };
      return { status: issuerStatus, sourceVersion: issuerStatus === "REVOKED" ? 2 : 1 };
    },
    resolveNotice: async (): Promise<NoticeRevocationResolution> => {
      if (noticeStatus === "UNAVAILABLE") return { status: noticeStatus };
      return { status: noticeStatus, sourceVersion: noticeStatus === "REVOKED" ? 2 : 1 };
    },
  };
  const token = await createSignedNotice(options.payload ?? noticePayloadFixture, {
    getSigningKey: async (issuerId) => ({ kid, issuerId, privateKey }),
  });

  return { token, privateKey, registry };
}

function replacePayload(token: string, mutate: (payload: Record<string, unknown>) => void): string {
  const [header, encodedPayload, signature] = token.split(".");
  const payload = JSON.parse(Buffer.from(encodedPayload!, "base64url").toString("utf8")) as Record<string, unknown>;
  mutate(payload);
  return `${header}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${signature}`;
}

function replaceHeader(token: string, mutate: (header: Record<string, unknown>) => void): string {
  const [encodedHeader, payload, signature] = token.split(".");
  const header = JSON.parse(Buffer.from(encodedHeader!, "base64url").toString("utf8")) as Record<string, unknown>;
  mutate(header);
  return `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${payload}.${signature}`;
}

async function signRawJws(headerJson: string, payloadJson: string, privateKey: CryptoKey): Promise<string> {
  const encodedHeader = Buffer.from(headerJson).toString("base64url");
  const encodedPayload = Buffer.from(payloadJson).toString("base64url");
  const signingInput = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = await crypto.subtle.sign("Ed25519", privateKey, signingInput);
  return `${encodedHeader}.${encodedPayload}.${Buffer.from(signature).toString("base64url")}`;
}

function sourceFields(sources: Array<{ service: string; recordRef: string | null; sourceVersion: number | null }>) {
  return sources.map(({ service, recordRef, sourceVersion }) => ({ service, recordRef, sourceVersion }));
}

test("a trusted issuer can sign and verify a v1 notice without inferring payment or eligibility", async () => {
  const { token, privateKey, registry } = await signedContext();

  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(privateKey.extractable, false);
  await assert.rejects(() => exportJWK(privateKey));
  const result = await verifySignedNotice(token, registry, NOW);

  assert.equal(result.signature.result, "VALID");
  assert.deepEqual(result.signature.reasonCodes, ["SIGNATURE_VALID"]);
  assert.equal(result.expiry.result, "CURRENT");
  assert.equal(result.revocation.result, "ACTIVE");
  assert.equal(result.issuer.result, "TRUSTED");
  assert.deepEqual(result.payload, noticePayloadFixture);
  assert.equal(result.errorCode, null);
  assert.deepEqual(sourceFields(result.signature.sourceRefs), [
    { service: "trusted_issuer_registry", recordRef: "key_demo_001", sourceVersion: 1 },
  ]);
  assert.deepEqual(sourceFields(result.expiry.sourceRefs), [
    { service: "signed_notice", recordRef: "notice_demo_001", sourceVersion: 1 },
  ]);
  assert.deepEqual(sourceFields(result.revocation.sourceRefs), [
    { service: "notice_revocation_registry", recordRef: "notice_demo_001", sourceVersion: 1 },
  ]);
  assert.deepEqual(sourceFields(result.issuer.sourceRefs), [
    { service: "trusted_issuer_registry", recordRef: "issuer_demo", sourceVersion: 1 },
  ]);
  assert.doesNotThrow(() => SignatureFindingSchema.parse(result.signature));
  assert.doesNotThrow(() => ExpiryFindingSchema.parse(result.expiry));
  assert.doesNotThrow(() => RevocationFindingSchema.parse(result.revocation));
  assert.equal("payment" in result, false);
  assert.equal("eligibility" in result, false);
  assert.equal("paymentStatus" in result, false);
});

test("changing amount, recipient, or payment reference invalidates the original signature", async () => {
  const { token, registry } = await signedContext();
  const tamperedNotices = [
    replacePayload(token, (payload) => { payload.amountMinor = 125001; }),
    replacePayload(token, (payload) => { payload.recipientRef = "recipient_demo_009"; }),
    replacePayload(token, (payload) => { payload.paymentRef = "payment_demo_009"; }),
  ];

  for (const tampered of tamperedNotices) {
    const result = await verifySignedNotice(tampered, registry, NOW);
    assert.equal(result.signature.result, "INVALID");
    assert.deepEqual(result.signature.reasonCodes, ["SIGNATURE_INVALID"]);
    assert.equal(result.expiry.result, "UNKNOWN");
    assert.equal(result.payload, null);
    assert.equal(result.errorCode, "SIGNATURE_INVALID");
  }
});

test("an unknown issuer is not attributed to the trusted key owner", async () => {
  const { token, registry } = await signedContext({
    payload: { ...noticePayloadFixture, issuerId: "issuer_unknown" },
    issuerStatus: "UNKNOWN_ISSUER",
  });

  const result = await verifySignedNotice(token, registry, NOW);

  assert.equal(result.signature.result, "NOT_VERIFIED");
  assert.deepEqual(result.signature.reasonCodes, ["UNKNOWN_ISSUER"]);
  assert.equal(result.issuer.result, "UNKNOWN");
  assert.equal(result.expiry.result, "UNKNOWN");
  assert.equal(result.payload, null);
});

test("an unknown key is not resolved using another issuer key", async () => {
  const { token, registry } = await signedContext({ kid: "key_missing", keyStatus: "UNKNOWN_KEY" });

  const result = await verifySignedNotice(token, registry, NOW);

  assert.equal(result.signature.result, "NOT_VERIFIED");
  assert.deepEqual(result.signature.reasonCodes, ["UNKNOWN_KEY"]);
  assert.equal(result.issuer.result, "UNKNOWN");
  assert.equal(result.errorCode, "UNKNOWN_KEY");
});

test("a trusted key cannot authenticate a different issuer binding", async () => {
  const { token, registry } = await signedContext({
    payload: { ...noticePayloadFixture, issuerId: "issuer_other" },
  });

  const result = await verifySignedNotice(token, registry, NOW);

  assert.equal(result.signature.result, "NOT_VERIFIED");
  assert.equal(result.issuer.result, "MISMATCH");
  assert.equal(result.errorCode, "ISSUER_KEY_MISMATCH");
});

test("an unsupported algorithm is not accepted as Ed25519", async () => {
  const { token, registry } = await signedContext();
  const tampered = replaceHeader(token, (header) => { header.alg = "EdDSA"; });

  const result = await verifySignedNotice(tampered, registry, NOW);

  assert.equal(result.signature.result, "NOT_VERIFIED");
  assert.equal(result.errorCode, "UNSUPPORTED_ALGORITHM");
  assert.equal(result.issuer.result, "UNKNOWN");
});

test("revoked and untrusted key records never authenticate a notice", async () => {
  for (const [keyStatus, issuerResult, errorCode] of [
    ["REVOKED", "KEY_REVOKED", "KEY_REVOKED"],
    ["UNTRUSTED", "KEY_UNTRUSTED", "KEY_UNTRUSTED"],
  ] as const) {
    const { token, registry } = await signedContext({ keyStatus });
    const result = await verifySignedNotice(token, registry, NOW);
    assert.equal(result.signature.result, "NOT_VERIFIED");
    assert.equal(result.issuer.result, issuerResult);
    assert.equal(result.errorCode, errorCode);
  }
});

test("a revoked issuer is distinct from notice revocation", async () => {
  const { token, registry } = await signedContext({ issuerStatus: "REVOKED" });

  const result = await verifySignedNotice(token, registry, NOW);

  assert.equal(result.signature.result, "NOT_VERIFIED");
  assert.equal(result.issuer.result, "REVOKED");
  assert.equal(result.revocation.result, "UNKNOWN");
  assert.equal(result.errorCode, "ISSUER_REVOKED");
});

test("expiry and notice revocation remain separate from a valid signature", async () => {
  const { token, registry } = await signedContext({ noticeStatus: "REVOKED" });

  const result = await verifySignedNotice(token, registry, noticePayloadFixture.expiresAt);

  assert.equal(result.signature.result, "VALID");
  assert.equal(result.expiry.result, "EXPIRED");
  assert.deepEqual(result.expiry.reasonCodes, ["NOTICE_EXPIRED"]);
  assert.equal(result.revocation.result, "REVOKED");
  assert.deepEqual(result.revocation.reasonCodes, ["NOTICE_REVOKED"]);
  assert.equal(result.issuer.result, "TRUSTED");

  const future = await signedContext({
    payload: { ...noticePayloadFixture, issuedAt: NOW + 1, expiresAt: NOW + 100 },
  });
  const futureResult = await verifySignedNotice(future.token, future.registry, NOW);
  assert.equal(futureResult.signature.result, "VALID");
  assert.equal(futureResult.expiry.result, "NOT_YET_VALID");
});

test("registry outages remain unknown without erasing independently valid findings", async () => {
  const issuerOutage = await signedContext({ issuerStatus: "UNAVAILABLE" });
  const issuerResult = await verifySignedNotice(issuerOutage.token, issuerOutage.registry, NOW);
  assert.equal(issuerResult.signature.result, "NOT_VERIFIED");
  assert.equal(issuerResult.issuer.result, "UNAVAILABLE");
  assert.equal(issuerResult.errorCode, "REGISTRY_UNAVAILABLE");

  const noticeOutage = await signedContext({ noticeStatus: "UNAVAILABLE" });
  const noticeResult = await verifySignedNotice(noticeOutage.token, noticeOutage.registry, NOW);
  assert.equal(noticeResult.signature.result, "VALID");
  assert.equal(noticeResult.revocation.result, "UNKNOWN");
  assert.deepEqual(noticeResult.revocation.reasonCodes, ["REGISTRY_UNAVAILABLE"]);
  assert.equal(noticeResult.errorCode, "REGISTRY_UNAVAILABLE");

  const keyOutage = await signedContext({ keyStatus: "UNAVAILABLE" });
  const keyResult = await verifySignedNotice(keyOutage.token, keyOutage.registry, NOW);
  assert.equal(keyResult.signature.result, "NOT_VERIFIED");
  assert.equal(keyResult.expiry.result, "UNKNOWN");
  assert.equal(keyResult.revocation.result, "UNKNOWN");
  assert.equal(keyResult.issuer.result, "UNAVAILABLE");
  assert.equal(keyResult.errorCode, "REGISTRY_UNAVAILABLE");
});

test("signing rejects non-contract notices and extractable private keys explicitly", async () => {
  const { privateKey } = await generateKeyPair("Ed25519", { extractable: true });

  await assert.rejects(
    () => createSignedNotice({ ...noticePayloadFixture, currency: "USD" }, {
      getSigningKey: async (issuerId) => ({ kid: "key_demo_001", issuerId, privateKey }),
    }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "INVALID_NOTICE_PAYLOAD",
  );
  await assert.rejects(
    () => createSignedNotice(noticePayloadFixture, {
      getSigningKey: async (issuerId) => ({ kid: "key_demo_001", issuerId, privateKey }),
    }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "INVALID_SIGNING_KEY",
  );
});

test("signing rejects a key assigned to a different issuer", async () => {
  const { privateKey } = await generateKeyPair("Ed25519", { extractable: false });

  await assert.rejects(
    () => createSignedNotice(noticePayloadFixture, {
      getSigningKey: async (issuerId) => {
        assert.equal(issuerId, noticePayloadFixture.issuerId);
        return { kid: "key_demo_001", issuerId: "issuer_other", privateKey };
      },
    }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "ISSUER_KEY_MISMATCH",
  );
});

test("malformed compact input and notice-supplied keys stay unverified", async () => {
  const { token, registry } = await signedContext();
  const embeddedKey = replaceHeader(token, (header) => { header.jwk = { kty: "OKP", crv: "Ed25519" }; });

  for (const malformed of ["", "abc", "a.b", "a..c", "a.b.c.d", "a.b.+", "x".repeat(8193)]) {
    const result = await verifySignedNotice(malformed, registry, NOW);
    assert.equal(result.signature.result, "NOT_VERIFIED", malformed.slice(0, 20));
    assert.equal(result.errorCode, "MALFORMED_JWS", malformed.slice(0, 20));
  }
  const result = await verifySignedNotice(embeddedKey, registry, NOW);
  assert.equal(result.signature.result, "NOT_VERIFIED");
  assert.equal(result.errorCode, "EMBEDDED_KEY");
});

test("duplicate JSON members in both JWS segments are rejected before parsing", async () => {
  const { privateKey, registry } = await signedContext();
  const header = '{"alg":"Ed25519","kid":"key_demo_001","typ":"sanad-notice+jws","alg":"Ed25519"}';
  const duplicateAmount = JSON.stringify(noticePayloadFixture).replace(
    '"amountMinor":125000',
    '"amountMinor":125000,"amountMinor":125000',
  );
  const duplicateHeaderToken = await signRawJws(header, JSON.stringify(noticePayloadFixture), privateKey);
  const duplicatePayloadToken = await signRawJws(
    JSON.stringify({ alg: "Ed25519", kid: "key_demo_001", typ: "sanad-notice+jws" }),
    duplicateAmount,
    privateKey,
  );

  for (const duplicate of [duplicateHeaderToken, duplicatePayloadToken]) {
    const result = await verifySignedNotice(duplicate, registry, NOW);
    assert.equal(result.signature.result, "NOT_VERIFIED");
    assert.equal(result.errorCode, "DUPLICATE_JSON_MEMBER");
    assert.equal(result.payload, null);
  }
});

test("unsupported versions and malformed signed payloads are not verified", async () => {
  const { privateKey, registry } = await signedContext();
  const unsupportedPayload = JSON.stringify({ ...noticePayloadFixture, v: 2 });
  const unsupportedToken = await signRawJws(
    JSON.stringify({ alg: "Ed25519", kid: "key_demo_001", typ: "sanad-notice+jws" }),
    unsupportedPayload,
    privateKey,
  );

  const unsupported = await verifySignedNotice(unsupportedToken, registry, NOW);
  assert.equal(unsupported.signature.result, "NOT_VERIFIED");
  assert.deepEqual(unsupported.signature.reasonCodes, ["UNSUPPORTED_VERSION"]);
  assert.equal(unsupported.errorCode, "UNSUPPORTED_VERSION");
  assert.equal(unsupported.payload, null);

  const missingReference: Record<string, unknown> = { ...noticePayloadFixture };
  delete missingReference.paymentRef;
  const malformedToken = await signRawJws(
    JSON.stringify({ alg: "Ed25519", kid: "key_demo_001", typ: "sanad-notice+jws" }),
    JSON.stringify(missingReference),
    privateKey,
  );
  const malformed = await verifySignedNotice(malformedToken, registry, NOW);
  assert.equal(malformed.signature.result, "NOT_VERIFIED");
  assert.equal(malformed.errorCode, "MALFORMED_PAYLOAD");

  const missingVersion: Record<string, unknown> = { ...noticePayloadFixture };
  delete missingVersion.v;
  const missingVersionToken = await signRawJws(
    JSON.stringify({ alg: "Ed25519", kid: "key_demo_001", typ: "sanad-notice+jws" }),
    JSON.stringify(missingVersion),
    privateKey,
  );
  const missingVersionResult = await verifySignedNotice(missingVersionToken, registry, NOW);
  assert.equal(missingVersionResult.errorCode, "MALFORMED_PAYLOAD");
});
