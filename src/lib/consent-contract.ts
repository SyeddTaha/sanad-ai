import { z } from "zod";
import { ApiCollectionSchema, ApiSuccessSchema, ConsentActionSchema, ConsentGrantSchema, ConsentRecipientTypeSchema, IdSchema, TimestampSchema, VersionSchema } from "@/contracts/v1";

// B02 additions compose frozen v1 types; no existing export changes.
export const ConsentPurposes = {
  synthetic_helper_assistance: { recipientType: "PRINCIPAL", role: "HELPER", actions: ["READ_CASE", "READ_EVIDENCE", "WRITE_DRAFT", "ADD_EVIDENCE", "SUBMIT_CASE", "REQUEST_ASSESSMENT"] },
  synthetic_department_review: { recipientType: "DEPARTMENT", role: "OFFICER", actions: ["READ_CASE", "READ_EVIDENCE", "REQUEST_ASSESSMENT", "REVIEW_CASE", "RESOLVE_CASE", "CLOSE_CASE", "ASSIGN_CASE", "ESCALATE_CASE"] },
  synthetic_audit_review: { recipientType: "PRINCIPAL", role: "AUDITOR", actions: ["READ_CASE", "READ_EVIDENCE"] },
  synthetic_ai_assistance: { recipientType: "AI_PROCESSOR", role: null, actions: ["PROCESS_AI"] },
} as const;
// Stable server registry entry for the AI module's configured adapter, not an AI implementation.
export const SANAD_AI_PROCESSOR_ID = "a1000000-0000-4000-8000-000000000001";
export const OperationalPurposeSchema = z.enum(Object.keys(ConsentPurposes) as [keyof typeof ConsentPurposes, ...(keyof typeof ConsentPurposes)[]]);
export const ReserveCaseRequestSchema = z.strictObject({});
export const CaseReservationSchema = z.strictObject({ caseId: IdSchema, citizenId: IdSchema, version: z.literal(1), createdAt: TimestampSchema });
export const CaseReservationResponseSchema = ApiSuccessSchema(CaseReservationSchema);
export const CreateConsentRequestSchema = z.strictObject({
  recipientType: ConsentRecipientTypeSchema, recipientId: IdSchema, purpose: OperationalPurposeSchema,
  actions: z.array(ConsentActionSchema).min(1).max(12).refine((a) => new Set(a).size === a.length),
  expiresAt: TimestampSchema,
});
export const RevokeConsentRequestSchema = z.strictObject({ expectedVersion: VersionSchema });
export const ConsentResponseSchema = ApiSuccessSchema(ConsentGrantSchema);
export const ConsentListResponseSchema = ApiSuccessSchema(ApiCollectionSchema(ConsentGrantSchema));
export type CreateConsentRequest = z.infer<typeof CreateConsentRequestSchema>;
