import { z } from "zod";
import { ReferenceSchema, TimestampSchema, VersionSchema } from "./scalars";

// These finite result/reason refinements are frozen v1.0.0 projections of §4.
export const SignatureResultSchema = z.enum(["VALID", "INVALID", "NOT_VERIFIED"]);
export const ExpiryResultSchema = z.enum(["CURRENT", "EXPIRED", "NOT_YET_VALID", "UNKNOWN"]);
export const RevocationResultSchema = z.enum(["ACTIVE", "REVOKED", "UNKNOWN"]);
export const RecipientMatchResultSchema = z.enum(["MATCH", "MISMATCH", "AMBIGUOUS", "UNKNOWN"]);
export const PaymentResultSchema = z.enum(["SETTLED", "PENDING", "FAILED", "UNKNOWN"]);
export const EligibilityResultSchema = z.enum(["ELIGIBLE", "INELIGIBLE", "UNKNOWN"]);
export const FindingReasonCodeSchema = z.enum([
  "SIGNATURE_VALID", "SIGNATURE_INVALID", "TOKEN_MISSING", "UNKNOWN_ISSUER",
  "UNKNOWN_KEY", "UNSUPPORTED_VERSION", "REGISTRY_UNAVAILABLE", "NOTICE_EXPIRED",
  "NOTICE_REVOKED", "RECORD_NOT_FOUND", "SOURCE_UNAVAILABLE", "RECIPIENT_AMBIGUOUS",
  "RECIPIENT_MISMATCH", "DETAILS_MISMATCH", "ELIGIBILITY_INPUT_MISSING", "RULE_THRESHOLD_EXCEEDED",
]);

export const SourceReferenceSchema = z.union([
  z.strictObject({
    service: ReferenceSchema, recordRef: ReferenceSchema,
    sourceVersion: VersionSchema, observedAt: TimestampSchema,
  }),
  z.strictObject({
    service: ReferenceSchema, recordRef: z.null(),
    sourceVersion: z.null(), observedAt: TimestampSchema,
  }),
]);

function findingSchema<T extends z.ZodType>(result: T) {
  return z.strictObject({
    result,
    reasonCodes: z.array(FindingReasonCodeSchema),
    sourceRefs: z.array(SourceReferenceSchema),
    observedAt: TimestampSchema,
  });
}

export const SignatureFindingSchema = findingSchema(SignatureResultSchema);
export const ExpiryFindingSchema = findingSchema(ExpiryResultSchema);
export const RevocationFindingSchema = findingSchema(RevocationResultSchema);
export const RecipientMatchFindingSchema = findingSchema(RecipientMatchResultSchema);
export const PaymentFindingSchema = findingSchema(PaymentResultSchema);
export const EligibilityFindingSchema = findingSchema(EligibilityResultSchema);

export const EvidenceFindingsSchema = z.strictObject({
  signature: SignatureFindingSchema,
  expiry: ExpiryFindingSchema,
  revocation: RevocationFindingSchema,
  recipientMatch: RecipientMatchFindingSchema,
  payment: PaymentFindingSchema,
  eligibility: EligibilityFindingSchema,
});

export type SignatureResult = z.infer<typeof SignatureResultSchema>;
export type ExpiryResult = z.infer<typeof ExpiryResultSchema>;
export type RevocationResult = z.infer<typeof RevocationResultSchema>;
export type RecipientMatchResult = z.infer<typeof RecipientMatchResultSchema>;
export type PaymentResult = z.infer<typeof PaymentResultSchema>;
export type EligibilityResult = z.infer<typeof EligibilityResultSchema>;
export type FindingReasonCode = z.infer<typeof FindingReasonCodeSchema>;
export type SourceReference = z.infer<typeof SourceReferenceSchema>;
export type SignatureFinding = z.infer<typeof SignatureFindingSchema>;
export type ExpiryFinding = z.infer<typeof ExpiryFindingSchema>;
export type RevocationFinding = z.infer<typeof RevocationFindingSchema>;
export type RecipientMatchFinding = z.infer<typeof RecipientMatchFindingSchema>;
export type PaymentFinding = z.infer<typeof PaymentFindingSchema>;
export type EligibilityFinding = z.infer<typeof EligibilityFindingSchema>;
export type EvidenceFindings = z.infer<typeof EvidenceFindingsSchema>;
