import { z } from "zod";
import { ApiSuccessSchema, RuleParametersSchema, RuleVersionSchema, VersionSchema } from "@/contracts/v1";

export const SYNTHETIC_PROGRAM_REF = "program_demo";
export const SYNTHETIC_POLICY_LABEL = "SANAD Synthetic Relief Demo";
export const PublishRuleRequestSchema = z.strictObject({ programRef: z.literal(SYNTHETIC_PROGRAM_REF),
  expectedCurrentVersion: VersionSchema.nullable(), parameters: RuleParametersSchema });
export const PublishedRuleSchema = z.strictObject({ programRef: z.literal(SYNTHETIC_PROGRAM_REF),
  policyLabel: z.literal(SYNTHETIC_POLICY_LABEL), rule: RuleVersionSchema });
export const RuleResponseSchema = ApiSuccessSchema(PublishedRuleSchema);
export type PublishRuleRequest=z.infer<typeof PublishRuleRequestSchema>;
export type PublishedRule=z.infer<typeof PublishedRuleSchema>;
