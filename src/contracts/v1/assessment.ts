import { z } from "zod";
import { CasePrioritySchema, CaseStatusSchema } from "./case";
import { AiAssessmentMetadataSchema } from "./ai-metadata";
import { EvidenceFindingsSchema, SourceReferenceSchema } from "./evidence";
import { ConfidenceSchema, IdSchema, MoneyMinorSchema, ReferenceSchema, TimestampSchema, VersionSchema } from "./scalars";

export const RuleParametersSchema = z.strictObject({
  maxMonthlyIncomeMinor: MoneyMinorSchema,
  minRoutingConfidence: ConfidenceSchema,
  integrityFailurePriority: CasePrioritySchema,
});
export const RuleVersionSchema = z.strictObject({
  id: IdSchema,
  version: VersionSchema,
  parameters: RuleParametersSchema,
  publishedAt: TimestampSchema,
  publishedBy: IdSchema,
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
});

export type RuleParameters = z.infer<typeof RuleParametersSchema>;
export type RuleVersion = z.infer<typeof RuleVersionSchema>;

export const EvidenceContradictionSchema = z.strictObject({
  fields: z.array(ReferenceSchema).min(1),
  sourceRefs: z.array(SourceReferenceSchema),
});

const assessmentBasis = {
  caseId: IdSchema,
  assessedAt: TimestampSchema,
  evidenceVersion: VersionSchema,
  ruleVersionId: IdSchema,
  contradictions: z.array(EvidenceContradictionSchema),
  missingEvidence: z.array(ReferenceSchema),
  ai: AiAssessmentMetadataSchema,
};

/** Append-only record shape. Persistence must enforce immutable history. */
export const AssessmentSchema = z.strictObject({
  id: IdSchema,
  ...assessmentBasis,
  sourceVersions: z.array(SourceReferenceSchema),
  evidenceRefs: z.array(IdSchema),
  findings: EvidenceFindingsSchema,
  aiRunIds: z.array(IdSchema),
});

export const EvidencePassportSchema = z.strictObject({
  ...assessmentBasis,
  assessmentId: IdSchema,
  ...EvidenceFindingsSchema.shape,
  caseStatus: CaseStatusSchema.nullable(),
});

export type EvidenceContradiction = z.infer<typeof EvidenceContradictionSchema>;
export type Assessment = z.infer<typeof AssessmentSchema>;
export type EvidencePassport = z.infer<typeof EvidencePassportSchema>;
