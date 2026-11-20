import { z } from "zod";
import { IdSchema, TimestampSchema, VersionSchema } from "./scalars";

export const CaseStatusSchema = z.enum([
  "SUBMITTED", "UNDER_REVIEW", "NEEDS_EVIDENCE", "PENDING_CONSENT", "RESOLVED", "CLOSED",
]);
export const CasePrioritySchema = z.enum(["NORMAL", "HIGH"]);
export type CasePriority = z.infer<typeof CasePrioritySchema>;

export const CaseSchema = z.strictObject({
  id: IdSchema,
  citizenId: IdSchema,
  status: CaseStatusSchema,
  version: VersionSchema,
  evidenceVersion: VersionSchema,
  relatedCaseId: IdSchema.nullable(),
  assignedOfficerId: IdSchema.nullable(),
  priority: CasePrioritySchema,
  createdAt: TimestampSchema,
  submittedAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type Case = z.infer<typeof CaseSchema>;

/** Workflow shape only: valid shapes still need authorization and atomic checks. */
export const CaseTransitionSchema = z.union([
  z.strictObject({ from: z.null(), to: z.enum(["SUBMITTED", "PENDING_CONSENT"]) }),
  z.strictObject({ from: z.literal("SUBMITTED"), to: z.enum(["UNDER_REVIEW", "PENDING_CONSENT"]) }),
  z.strictObject({ from: z.literal("UNDER_REVIEW"), to: z.enum(["NEEDS_EVIDENCE", "RESOLVED", "PENDING_CONSENT"]) }),
  z.strictObject({ from: z.literal("NEEDS_EVIDENCE"), to: z.enum(["SUBMITTED", "PENDING_CONSENT"]) }),
  z.strictObject({ from: z.literal("PENDING_CONSENT"), to: z.literal("SUBMITTED") }),
  z.strictObject({ from: z.literal("RESOLVED"), to: z.literal("CLOSED") }),
]);

export type CaseStatus = z.infer<typeof CaseStatusSchema>;
export type CaseTransition = z.infer<typeof CaseTransitionSchema>;

export const ResolveCaseRequestSchema = z.strictObject({
  expectedVersion: VersionSchema,
  reviewedAssessmentId: IdSchema,
  reason: z.string().min(1).max(2000).refine((reason) => reason.trim().length > 0, "Reason required"),
});
export type ResolveCaseRequest = z.infer<typeof ResolveCaseRequestSchema>;
