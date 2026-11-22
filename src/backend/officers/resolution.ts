import "server-only";
import type { Assessment, ResolveCaseRequest } from "@/contracts/v1";
import { AuthFailure } from "@/backend/auth/principal";
import { audit, type Transaction } from "@/backend/authorization/transaction";
import { assessmentRecord, createAssessment } from "@/backend/cases/assessments";
import { currentRule } from "@/backend/rules/service";
import { caseRecord } from "@/backend/cases/http";
import { recordDecision } from "./workflow";

// Observations get new timestamps; only source identities/versions and deterministic facts compare.
function deterministicBasis(assessment: Assessment) {
  return JSON.stringify({ evidenceRefs: assessment.evidenceRefs, sourceVersions: assessment.sourceVersions.map(({service,recordRef,sourceVersion}) => ({service,recordRef,sourceVersion})),
    findings: Object.entries(assessment.findings).map(([name,finding]) => ({name,result:finding.result,reasonCodes:finding.reasonCodes})),
    contradictions: assessment.contradictions.map(({fields,sourceRefs}) => ({fields,sourceRefs:sourceRefs.map(({service,recordRef,sourceVersion}) => ({service,recordRef,sourceVersion}))})),
    missingEvidence:assessment.missingEvidence });
}

/** Caller holds reservation and case locks, and the complete officer permission path. */
export async function resolveCase(tx: Transaction, previous: Record<string,unknown>, input: ResolveCaseRequest) {
  if (previous.status !== "UNDER_REVIEW") throw new AuthFailure("INVALID_TRANSITION");
  const caseId=String(previous.id);
  const rule=await currentRule(tx);
  if (!rule) throw new AuthFailure("STALE_ASSESSMENT");
  const reviewed=await assessmentRecord(tx,caseId,input.reviewedAssessmentId);
  if (reviewed.ruleVersionId !== rule.id || reviewed.evidenceVersion !== previous.evidence_version) throw new AuthFailure("STALE_ASSESSMENT");
  const saved=await createAssessment(tx,caseId,Number(previous.evidence_version));
  const final=await assessmentRecord(tx,caseId,saved.assessmentId);
  if (deterministicBasis(reviewed) !== deterministicBasis(final)) throw new AuthFailure("STALE_ASSESSMENT");
  await tx.db.query("update public.cases set status='RESOLVED' where id=$1",[caseId]);
  const resolutionId=await recordDecision(tx,previous,"CASE_RESOLVED",input.reason,{assessmentId:final.id,reviewedAssessmentId:reviewed.id,ruleVersionId:rule.id});
  await audit(tx,"ASSESSMENT_CREATED","ALLOWED",caseId,final.id);
  return {case:await caseRecord(tx,caseId),assessmentId:final.id,resolutionId};
}
