// B03 endpoint compositions approved by the human owner; frozen v1 exports are unchanged.
import { z } from "zod";
import { ApiCollectionSchema, ApiSuccessSchema, AssessmentSchema, CaseSchema, EvidencePassportSchema, IdSchema, TimestampSchema, VersionSchema } from "@/contracts/v1";

const noticeContent = z.strictObject({ noticeToken: z.string().min(1).max(8192).nullable(), messageText: z.string().max(16384).nullable() });
const statementContent = z.strictObject({ text: z.string().min(1).max(2000).refine((v) => !!v.trim()) });
const base = { expectedVersion: VersionSchema, supersedesId: z.null() };
export const AddEvidenceRequestSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...base, kind: z.literal("NOTICE_INPUT"), content: noticeContent.refine((v) => v.noticeToken !== null || !!v.messageText?.trim()) }),
  z.strictObject({ ...base, kind: z.literal("CITIZEN_STATEMENT"), content: statementContent }),
  z.strictObject({ expectedVersion: VersionSchema, supersedesId: IdSchema, kind: z.literal("CORRECTION"), content: statementContent }),
]);
const draftFields = { ...noticeContent.shape, disputeText: z.string().min(1).max(2000).refine((value) => !!value.trim()).nullable(), relatedCaseId: IdSchema.nullable() };
export const SaveDraftRequestSchema = z.strictObject({ expectedVersion: VersionSchema, ...draftFields });
export const CaseDraftSchema = z.strictObject({ caseId: IdSchema, citizenId: IdSchema, version: VersionSchema, evidenceVersion: VersionSchema,
  ...draftFields, createdAt: TimestampSchema, updatedAt: TimestampSchema });
export const SubmitCaseRequestSchema = z.strictObject({ caseId: IdSchema, expectedDraftVersion: VersionSchema });
export const CreateAssessmentRequestSchema = z.strictObject({ expectedEvidenceVersion: VersionSchema, includeAi: z.boolean() });
export const EvidenceItemSchema = z.strictObject({ id: IdSchema, caseId: IdSchema, kind: z.enum(["NOTICE_INPUT", "CITIZEN_STATEMENT", "CORRECTION", "SOURCE_SNAPSHOT"]),
  content: z.union([noticeContent, statementContent]), supersedesId: IdSchema.nullable(), actorId: IdSchema, evidenceVersion: VersionSchema, createdAt: TimestampSchema });
export const AddEvidenceResponseSchema = ApiSuccessSchema(z.strictObject({ evidence: EvidenceItemSchema, caseVersion: VersionSchema, evidenceVersion: VersionSchema }));
export const CaseEventSchema = z.strictObject({ id: IdSchema, caseId: IdSchema, actorId: IdSchema.nullable(), action: z.string().regex(/^[A-Z_]{1,64}$/),
  caseVersion: VersionSchema.nullable(), evidenceVersion: VersionSchema.nullable(), evidenceId: IdSchema.nullable(), assessmentId: IdSchema.nullable(), createdAt: TimestampSchema });
export const DraftResponseSchema = ApiSuccessSchema(CaseDraftSchema);
export const CaseResponseSchema = ApiSuccessSchema(CaseSchema);
export const HistoryResponseSchema = ApiSuccessSchema(ApiCollectionSchema(CaseEventSchema));
export const AssessmentResponseSchema = ApiSuccessSchema(AssessmentSchema);
export const PassportResponseSchema = ApiSuccessSchema(EvidencePassportSchema);
export type CaseDraft = z.infer<typeof CaseDraftSchema>;
export type AddEvidenceRequest = z.infer<typeof AddEvidenceRequestSchema>;
export type SaveDraftRequest = z.infer<typeof SaveDraftRequestSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
