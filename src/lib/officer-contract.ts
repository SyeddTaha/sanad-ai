import { z } from "zod";
import { ApiCollectionSchema, ApiSuccessSchema, CasePrioritySchema, CaseSchema, CaseStatusSchema, IdSchema, MoneyMinorSchema, ResolveCaseRequestSchema, TimestampSchema, VersionSchema } from "@/contracts/v1";
import { EvidenceItemSchema } from "./case-contract";

// B04 endpoint compositions; frozen v1 exports remain unchanged.
export const DispatchItemSchema = z.strictObject({ caseId: IdSchema, departmentId: IdSchema,
  assignedOfficerId: IdSchema.nullable(), status: CaseStatusSchema, priority: CasePrioritySchema,
  version: VersionSchema, createdAt: TimestampSchema, updatedAt: TimestampSchema });
export const StaffQueueResponseSchema = ApiSuccessSchema(ApiCollectionSchema(DispatchItemSchema));
export const OfficerQueueItemSchema=DispatchItemSchema.extend({confidence:z.number().min(0).max(1).nullable()});
export const OfficerQueueResponseSchema=ApiSuccessSchema(ApiCollectionSchema(OfficerQueueItemSchema));
export const StaffOfficerSchema = z.strictObject({ id: IdSchema });
export const StaffOfficerDirectoryResponseSchema = ApiSuccessSchema(z.strictObject({ items: z.array(StaffOfficerSchema) }));
export const CaseVersionRequestSchema = z.strictObject({ expectedVersion: VersionSchema });
export const OfficerReasonRequestSchema = CaseVersionRequestSchema.extend({ reason: ResolveCaseRequestSchema.shape.reason });
export const AssignCaseRequestSchema = OfficerReasonRequestSchema.extend({ departmentId: IdSchema, officerId: IdSchema });
export const SetPriorityRequestSchema = OfficerReasonRequestSchema.extend({ departmentId: IdSchema, priority: CasePrioritySchema });
export const CaseDecisionSchema = z.strictObject({ id:IdSchema,caseId:IdSchema,actorId:IdSchema,action:z.enum(["CASE_ASSIGNED","PRIORITY_CHANGED","CASE_ESCALATED","REVIEW_STARTED","EVIDENCE_REQUESTED","CASE_RESOLVED","CASE_CLOSED","CASE_RESUBMITTED"]),
  reason:ResolveCaseRequestSchema.shape.reason.nullable(),previousOfficerId:IdSchema.nullable(),officerId:IdSchema.nullable(),previousDepartmentId:IdSchema.nullable(),departmentId:IdSchema.nullable(),
  previousStatus:CaseStatusSchema,status:CaseStatusSchema,caseVersion:VersionSchema,evidenceVersion:VersionSchema,
  assessmentId:IdSchema.nullable(),reviewedAssessmentId:IdSchema.nullable(),ruleVersionId:IdSchema.nullable(),createdAt:TimestampSchema });
export const CaseDecisionsResponseSchema=ApiSuccessSchema(ApiCollectionSchema(CaseDecisionSchema));
export const EvidenceListResponseSchema=ApiSuccessSchema(ApiCollectionSchema(EvidenceItemSchema));
export const OfficerActionResponseSchema=ApiSuccessSchema(z.strictObject({case:CaseSchema}));
export const DispatchResponseSchema=ApiSuccessSchema(DispatchItemSchema);
export const ResolutionResponseSchema=ApiSuccessSchema(z.strictObject({case:CaseSchema,assessmentId:IdSchema,resolutionId:IdSchema}));
export const AuditMetadataSchema=z.strictObject({id:IdSchema,requestId:IdSchema,actorId:IdSchema.nullable(),action:z.string(),outcome:z.string(),targetId:IdSchema.nullable(),authorizationRef:IdSchema.nullable(),createdAt:TimestampSchema});
export const AuditMetadataResponseSchema=ApiSuccessSchema(ApiCollectionSchema(AuditMetadataSchema));
export const SyntheticProgramInputSchema=z.strictObject({id:IdSchema,caseId:IdSchema,version:VersionSchema,source:z.literal("SYNTHETIC_DEMO"),
  recipientMatch:z.enum(["MATCH","AMBIGUOUS","UNKNOWN"]),enrollment:z.enum(["ACTIVE","INACTIVE","UNKNOWN"]),monthlyIncomeMinor:MoneyMinorSchema.nullable(),recordedBy:IdSchema,recordedAt:TimestampSchema});
export const ProgramInputsResponseSchema=ApiSuccessSchema(ApiCollectionSchema(SyntheticProgramInputSchema));
export type AssignCaseRequest=z.infer<typeof AssignCaseRequestSchema>;
export type SetPriorityRequest=z.infer<typeof SetPriorityRequestSchema>;
export type OfficerReasonRequest=z.infer<typeof OfficerReasonRequestSchema>;
export type CaseVersionRequest=z.infer<typeof CaseVersionRequestSchema>;
export type DispatchItem=z.infer<typeof DispatchItemSchema>;
export type OfficerQueueItem=z.infer<typeof OfficerQueueItemSchema>;
export type CaseDecision=z.infer<typeof CaseDecisionSchema>;
export type AuditMetadata=z.infer<typeof AuditMetadataSchema>;
export type SyntheticProgramInput=z.infer<typeof SyntheticProgramInputSchema>;
