import { CompactSign, compactVerify, generateKeyPair } from "jose";
import { SignedNoticePayloadSchema, type SignedNoticePayload } from "@/contracts/v1";
import { assertUniqueJsonMembers, JsonMemberError } from "@/lib/json-members";
import type { TrustedIssuerRegistry } from "./registry";

export const NOTICE_ALG = "Ed25519" as const;
export const NOTICE_TYP = "sanad-notice+jws" as const;

export type SignatureFinding = "VALID" | "INVALID" | "NOT_VERIFIED";
export type ExpiryFinding = "CURRENT" | "EXPIRED" | "NOT_YET_VALID" | "UNKNOWN";

/**
 * Cryptographic and expiry findings only.
 * Payment settlement and eligibility are intentionally absent.
 */
export type NoticeVerification = {
  signature: SignatureFinding;
  signatureReason: string;
  expiry: ExpiryFinding;
  expiryReason: string | null;
  issuerId: string | null;
  kid: string | null;
};

const HEADER_KEYS = new Set(["alg", "kid", "typ"]);
const EMBEDDED_KEY_HEADERS = new Set(["jwk", "jku", "x5u", "x5c", "x5t", "x5t#S256"]);

export async function generateSyntheticIssuerKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}> {
  return generateKeyPair(NOTICE_ALG, { extractable: false });
}

export async function signReliefNotice(
  payload: SignedNoticePayload,
  privateKey: CryptoKey,
  kid: string,
): Promise<string> {
  const parsed = SignedNoticePayloadSchema.parse(payload);
  const bytes = new TextEncoder().encode(JSON.stringify(parsed));
  return new CompactSign(bytes)
    .setProtectedHeader({ alg: NOTICE_ALG, kid, typ: NOTICE_TYP })
    .sign(privateKey);
}

export async function verifySignedNotice(
  token: string,
  registry: TrustedIssuerRegistry,
  nowSeconds: number,
): Promise<NoticeVerification> {
  if (typeof token !== "string" || token.length === 0 || token.length > 8192) {
    return notVerified("MALFORMED_JWS");
  }
  const segments = token.split(".");
  if (segments.length !== 3 || segments.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment))) {
    return notVerified("MALFORMED_JWS");
  }
  const [encodedHeader, encodedPayload] = segments as [string, string, string];

  let headerText: string;
  try {
    headerText = decodeSegment(encodedHeader);
    assertUniqueJsonMembers(headerText);
  } catch (error) {
    return notVerified(error instanceof JsonMemberError && error.code === "DUPLICATE_MEMBER"
      ? "DUPLICATE_JSON_MEMBER"
      : "MALFORMED_JWS");
  }

  let header: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(headerText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return notVerified("MALFORMED_JWS");
    header = parsed as Record<string, unknown>;
  } catch {
    return notVerified("MALFORMED_JWS");
  }

  const headerKeys = Object.keys(header);
  if (headerKeys.some((key) => EMBEDDED_KEY_HEADERS.has(key))) {
    return notVerified("EMBEDDED_KEY", typeof header.kid === "string" ? header.kid : null);
  }
  if (headerKeys.length !== 3 || headerKeys.some((key) => !HEADER_KEYS.has(key)) || "crit" in header) {
    return notVerified("MALFORMED_JWS", typeof header.kid === "string" ? header.kid : null);
  }
  if (header.alg !== NOTICE_ALG) {
    return notVerified("UNSUPPORTED_ALGORITHM", typeof header.kid === "string" ? header.kid : null);
  }
  if (typeof header.kid !== "string" || typeof header.typ !== "string" || header.typ !== NOTICE_TYP) {
    return notVerified("MALFORMED_JWS");
  }

  let resolution;
  try {
    resolution = await registry.resolve(header.kid);
  } catch {
    return notVerified("REGISTRY_UNAVAILABLE", header.kid);
  }
  if (resolution.status === "UNAVAILABLE") return notVerified("REGISTRY_UNAVAILABLE", header.kid);
  if (resolution.status === "UNKNOWN_KEY") return notVerified("UNKNOWN_KEY", header.kid);

  try {
    const verified = await compactVerify(token, resolution.publicKey, { algorithms: [NOTICE_ALG] });
    const originalPayload = decodeSegment(encodedPayload);
    const verifiedPayload = new TextDecoder("utf-8", { fatal: true }).decode(verified.payload);
    if (verifiedPayload !== originalPayload) return invalid(header.kid);
    assertUniqueJsonMembers(originalPayload);
    const parsed: unknown = JSON.parse(originalPayload);
    const payload = SignedNoticePayloadSchema.safeParse(parsed);
    if (!payload.success) return notVerified("MALFORMED_PAYLOAD", header.kid);
    if (payload.data.issuerId !== resolution.issuerId) {
      const expiry = expiryFinding(payload.data, nowSeconds);
      return {
        signature: "NOT_VERIFIED",
        signatureReason: "UNKNOWN_ISSUER",
        expiry: expiry.expiry,
        expiryReason: expiry.expiryReason,
        issuerId: payload.data.issuerId,
        kid: header.kid,
      };
    }
    const expiry = expiryFinding(payload.data, nowSeconds);
    return {
      signature: "VALID",
      signatureReason: "SIGNATURE_VALID",
      expiry: expiry.expiry,
      expiryReason: expiry.expiryReason,
      issuerId: payload.data.issuerId,
      kid: header.kid,
    };
  } catch (error) {
    if (error instanceof JsonMemberError && error.code === "DUPLICATE_MEMBER") {
      return notVerified("DUPLICATE_JSON_MEMBER", header.kid);
    }
    return invalid(header.kid);
  }
}

export function expiryFinding(
  payload: Pick<SignedNoticePayload, "issuedAt" | "expiresAt">,
  nowSeconds: number,
): { expiry: Exclude<ExpiryFinding, "UNKNOWN">; expiryReason: string } {
  if (nowSeconds < payload.issuedAt) return { expiry: "NOT_YET_VALID", expiryReason: "NOTICE_NOT_YET_VALID" };
  if (nowSeconds >= payload.expiresAt) return { expiry: "EXPIRED", expiryReason: "NOTICE_EXPIRED" };
  return { expiry: "CURRENT", expiryReason: "NOTICE_CURRENT" };
}

function invalid(kid: string): NoticeVerification {
  return {
    signature: "INVALID",
    signatureReason: "SIGNATURE_INVALID",
    expiry: "UNKNOWN",
    expiryReason: null,
    issuerId: null,
    kid,
  };
}

function notVerified(signatureReason: string, kid: string | null = null): NoticeVerification {
  return {
    signature: "NOT_VERIFIED",
    signatureReason,
    expiry: "UNKNOWN",
    expiryReason: null,
    issuerId: null,
    kid,
  };
}

function decodeSegment(segment: string): string {
  const bytes = Buffer.from(segment, "base64url");
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
