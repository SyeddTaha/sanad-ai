import { z } from "zod";

/**
 * Local feasibility schema. It follows the approved AI output idea and is not a shared contract.
 * Confidence stored here is an uncalibrated model estimate.
 */
export const PROTOTYPE_SCHEMA_VERSION = "a01-prototype-1";
export const PROTOTYPE_PROMPT_VERSION = "a01-spike-1";

export const PrototypeClassificationSchema = z.enum([
  "SUSPICIOUS_MESSAGE",
  "PAYMENT_DISPUTE",
  "CLARIFICATION",
  "UNKNOWN",
]);

export const PrototypeRouteSchema = z.enum([
  "ASK_FOR_EVIDENCE",
  "OFFICER_REVIEW",
  "INFORMATION_ONLY",
]);

export const PrototypeAiOutputSchema = z.strictObject({
  schemaVersion: z.literal(1),
  extractedIssuerClaim: z.string().min(1).max(200).nullable(),
  claimedAmountMinor: z.int().nonnegative().nullable(),
  paymentRef: z.string().min(1).max(64).nullable(),
  classification: PrototypeClassificationSchema,
  missingInformation: z.array(z.string().min(1).max(200)).max(12),
  confidence: z.number().min(0).max(1),
  suggestedRoute: PrototypeRouteSchema,
  explanation: z.string().min(1).max(600),
});

export type PrototypeAiOutput = z.infer<typeof PrototypeAiOutputSchema>;

export const FORBIDDEN_MODEL_KEYS = [
  "signature",
  "signatureValid",
  "signatureValidity",
  "paymentStatus",
  "settlement",
  "settlementStatus",
  "eligibility",
  "eligible",
  "approved",
  "paid",
] as const;

export function forbiddenModelKeys(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const keys = Object.keys(value);
  return FORBIDDEN_MODEL_KEYS.filter((key) => keys.includes(key));
}
