import { z } from "zod";
import { IdSchema, ReferenceSchema, TimestampSchema, VersionSchema } from "./scalars";

export const ConsentActionSchema = z.enum([
  "READ_CASE", "READ_EVIDENCE", "WRITE_DRAFT", "ADD_EVIDENCE", "SUBMIT_CASE",
  "REQUEST_ASSESSMENT", "REVIEW_CASE", "RESOLVE_CASE", "CLOSE_CASE", "PROCESS_AI",
  "ASSIGN_CASE", "ESCALATE_CASE",
]);
export const ConsentRecipientTypeSchema = z.enum(["PRINCIPAL", "DEPARTMENT", "AI_PROCESSOR"]);
// Operational purpose allowlist remains deferred; Reference checks syntax only.
export const ConsentPurposeSchema = ReferenceSchema;

// TimestampSchema supplies fixed-width UTC seconds and optional fractional digits.
// Date.parse would discard precision beyond milliseconds during shape validation.
function compareTimestamps(left: string, right: string): number {
  const [leftSecond, leftFraction = ""] = left.slice(0, -1).split(".");
  const [rightSecond, rightFraction = ""] = right.slice(0, -1).split(".");
  if (leftSecond !== rightSecond) return leftSecond < rightSecond ? -1 : 1;
  const precision = Math.max(leftFraction.length, rightFraction.length);
  const leftDigits = leftFraction.padEnd(precision, "0");
  const rightDigits = rightFraction.padEnd(precision, "0");
  return leftDigits === rightDigits ? 0 : leftDigits < rightDigits ? -1 : 1;
}

export const ConsentGrantSchema = z.strictObject({
  id: IdSchema,
  caseId: IdSchema,
  grantorCitizenId: IdSchema,
  recipientType: ConsentRecipientTypeSchema,
  recipientId: IdSchema,
  purpose: ConsentPurposeSchema,
  actions: z.array(ConsentActionSchema).min(1)
    .refine((actions) => new Set(actions).size === actions.length, "Duplicate action"),
  expiresAt: TimestampSchema,
  revokedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  version: VersionSchema,
}).refine((grant) => compareTimestamps(grant.expiresAt, grant.createdAt) > 0, {
  path: ["expiresAt"], message: "Expiry must follow creation",
}).refine((grant) => grant.revokedAt === null || compareTimestamps(grant.revokedAt, grant.createdAt) >= 0, {
  path: ["revokedAt"], message: "Withdrawal cannot precede creation",
});

export type ConsentAction = z.infer<typeof ConsentActionSchema>;
export type ConsentRecipientType = z.infer<typeof ConsentRecipientTypeSchema>;
export type ConsentPurpose = z.infer<typeof ConsentPurposeSchema>;
export type ConsentGrant = z.infer<typeof ConsentGrantSchema>;
