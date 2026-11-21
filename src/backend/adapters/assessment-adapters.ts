import "server-only";

import {
  AiAssessmentMetadataSchema,
  ExpiryFindingSchema,
  RevocationFindingSchema,
  SignatureFindingSchema,
  type AiAssessmentMetadata,
  type EvidenceFindings,
  type ExpiryFinding,
  type RevocationFinding,
  type SignatureFinding,
  type SignedNoticePayload,
} from "@/contracts/v1";
import {
  assessReliefMessage,
  type AssessmentOptions,
  type AssessmentResult,
} from "@/backend/ai/assessment";
import {
  verifySignedNotice,
  type IssuerFinding,
  type TrustedIssuerRegistry,
} from "@/backend/notices/signed-notice";

export type CaseNoticeFindings = {
  signature: SignatureFinding;
  expiry: ExpiryFinding;
  revocation: RevocationFinding;
};

export type CaseNoticeAdapterResult = {
  findings: CaseNoticeFindings;
  issuer: IssuerFinding;
  payload: SignedNoticePayload | null;
  errorCode: Awaited<ReturnType<typeof verifySignedNotice>>["errorCode"];
};

/** Replaces only findings owned by signed-notice verification. */
export function mergeNoticeFindings(
  existing: EvidenceFindings,
  notice: CaseNoticeFindings,
): EvidenceFindings {
  return {
    ...existing,
    signature: notice.signature,
    expiry: notice.expiry,
    revocation: notice.revocation,
  };
}
/** Cryptographic verification only; recipient, payment and eligibility remain separate adapters. */
export async function verifyNoticeForCase(
  token: unknown,
  registry: TrustedIssuerRegistry,
  nowSeconds: number,
): Promise<CaseNoticeAdapterResult> {
  const result = await verifySignedNotice(token, registry, nowSeconds);
  return {
    findings: {
      signature: SignatureFindingSchema.parse(result.signature),
      expiry: ExpiryFindingSchema.parse(result.expiry),
      revocation: RevocationFindingSchema.parse(result.revocation),
    },
    issuer: result.issuer,
    payload: result.payload,
    errorCode: result.errorCode,
  };
}

export type CaseAiAdapterResult =
  | { kind: "INVALID_INPUT"; assessment: AssessmentResult }
  | { kind: "ASSESSED"; assessment: AssessmentResult; metadata: AiAssessmentMetadata };

/** Runs A03 without a transaction argument; callers must invoke outside DB locks. */
export async function assessForCase(
  message: string,
  options: AssessmentOptions = {},
): Promise<CaseAiAdapterResult> {
  const assessment = await assessReliefMessage(message, options);
  if (assessment.status === "INVALID_INPUT") return { kind: "INVALID_INPUT", assessment };
  return { kind: "ASSESSED", assessment, metadata: AiAssessmentMetadataSchema.parse(toAiMetadata(assessment)) };
}

function toAiMetadata(assessment: Exclude<AssessmentResult, { status: "INVALID_INPUT" }>): AiAssessmentMetadata {
  const noProviderRun = assessment.status === "UNAVAILABLE" && assessment.failureCode === "PROVIDER_UNAVAILABLE";
  if (noProviderRun) {
    return {
      status: "UNAVAILABLE",
      runId: null,
      modelVersion: null,
      promptVersion: null,
      outputSchemaVersion: null,
      confidence: null,
      classification: null,
      recommendedRoute: null,
      explanationRefs: [],
      failureCode: assessment.failureCode!,
    };
  }

  const runId = crypto.randomUUID();
  const versions = {
    runId,
    modelVersion: `${assessment.metadata.provider}/${assessment.metadata.model}`,
    promptVersion: assessment.metadata.promptVersion,
    outputSchemaVersion: assessment.metadata.outputSchemaVersion,
  };
  if (assessment.status !== "SUCCEEDED") {
    return {
      status: assessment.status === "INVALID_OUTPUT" ? "INVALID_OUTPUT" : "UNAVAILABLE",
      ...versions,
      confidence: null,
      classification: null,
      recommendedRoute: null,
      explanationRefs: [],
      failureCode: assessment.failureCode ?? "ASSESSMENT_FAILED",
    };
  }
  return {
    status: "SUCCEEDED",
    ...versions,
    confidence: assessment.confidence!,
    classification: assessment.classification!,
    recommendedRoute: assessment.recommendedRoute,
    explanationRefs: [],
    failureCode: null,
  };
}
