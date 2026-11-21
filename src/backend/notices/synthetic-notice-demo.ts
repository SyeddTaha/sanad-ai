import "server-only";

import { CompactSign, generateKeyPair } from "jose";
import { verifyNoticeForCase } from "@/backend/adapters/assessment-adapters";
import { createSignedNotice, type TrustedIssuerRegistry } from "./signed-notice";
import { SyntheticDemoTrustedIssuerRegistry, type SyntheticRegistrySnapshot } from "./synthetic-demo-registry";
import { CompactJwsSchema, SignedNoticePayloadSchema } from "@/contracts/v1";
import type { ExpiryResult, RevocationResult, SignatureResult } from "@/contracts/v1";
import { noticePayloadFixture } from "@/contracts/v1/fixtures";
import type { IssuerFinding } from "./signed-notice";

export const SYNTHETIC_NOTICE_DEMO_TIME = 1_795_300_000;
const ISSUER_ID = "issuer_a05_synthetic";
const KEY_ID = "key_a05_synthetic_001";

export type SyntheticNoticeDemoName =
  | "valid"
  | "tampered-signature"
  | "expired"
  | "revoked"
  | "unknown-issuer"
  | "unknown-key"
  | "registry-unavailable";

export type SyntheticNoticeDemoResult = {
  scenario: SyntheticNoticeDemoName;
  signature: SignatureResult;
  expiry: ExpiryResult;
  revocation: RevocationResult;
  issuerTrust: IssuerFinding["result"];
  errorCode: string | null;
  sourceVersions: Array<{ service: string; recordRef: string | null; sourceVersion: number | null }>;
};

/** Generates ephemeral synthetic keys and returns findings only; never persists key material. */
export async function runSyntheticNoticeDemo(): Promise<SyntheticNoticeDemoResult[]> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Synthetic notice demos are disabled in production");
  }

  const { publicKey, privateKey } = await generateKeyPair("Ed25519", { extractable: false });
  const keyProvider = { getSigningKey: async (issuerId: string) => ({ kid: KEY_ID, issuerId, privateKey }) };
  const basePayload = {
    ...noticePayloadFixture,
    issuerId: ISSUER_ID,
    noticeId: "notice_a05_valid",
    issuedAt: SYNTHETIC_NOTICE_DEMO_TIME - 60,
    expiresAt: SYNTHETIC_NOTICE_DEMO_TIME + 3600,
  };
  const validToken = await createSignedNotice(basePayload, keyProvider);
  const expiredToken = await createSignedNotice({
    ...basePayload,
    noticeId: "notice_a05_expired",
    issuedAt: SYNTHETIC_NOTICE_DEMO_TIME - 3600,
    expiresAt: SYNTHETIC_NOTICE_DEMO_TIME - 1,
  }, keyProvider);
  const revokedToken = await createSignedNotice({ ...basePayload, noticeId: "notice_a05_revoked" }, keyProvider);
  // Sign the unknown-issuer claim with the known synthetic key to exercise A02's issuer binding check.
  const unknownIssuerPayload = SignedNoticePayloadSchema.parse({
    ...basePayload,
    issuerId: "issuer_a05_unknown",
    noticeId: "notice_a05_unknown_issuer",
  });
  const unknownIssuerToken = await new CompactSign(new TextEncoder().encode(JSON.stringify(unknownIssuerPayload)))
    .setProtectedHeader({ alg: "Ed25519", kid: KEY_ID, typ: "sanad-notice+jws" })
    .sign(privateKey);
  const validUnknownIssuerToken = CompactJwsSchema.parse(unknownIssuerToken);

  const knownRecords = {
    issuers: [{ issuerId: ISSUER_ID, status: "ACTIVE", sourceVersion: 3 }],
    keys: [{ kid: KEY_ID, issuerId: ISSUER_ID, publicKey, trustStatus: "ACTIVE", sourceVersion: 7 }],
  } as const;
  const registry = (notices: SyntheticRegistrySnapshot["notices"], unavailable?: SyntheticRegistrySnapshot["unavailable"]): TrustedIssuerRegistry =>
    new SyntheticDemoTrustedIssuerRegistry({ ...knownRecords, notices, unavailable });

  const revokedRegistry = registry([
    { issuerId: ISSUER_ID, noticeId: "notice_a05_revoked", status: "REVOKED", sourceVersion: 11 },
  ]);
  const unavailableRegistry = registry([], ["notices"]);
  const activeRegistry = registry([
    { issuerId: ISSUER_ID, noticeId: "notice_a05_valid", status: "ACTIVE", sourceVersion: 10 },
    { issuerId: ISSUER_ID, noticeId: "notice_a05_expired", status: "ACTIVE", sourceVersion: 10 },
  ]);

  const scenarios: Array<{ scenario: SyntheticNoticeDemoName; token: string; registry: TrustedIssuerRegistry }> = [
    { scenario: "valid", token: validToken, registry: activeRegistry },
    { scenario: "tampered-signature", token: tamperSignature(validToken), registry: activeRegistry },
    { scenario: "expired", token: expiredToken, registry: activeRegistry },
    { scenario: "revoked", token: revokedToken, registry: revokedRegistry },
    { scenario: "unknown-issuer", token: validUnknownIssuerToken, registry: activeRegistry },
    { scenario: "unknown-key", token: changeHeaderKeyId(validToken, "key_a05_unknown"), registry: activeRegistry },
    { scenario: "registry-unavailable", token: validToken, registry: unavailableRegistry },
  ];

  const results: SyntheticNoticeDemoResult[] = [];
  for (const item of scenarios) {
    const result = await verifyNoticeForCase(item.token, item.registry, SYNTHETIC_NOTICE_DEMO_TIME);
    results.push({
      scenario: item.scenario,
      signature: result.findings.signature.result,
      expiry: result.findings.expiry.result,
      revocation: result.findings.revocation.result,
      issuerTrust: result.issuer.result,
      errorCode: result.errorCode,
      sourceVersions: [
        ...result.findings.signature.sourceRefs,
        ...result.findings.expiry.sourceRefs,
        ...result.findings.revocation.sourceRefs,
        ...result.issuer.sourceRefs,
      ].map(({ service, recordRef, sourceVersion }) => ({ service, recordRef, sourceVersion })),
    });
  }
  return results;
}

function tamperSignature(token: string): string {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) throw new Error("Unexpected compact JWS shape");
  const first = signature[0] === "A" ? "B" : "A";
  return `${header}.${payload}.${first}${signature.slice(1)}`;
}

function changeHeaderKeyId(token: string, kid: string): string {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) throw new Error("Unexpected compact JWS shape");
  const decoded: unknown = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("Unexpected JWS header");
  const altered = { ...decoded, kid };
  return `${Buffer.from(JSON.stringify(altered)).toString("base64url")}.${payload}.${signature}`;
}
