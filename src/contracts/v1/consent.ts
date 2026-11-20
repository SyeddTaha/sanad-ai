import { z } from "zod";
import { IdSchema, ReferenceSchema, TimestampSchema, VersionSchema } from "./scalars";

export const ConsentActionSchema = z.enum([
  "READ_CASE", "READ_EVIDENCE", "WRITE_DRAFT", "ADD_EVIDENCE", "SUBMIT_CASE",
  "REQUEST_ASSESSMENT", "REVIEW_CASE", "RESOLVE_CASE", "CLOSE_CASE", "PROCESS_AI",
  "ASSIGN_CASE", "ESCALATE_CASE",
]);
export const ConsentRecipientTypeSchema = z.enum(["PRINCIPAL", "DEPARTMENT", "AI_PROCESSOR"]);
// Disclosed purpose catalog awaits freeze; no invented production purpose enum.
export const ConsentPurposeSchema = ReferenceSchema;

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
}).refine((grant) => Date.parse(grant.expiresAt) > Date.parse(grant.createdAt), {
  path: ["expiresAt"], message: "Expiry must follow creation",
}).refine((grant) => grant.revokedAt === null || Date.parse(grant.revokedAt) >= Date.parse(grant.createdAt), {
  path: ["revokedAt"], message: "Withdrawal cannot precede creation",
});

export type ConsentAction = z.infer<typeof ConsentActionSchema>;
export type ConsentRecipientType = z.infer<typeof ConsentRecipientTypeSchema>;
export type ConsentPurpose = z.infer<typeof ConsentPurposeSchema>;
export type ConsentGrant = z.infer<typeof ConsentGrantSchema>;
