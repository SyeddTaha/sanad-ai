import { z } from "zod";
import { ConfidenceSchema, IdSchema, ReferenceSchema } from "./scalars";

export const AiClassificationSchema = z.enum(["SUSPICIOUS_MESSAGE", "PAYMENT_DISPUTE", "CLARIFICATION", "UNKNOWN"]);
export const AiRecommendedRouteSchema = z.enum(["ASK_FOR_EVIDENCE", "OFFICER_REVIEW", "INFORMATION_ONLY"]);
export const ExplanationReferenceSchema = z.strictObject({ factId: ReferenceSchema, explanationKey: ReferenceSchema });

const runVersions = {
  runId: IdSchema,
  modelVersion: z.string().min(1),
  promptVersion: z.string().min(1),
  outputSchemaVersion: z.string().min(1),
};

/** Metadata only. No model invocation or acceptance of model-produced findings. */
const notAuthorizedSchema = z.strictObject({
  status: z.literal("NOT_AUTHORIZED"),
  runId: z.null(),
  modelVersion: z.null(),
  promptVersion: z.null(),
  outputSchemaVersion: z.null(),
  confidence: z.null(),
  classification: z.null(),
  recommendedRoute: z.null(),
  explanationRefs: z.array(z.never()).length(0),
  failureCode: z.null(),
});

const succeededSchema = z.strictObject({
  status: z.literal("SUCCEEDED"),
  ...runVersions,
  confidence: ConfidenceSchema,
  classification: AiClassificationSchema,
  recommendedRoute: AiRecommendedRouteSchema,
  explanationRefs: z.array(ExplanationReferenceSchema),
  failureCode: z.null(),
});

const failedAttemptSchema = z.strictObject({
  ...notAuthorizedSchema.shape,
  ...runVersions,
  status: z.enum(["UNAVAILABLE", "INVALID_OUTPUT"]),
  failureCode: ReferenceSchema,
});
const unavailableWithoutRunSchema = z.strictObject({
  ...notAuthorizedSchema.shape,
  status: z.literal("UNAVAILABLE"),
  failureCode: ReferenceSchema,
});
export const AiAssessmentMetadataSchema = z.union([
  notAuthorizedSchema, succeededSchema, failedAttemptSchema, unavailableWithoutRunSchema,
]);
export type AiClassification = z.infer<typeof AiClassificationSchema>;
export type AiRecommendedRoute = z.infer<typeof AiRecommendedRouteSchema>;
export type ExplanationReference = z.infer<typeof ExplanationReferenceSchema>;
export type AiAssessmentMetadata = z.infer<typeof AiAssessmentMetadataSchema>;
