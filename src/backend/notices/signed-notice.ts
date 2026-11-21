import "server-only";
import { CompactSign, compactVerify } from "jose";
import {
  CompactJwsSchema,
  FindingReasonCodeSchema,
  ReferenceSchema,
  SignedNoticeHeaderSchema,
  SignedNoticePayloadSchema,
  VersionSchema,
  type CompactJws,
  type ExpiryFinding,
  type FindingReasonCode,
  type RevocationFinding,
  type SignatureFinding,
  type SignedNoticePayload,
  type SourceReference,
  type Timestamp,
} from "@/contracts/v1";
import { assertUniqueJsonMembers, JsonMemberError } from "@/lib/json-members";

const NOTICE_ALG = "Ed25519";
const NOTICE_TYP = "sanad-notice+jws";
const MAX_JWS_LENGTH = 8192;
const EMBEDDED_KEY_HEADERS = new Set(["jwk", "jku", "x5u", "x5c", "x5t", "x5t#S256"]);
const HEADER_KEYS = new Set(["alg", "kid", "typ"]);

export type NoticeErrorCode =
  | "INVALID_NOTICE_PAYLOAD"
  | "SIGNING_KEY_UNAVAILABLE"
  | "INVALID_SIGNING_KEY"
  | "SIGNING_FAILED"
  | "INVALID_VERIFICATION_TIME"
  | "MALFORMED_JWS"
  | "MALFORMED_HEADER"
  | "EMBEDDED_KEY"
  | "UNSUPPORTED_ALGORITHM"
  | "DUPLICATE_JSON_MEMBER"
  | "MALFORMED_PAYLOAD"
  | "UNSUPPORTED_VERSION"
  | "UNKNOWN_KEY"
  | "UNKNOWN_ISSUER"
  | "ISSUER_REVOKED"
  | "ISSUER_KEY_MISMATCH"
  | "KEY_REVOKED"
  | "KEY_UNTRUSTED"
  | "REGISTRY_UNAVAILABLE"
  | "SIGNATURE_INVALID";

export class NoticeServiceError extends Error {
  constructor(readonly code: NoticeErrorCode) {
    super(code);
    this.name = "NoticeServiceError";
  }
}

export type NoticeSigningKey = {
  kid: string;
  issuerId: string;
  privateKey: CryptoKey;
};

export type NoticeSigningKeyProvider = {
  getSigningKey(issuerId: string): NoticeSigningKey | Promise<NoticeSigningKey>;
};

export type RegistryKeyResolution =
  | {
      status: "FOUND";
      kid: string;
      issuerId: string;
      publicKey: CryptoKey;
      trustStatus: "ACTIVE" | "REVOKED" | "UNTRUSTED";
      sourceVersion: number;
    }
  | { status: "UNKNOWN_KEY" }
  | { status: "UNAVAILABLE" };

export type RegistryIssuerResolution =
  | { status: "ACTIVE" | "REVOKED"; sourceVersion: number }
  | { status: "UNKNOWN_ISSUER" }
  | { status: "UNAVAILABLE" };

export type NoticeRevocationResolution =
  | { status: "ACTIVE" | "REVOKED"; sourceVersion: number }
  | { status: "UNAVAILABLE" };

export type TrustedIssuerRegistry = {
  resolveKey(kid: string): RegistryKeyResolution | Promise<RegistryKeyResolution>;
  resolveIssuer(issuerId: string): RegistryIssuerResolution | Promise<RegistryIssuerResolution>;
  resolveNotice(
    issuerId: string,
    noticeId: string,
  ): NoticeRevocationResolution | Promise<NoticeRevocationResolution>;
};

export type IssuerFinding = {
  result: "TRUSTED" | "UNKNOWN" | "MISMATCH" | "REVOKED" | "KEY_REVOKED" | "KEY_UNTRUSTED" | "UNAVAILABLE";
  reasonCodes: FindingReasonCode[];
  sourceRefs: SourceReference[];
  observedAt: Timestamp;
};

export type NoticeVerificationResult = {
  signature: SignatureFinding;
  expiry: ExpiryFinding;
  revocation: RevocationFinding;
  issuer: IssuerFinding;
  payload: SignedNoticePayload | null;
  errorCode: NoticeErrorCode | null;
};

export async function createSignedNotice(
  input: unknown,
  keyProvider: NoticeSigningKeyProvider,
): Promise<CompactJws> {
  const parsedPayload = SignedNoticePayloadSchema.safeParse(input);
  if (!parsedPayload.success) throw new NoticeServiceError("INVALID_NOTICE_PAYLOAD");

  let signingKey: NoticeSigningKey;
  try {
    signingKey = await keyProvider.getSigningKey(parsedPayload.data.issuerId);
  } catch {
    throw new NoticeServiceError("SIGNING_KEY_UNAVAILABLE");
  }

  if (
    !isRecord(signingKey)
    || typeof signingKey.kid !== "string"
    || !ReferenceSchema.safeParse(signingKey.issuerId).success
    || !isCryptoKey(signingKey.privateKey)
    || !SignedNoticeHeaderSchema.safeParse({ alg: NOTICE_ALG, kid: signingKey.kid, typ: NOTICE_TYP }).success
    || signingKey.privateKey.type !== "private"
    || signingKey.privateKey.algorithm.name !== NOTICE_ALG
    || !signingKey.privateKey.usages.includes("sign")
    || signingKey.privateKey.extractable
  ) {
    throw new NoticeServiceError("INVALID_SIGNING_KEY");
  }
  if (signingKey.issuerId !== parsedPayload.data.issuerId) {
    throw new NoticeServiceError("ISSUER_KEY_MISMATCH");
  }

  try {
    const bytes = new TextEncoder().encode(JSON.stringify(parsedPayload.data));
    const token = await new CompactSign(bytes)
      .setProtectedHeader({ alg: NOTICE_ALG, kid: signingKey.kid, typ: NOTICE_TYP })
      .sign(signingKey.privateKey);
    return CompactJwsSchema.parse(token);
  } catch {
    throw new NoticeServiceError("SIGNING_FAILED");
  }
}

export async function verifySignedNotice(
  input: unknown,
  registry: TrustedIssuerRegistry,
  nowSeconds: number,
): Promise<NoticeVerificationResult> {
  const observedAt = timestampFor(nowSeconds);
  if (!observedAt) return notVerified("INVALID_VERIFICATION_TIME", "UNKNOWN", nowSeconds);
  const tokenResult = CompactJwsSchema.safeParse(input);
  if (!tokenResult.success || tokenResult.data.length > MAX_JWS_LENGTH) {
    return notVerified("MALFORMED_JWS", "UNKNOWN", nowSeconds);
  }

  const token = tokenResult.data;
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (
    !isCanonicalBase64Url(encodedHeader!)
    || !isCanonicalBase64Url(encodedPayload!)
    || !isCanonicalBase64Url(encodedSignature!)
  ) {
    return notVerified("MALFORMED_JWS", "UNKNOWN", nowSeconds);
  }

  let header: unknown;
  try {
    const headerText = decodeBase64Url(encodedHeader!);
    assertUniqueJsonMembers(headerText);
    header = JSON.parse(headerText);
  } catch (error) {
    return notVerified(
      error instanceof JsonMemberError && error.code === "DUPLICATE_MEMBER"
        ? "DUPLICATE_JSON_MEMBER"
        : "MALFORMED_HEADER",
      "UNKNOWN",
      nowSeconds,
    );
  }
  if (!header || typeof header !== "object" || Array.isArray(header)) {
    return notVerified("MALFORMED_HEADER", "UNKNOWN", nowSeconds);
  }
  const headerRecord = header as Record<string, unknown>;
  const headerKeys = Object.keys(headerRecord);
  if (headerKeys.some((key) => EMBEDDED_KEY_HEADERS.has(key))) {
    return notVerified("EMBEDDED_KEY", "UNKNOWN", nowSeconds);
  }
  if (
    headerKeys.length !== HEADER_KEYS.size
    || headerKeys.some((key) => !HEADER_KEYS.has(key))
    || headerRecord.typ !== NOTICE_TYP
  ) {
    return notVerified("MALFORMED_HEADER", "UNKNOWN", nowSeconds);
  }
  if (headerRecord.alg !== NOTICE_ALG) {
    return notVerified("UNSUPPORTED_ALGORITHM", "UNKNOWN", nowSeconds);
  }
  const parsedHeader = SignedNoticeHeaderSchema.safeParse(header);
  if (!parsedHeader.success) return notVerified("MALFORMED_HEADER", "UNKNOWN", nowSeconds);

  let keyResolution: RegistryKeyResolution;
  try {
    keyResolution = await registry.resolveKey(parsedHeader.data.kid);
  } catch {
    return notVerified("REGISTRY_UNAVAILABLE", "UNAVAILABLE", nowSeconds);
  }
  if (!isRegistryKeyResolution(keyResolution, parsedHeader.data.kid)) {
    return notVerified("REGISTRY_UNAVAILABLE", "UNAVAILABLE", nowSeconds);
  }
  if (keyResolution.status === "UNAVAILABLE") {
    const attempt = registryAttempt("trusted_issuer_registry", observedAt);
    return notVerified("REGISTRY_UNAVAILABLE", "UNAVAILABLE", nowSeconds, "NOT_VERIFIED", {
      signature: [attempt],
      issuer: [attempt],
    });
  }
  if (keyResolution.status === "UNKNOWN_KEY") {
    const attempt = registryAttempt("trusted_issuer_registry", observedAt);
    return notVerified("UNKNOWN_KEY", "UNKNOWN", nowSeconds, "NOT_VERIFIED", {
      signature: [attempt],
      issuer: [attempt],
    });
  }
  if (keyResolution.trustStatus === "REVOKED") {
    const keyRef = registryRecord("trusted_issuer_registry", keyResolution.kid, keyResolution.sourceVersion, observedAt);
    return notVerified("KEY_REVOKED", "KEY_REVOKED", nowSeconds, "NOT_VERIFIED", {
      signature: [keyRef],
      issuer: [keyRef],
    });
  }
  if (keyResolution.trustStatus !== "ACTIVE") {
    const keyRef = registryRecord("trusted_issuer_registry", keyResolution.kid, keyResolution.sourceVersion, observedAt);
    return notVerified("KEY_UNTRUSTED", "KEY_UNTRUSTED", nowSeconds, "NOT_VERIFIED", {
      signature: [keyRef],
      issuer: [keyRef],
    });
  }

  let verifiedPayload: Uint8Array;
  try {
    const verified = await compactVerify(token, keyResolution.publicKey, { algorithms: [NOTICE_ALG] });
    verifiedPayload = verified.payload;
  } catch {
    const keyRef = registryRecord("trusted_issuer_registry", keyResolution.kid, keyResolution.sourceVersion, observedAt);
    return notVerified("SIGNATURE_INVALID", "UNKNOWN", nowSeconds, "INVALID", { signature: [keyRef] });
  }

  let payload: SignedNoticePayload;
  try {
    const payloadText = new TextDecoder("utf-8", { fatal: true }).decode(verifiedPayload);
    assertUniqueJsonMembers(payloadText);
    const rawPayload: unknown = JSON.parse(payloadText);
    const parsedPayload = SignedNoticePayloadSchema.safeParse(rawPayload);
    if (!parsedPayload.success) {
      const code = isRecord(rawPayload) && "v" in rawPayload && rawPayload.v !== 1
        ? "UNSUPPORTED_VERSION"
        : "MALFORMED_PAYLOAD";
      return notVerified(code, "UNKNOWN", nowSeconds);
    }
    payload = parsedPayload.data;
  } catch (error) {
    return notVerified(
      error instanceof JsonMemberError && error.code === "DUPLICATE_MEMBER"
        ? "DUPLICATE_JSON_MEMBER"
        : "MALFORMED_PAYLOAD",
      "UNKNOWN",
      nowSeconds,
    );
  }

  const keyRef = registryRecord("trusted_issuer_registry", keyResolution.kid, keyResolution.sourceVersion, observedAt);
  let issuerResolution: RegistryIssuerResolution;
  try {
    issuerResolution = await registry.resolveIssuer(payload.issuerId);
  } catch {
    return notVerified("REGISTRY_UNAVAILABLE", "UNAVAILABLE", nowSeconds, "NOT_VERIFIED", {
      signature: [keyRef],
      issuer: [registryAttempt("trusted_issuer_registry", observedAt)],
    });
  }
  if (!isRegistryIssuerResolution(issuerResolution)) {
    return notVerified("REGISTRY_UNAVAILABLE", "UNAVAILABLE", nowSeconds, "NOT_VERIFIED", {
      signature: [keyRef],
      issuer: [registryAttempt("trusted_issuer_registry", observedAt)],
    });
  }
  if (issuerResolution.status === "UNAVAILABLE") {
    return notVerified("REGISTRY_UNAVAILABLE", "UNAVAILABLE", nowSeconds, "NOT_VERIFIED", {
      signature: [keyRef],
      issuer: [registryAttempt("trusted_issuer_registry", observedAt)],
    });
  }
  if (issuerResolution.status === "UNKNOWN_ISSUER") {
    return notVerified("UNKNOWN_ISSUER", "UNKNOWN", nowSeconds, "NOT_VERIFIED", {
      signature: [keyRef],
      issuer: [registryAttempt("trusted_issuer_registry", observedAt)],
    });
  }
  if (issuerResolution.status === "REVOKED") {
    const issuerRef = registryRecord("trusted_issuer_registry", payload.issuerId, issuerResolution.sourceVersion, observedAt);
    return notVerified("ISSUER_REVOKED", "REVOKED", nowSeconds, "NOT_VERIFIED", {
      signature: [keyRef],
      issuer: [issuerRef],
    });
  }
  if (keyResolution.issuerId !== payload.issuerId) {
    const issuerRef = registryRecord("trusted_issuer_registry", payload.issuerId, issuerResolution.sourceVersion, observedAt);
    return notVerified("ISSUER_KEY_MISMATCH", "MISMATCH", nowSeconds, "NOT_VERIFIED", {
      signature: [keyRef, issuerRef],
      issuer: [issuerRef],
    });
  }

  const expiry = expiryFinding(
    payload,
    nowSeconds,
    observedAt,
    [registryRecord("signed_notice", payload.noticeId, payload.v, observedAt)],
  );
  let noticeResolution: NoticeRevocationResolution;
  try {
    noticeResolution = await registry.resolveNotice(payload.issuerId, payload.noticeId);
  } catch {
    noticeResolution = { status: "UNAVAILABLE" };
  }
  if (!isNoticeRevocationResolution(noticeResolution)) {
    noticeResolution = { status: "UNAVAILABLE" };
  }
  const noticeRef = noticeResolution.status === "UNAVAILABLE"
    ? registryAttempt("notice_revocation_registry", observedAt)
    : registryRecord("notice_revocation_registry", payload.noticeId, noticeResolution.sourceVersion, observedAt);
  const revocation = revocationFinding(noticeResolution, observedAt, [noticeRef]);
  return {
    signature: finding("VALID", "SIGNATURE_VALID", observedAt, [keyRef]),
    expiry,
    revocation,
    issuer: issuerFinding(
      "TRUSTED",
      [],
      observedAt,
      [registryRecord("trusted_issuer_registry", payload.issuerId, issuerResolution.sourceVersion, observedAt)],
    ),
    payload,
    errorCode: noticeResolution.status === "UNAVAILABLE" ? "REGISTRY_UNAVAILABLE" : null,
  };
}

function expiryFinding(
  payload: Pick<SignedNoticePayload, "issuedAt" | "expiresAt">,
  nowSeconds: number,
  observedAt: Timestamp,
  sourceRefs: SourceReference[],
): ExpiryFinding {
  if (nowSeconds < payload.issuedAt) {
    return { result: "NOT_YET_VALID", reasonCodes: [], sourceRefs, observedAt };
  }
  if (nowSeconds >= payload.expiresAt) {
    return { result: "EXPIRED", reasonCodes: ["NOTICE_EXPIRED"], sourceRefs, observedAt };
  }
  return { result: "CURRENT", reasonCodes: [], sourceRefs, observedAt };
}

function revocationFinding(
  resolution: NoticeRevocationResolution,
  observedAt: Timestamp,
  sourceRefs: SourceReference[],
): RevocationFinding {
  if (resolution.status === "REVOKED") {
    return { result: "REVOKED", reasonCodes: ["NOTICE_REVOKED"], sourceRefs, observedAt };
  }
  if (resolution.status === "UNAVAILABLE") {
    return { result: "UNKNOWN", reasonCodes: ["REGISTRY_UNAVAILABLE"], sourceRefs, observedAt };
  }
  return { result: "ACTIVE", reasonCodes: [], sourceRefs, observedAt };
}

function finding(
  result: SignatureFinding["result"],
  reasonCode: FindingReasonCode,
  observedAt: Timestamp,
  sourceRefs: SourceReference[],
): SignatureFinding {
  return { result, reasonCodes: [reasonCode], sourceRefs, observedAt };
}

function issuerFinding(
  result: IssuerFinding["result"],
  reasonCodes: FindingReasonCode[],
  observedAt: Timestamp,
  sourceRefs: SourceReference[] = [],
): IssuerFinding {
  return { result, reasonCodes, sourceRefs, observedAt };
}

function notVerified(
  code: NoticeErrorCode,
  issuerResult: IssuerFinding["result"],
  nowSeconds: number,
  signatureResult: SignatureFinding["result"] = "NOT_VERIFIED",
  sources: Partial<Record<"signature" | "issuer", SourceReference[]>> = {},
): NoticeVerificationResult {
  const observedAt = timestampFor(nowSeconds) ?? new Date().toISOString();
  const reasonCode = reasonCodeFor(code);
  return {
    signature: {
      result: signatureResult,
      reasonCodes: reasonCode ? [reasonCode] : [],
      sourceRefs: sources.signature ?? [],
      observedAt,
    },
    expiry: { result: "UNKNOWN", reasonCodes: [], sourceRefs: [], observedAt },
    revocation: {
      result: "UNKNOWN",
      reasonCodes: code === "REGISTRY_UNAVAILABLE" ? ["REGISTRY_UNAVAILABLE"] : [],
      sourceRefs: [],
      observedAt,
    },
    issuer: issuerFinding(issuerResult, reasonCode ? [reasonCode] : [], observedAt, sources.issuer),
    payload: null,
    errorCode: code,
  };
}

function reasonCodeFor(code: NoticeErrorCode): FindingReasonCode | null {
  const mapping: Partial<Record<NoticeErrorCode, FindingReasonCode>> = {
    UNKNOWN_KEY: "UNKNOWN_KEY",
    UNKNOWN_ISSUER: "UNKNOWN_ISSUER",
    ISSUER_REVOKED: "UNKNOWN_ISSUER",
    REGISTRY_UNAVAILABLE: "REGISTRY_UNAVAILABLE",
    SIGNATURE_INVALID: "SIGNATURE_INVALID",
    UNSUPPORTED_VERSION: "UNSUPPORTED_VERSION",
  };
  const reason = mapping[code];
  return reason && FindingReasonCodeSchema.safeParse(reason).success ? reason : null;
}

function timestampFor(seconds: number): Timestamp | null {
  if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 8_640_000_000_000) return null;
  return new Date(seconds * 1000).toISOString();
}

function registryAttempt(service: string, observedAt: Timestamp): SourceReference {
  return { service, recordRef: null, sourceVersion: null, observedAt };
}

function registryRecord(
  service: string,
  recordRef: string,
  sourceVersion: number,
  observedAt: Timestamp,
): SourceReference {
  return { service, recordRef, sourceVersion, observedAt };
}

function isRegistryKeyResolution(value: unknown, expectedKid: string): value is RegistryKeyResolution {
  if (!isRecord(value) || typeof value.status !== "string") return false;
  if (value.status === "UNKNOWN_KEY" || value.status === "UNAVAILABLE") return true;
  return value.status === "FOUND"
    && value.kid === expectedKid
    && ReferenceSchema.safeParse(value.kid).success
    && ReferenceSchema.safeParse(value.issuerId).success
    && VersionSchema.safeParse(value.sourceVersion).success
    && (value.trustStatus === "ACTIVE" || value.trustStatus === "REVOKED" || value.trustStatus === "UNTRUSTED")
    && (value.trustStatus !== "ACTIVE" || isVerifyingEd25519Key(value.publicKey));
}

function isRegistryIssuerResolution(value: unknown): value is RegistryIssuerResolution {
  return isRecord(value)
    && (value.status === "UNKNOWN_ISSUER" || value.status === "UNAVAILABLE"
      || ((value.status === "ACTIVE" || value.status === "REVOKED")
        && VersionSchema.safeParse(value.sourceVersion).success));
}

function isNoticeRevocationResolution(value: unknown): value is NoticeRevocationResolution {
  return isRecord(value)
    && (value.status === "UNAVAILABLE"
      || ((value.status === "ACTIVE" || value.status === "REVOKED")
        && VersionSchema.safeParse(value.sourceVersion).success));
}

function isVerifyingEd25519Key(value: unknown): value is CryptoKey {
  return isCryptoKey(value)
    && value.type === "public"
    && value.algorithm.name === NOTICE_ALG
    && value.usages.includes("verify");
}

function isCryptoKey(value: unknown): value is CryptoKey {
  return typeof CryptoKey !== "undefined" && value instanceof CryptoKey;
}

function isCanonicalBase64Url(segment: string): boolean {
  return Buffer.from(segment, "base64url").toString("base64url") === segment;
}

function decodeBase64Url(segment: string): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(segment, "base64url"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
