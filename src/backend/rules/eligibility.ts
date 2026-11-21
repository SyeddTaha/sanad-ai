import "server-only";
import { z } from "zod";
import { MoneyMinorSchema, type FindingReasonCode, type RuleParameters } from "@/contracts/v1";
import type { Transaction } from "@/backend/authorization/transaction";

const ProgramInputSchema=z.strictObject({id:z.uuid(),version:z.number().int().positive(),recipientMatch:z.enum(["MATCH","AMBIGUOUS","UNKNOWN"]),
  enrollment:z.enum(["ACTIVE","INACTIVE","UNKNOWN"]),monthlyIncomeMinor:MoneyMinorSchema.nullable()});
export async function programInput(tx:Transaction,caseId:string) {
  // The same reservation lock serializes this read with append/version changes.
  const {rows:[row]}=await tx.db.query("select * from public.synthetic_program_inputs where case_id=$1 order by version desc limit 1",[caseId]);
  if (!row) return null;
  return ProgramInputSchema.parse({id:row.id,version:row.version,recipientMatch:row.recipient_match,enrollment:row.enrollment,
    monthlyIncomeMinor:row.monthly_income_minor===null ? null : Number(row.monthly_income_minor)});
}
export function evaluateEligibility(input:Awaited<ReturnType<typeof programInput>>,parameters:RuleParameters) {
  const unknown={result:"UNKNOWN" as const,reasonCodes:["ELIGIBILITY_INPUT_MISSING"] as FindingReasonCode[]};
  if (!input || input.recipientMatch!=="MATCH" || input.enrollment==="UNKNOWN" || input.monthlyIncomeMinor===null) return unknown;
  if (input.monthlyIncomeMinor>parameters.maxMonthlyIncomeMinor) return {result:"INELIGIBLE" as const,reasonCodes:["RULE_THRESHOLD_EXCEEDED"] as FindingReasonCode[]};
  return {result:input.enrollment==="ACTIVE" ? "ELIGIBLE" as const : "INELIGIBLE" as const,reasonCodes:[] as FindingReasonCode[]};
}
