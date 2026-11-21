import "server-only";
import { AssessmentSchema, EvidencePassportSchema, type FindingReasonCode, type SourceReference } from "@/contracts/v1";
import { AuthFailure } from "@/backend/auth/principal";
import type { Transaction } from "@/backend/authorization/transaction";
import { draftSnapshot } from "./drafts";
import { evidenceRecord } from "./evidence";

// Owner-approved opaque unavailable basis. This is not a published eligibility policy.
export const UNAVAILABLE_RULE_BASIS_ID = "b3000000-0000-4000-8000-000000000001";

export async function assessmentRecord(tx: Transaction, caseId: string, assessmentId: string | null) {
  const { rows: [row] } = await tx.db.query("select record from public.assessments where case_id=$1 and ($2::uuid is null or id=$2) order by assessed_at desc,id desc limit 1", [caseId, assessmentId]);
  if (!row) throw new AuthFailure("NOT_FOUND");
  return AssessmentSchema.parse(row.record);
}

export async function passportRecord(tx: Transaction, caseId: string, assessmentId: string | null) {
  const assessment = await assessmentRecord(tx, caseId, assessmentId);
  const { rows: [record] } = await tx.db.query("select status from public.cases where id=$1", [caseId]);
  return EvidencePassportSchema.parse({ caseId, assessmentId: assessment.id, assessedAt: assessment.assessedAt,
    evidenceVersion: assessment.evidenceVersion, ruleVersionId: assessment.ruleVersionId, ...assessment.findings,
    contradictions: assessment.contradictions, missingEvidence: assessment.missingEvidence, ai: assessment.ai, caseStatus: record?.status ?? null });
}

/** No provider substitutes or client findings: absent adapters remain explicitly unknown. */
export async function createAssessment(tx: Transaction, caseId: string, expectedEvidenceVersion: number, aiAuthorized: boolean) {
  const { rows: [basis] } = await tx.db.query("select availability from public.assessment_rule_bases where id=$1", [UNAVAILABLE_RULE_BASIS_ID]);
  if (basis?.availability !== "UNAVAILABLE") throw new AuthFailure("SERVICE_UNAVAILABLE");
  const snapshot = await draftSnapshot(tx, caseId);
  const { rows: [record] } = await tx.db.query("select evidence_version from public.cases where id=$1", [caseId]);
  const evidenceVersion = Number(record?.evidence_version ?? snapshot.evidenceVersion);
  if (evidenceVersion !== expectedEvidenceVersion) throw new AuthFailure("STALE_ASSESSMENT");
  const { rows: [clock] } = await tx.db.query(`select to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as time`);
  const assessedAt = String(clock.time);
  const { rows: evidence } = await tx.db.query(`select e.id from public.evidence_items e where e.case_id=$1 and
    (e.id=$2::uuid or e.id=$3::uuid or exists(select 1 from public.case_events v where v.case_id=$1 and v.evidence_id=e.id and v.action='EVIDENCE_ADDED'))
    order by e.evidence_version,e.created_at,e.id`, [caseId, snapshot.noticeEvidenceId, snapshot.statementEvidenceId]);
  const evidenceRefs = evidence.map((row) => String(row.id));
  let hasToken = false;
  for (const id of evidenceRefs) {
    const item = await evidenceRecord(tx, caseId, id);
    if (item.kind === "NOTICE_INPUT" && "noticeToken" in item.content && item.content.noticeToken !== null) hasToken = true;
  }
  const source = (service: string): SourceReference => ({ service, recordRef: null, sourceVersion: null, observedAt: assessedAt });
  const finding = <T extends string>(result: T, service: string, reasonCodes: FindingReasonCode[] = ["SOURCE_UNAVAILABLE"]) => ({ result, reasonCodes, sourceRefs: [source(service)], observedAt: assessedAt });
  const findings = {
    signature: finding("NOT_VERIFIED", "trusted_issuer_registry", [hasToken ? "REGISTRY_UNAVAILABLE" : "TOKEN_MISSING"]),
    expiry: finding("UNKNOWN", "crypto_notice"), revocation: finding("UNKNOWN", "notice_revocations"),
    recipientMatch: finding("UNKNOWN", "mock_identity"), payment: finding("UNKNOWN", "mock_payment"), eligibility: finding("UNKNOWN", "mock_program_data"),
  };
  const ai = { status: aiAuthorized ? "UNAVAILABLE" : "NOT_AUTHORIZED", runId: null, modelVersion: null, promptVersion: null,
    outputSchemaVersion: null, confidence: null, classification: null, recommendedRoute: null, explanationRefs: [], failureCode: aiAuthorized ? "provider_not_configured" : null };
  const assessment = AssessmentSchema.parse({ id: crypto.randomUUID(), caseId, assessedAt, evidenceVersion,
    ruleVersionId: UNAVAILABLE_RULE_BASIS_ID, evidenceRefs, findings, sourceVersions: [
      ...Object.values(findings).flatMap((item) => item.sourceRefs),
      { service: "rule_basis", recordRef: UNAVAILABLE_RULE_BASIS_ID, sourceVersion: 1, observedAt: assessedAt },
    ], contradictions: [], missingEvidence: ["crypto_verification", "identity_source", "payment_source", "program_source", "rule_basis_unavailable", "contradiction_checks_unavailable", ...(!hasToken ? ["notice_token"] : [])], ai, aiRunIds: [] });
  await tx.db.query("insert into public.assessments(id,case_id,evidence_version,rule_version_id,assessed_at,record) values($1,$2,$3,$4,$5,$6)",
    [assessment.id, caseId, evidenceVersion, assessment.ruleVersionId, assessedAt, assessment]);
  for (const id of evidenceRefs) await tx.db.query("insert into public.assessment_evidence values($1,$2,$3)", [assessment.id, caseId, id]);
  for (const [ordinal, ref] of assessment.sourceVersions.entries()) await tx.db.query("insert into public.assessment_sources values($1,$2,$3,$4,$5,$6)",
    [assessment.id, ordinal, ref.service, ref.recordRef, ref.sourceVersion, ref.observedAt]);
  await tx.db.query("insert into public.case_events(case_id,actor_id,action,evidence_version,assessment_id) values($1,$2,'ASSESSMENT_CREATED',$3,$4)",
    [caseId, tx.identity.principal.id, evidenceVersion, assessment.id]);
  return { assessmentId: assessment.id };
}
