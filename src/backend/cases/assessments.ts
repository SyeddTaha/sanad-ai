import "server-only";
import { AssessmentSchema, EvidencePassportSchema, type AiAssessmentMetadata, type Assessment, type EvidenceFindings, type FindingReasonCode, type SourceReference } from "@/contracts/v1";
import { AuthFailure } from "@/backend/auth/principal";
import type { Transaction } from "@/backend/authorization/transaction";
import { draftSnapshot } from "./drafts";
import { evidenceRecord } from "./evidence";
import { currentRule } from "@/backend/rules/service";
import { evaluateEligibility,programInput } from "@/backend/rules/eligibility";
import { registrySnapshot } from "@/backend/notices/database-registry";
import { mergeNoticeFindings, verifyNoticeForCase } from "@/backend/adapters/assessment-adapters";

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

/** Capture immutable input references and versioned sources while authorized. No provider work. */
export async function captureAssessment(tx: Transaction, caseId: string, expectedEvidenceVersion: number) {
  const rule = await currentRule(tx);
  const program = await programInput(tx,caseId);
  const { rows: [basis] } = await tx.db.query("select availability from public.assessment_rule_bases where id=$1", [UNAVAILABLE_RULE_BASIS_ID]);
  if (basis?.availability !== "UNAVAILABLE") throw new AuthFailure("SERVICE_UNAVAILABLE");
  const snapshot = await draftSnapshot(tx, caseId);
  const { rows: [record] } = await tx.db.query("select version,evidence_version from public.cases where id=$1", [caseId]);
  const evidenceVersion = Number(record?.evidence_version ?? snapshot.evidenceVersion);
  if (evidenceVersion !== expectedEvidenceVersion) throw new AuthFailure("STALE_ASSESSMENT");
  const { rows: [clock] } = await tx.db.query(`select to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as time`);
  const assessedAt = String(clock.time);
  const { rows: evidence } = await tx.db.query(`select e.id from public.evidence_items e where e.case_id=$1 and
    (e.id=$2::uuid or e.id=$3::uuid or exists(select 1 from public.case_events v where v.case_id=$1 and v.evidence_id=e.id and v.action='EVIDENCE_ADDED'))
    order by e.evidence_version,e.created_at,e.id`, [caseId, snapshot.noticeEvidenceId, snapshot.statementEvidenceId]);
  const evidenceRefs = evidence.map((row) => String(row.id));
  const items = [];
  for (const id of evidenceRefs) items.push(await evidenceRecord(tx, caseId, id));
  const registry = await registrySnapshot(tx);
  const fingerprint = JSON.stringify({ draftVersion: snapshot.version, caseVersion: record?.version ?? null, evidenceVersion,
    evidenceRefs, ruleId: rule?.id ?? null, programId: program?.id ?? null, registry: registry.fingerprint });
  return { caseId, rule, program, assessedAt, evidenceVersion, evidenceRefs, items, registry: registry.registry, fingerprint };
}
export type AssessmentSnapshot = Awaited<ReturnType<typeof captureAssessment>>;

export const notAuthorizedAi = { status: "NOT_AUTHORIZED", runId: null, modelVersion: null, promptVersion: null,
  outputSchemaVersion: null, confidence: null, classification: null, recommendedRoute: null, explanationRefs: [], failureCode: null } satisfies AiAssessmentMetadata;

/** Local cryptography only; registry data was loaded from server-controlled SQL, never the notice. */
export async function composeAssessment(snapshot: AssessmentSnapshot, ai: AiAssessmentMetadata = notAuthorizedAi): Promise<Assessment> {
  const { caseId, rule, program, assessedAt, evidenceVersion, evidenceRefs } = snapshot;
  const tokens = [...new Set(snapshot.items.flatMap((item) => "noticeToken" in item.content && item.content.noticeToken ? [item.content.noticeToken] : []))];
  const hasToken = tokens.length > 0;
  const source = (service: string): SourceReference => service === "mock_program_data" && program
    ? {service,recordRef:program.id,sourceVersion:program.version,observedAt:assessedAt}
    : {service,recordRef:null,sourceVersion:null,observedAt:assessedAt};
  const finding = <T extends string>(result: T, service: string, reasonCodes: FindingReasonCode[] = ["SOURCE_UNAVAILABLE"]) => ({ result, reasonCodes, sourceRefs: [source(service)], observedAt: assessedAt });
  let findings: EvidenceFindings = {
    signature: finding("NOT_VERIFIED", "trusted_issuer_registry", [hasToken ? "REGISTRY_UNAVAILABLE" : "TOKEN_MISSING"]),
    expiry: finding("UNKNOWN", "crypto_notice"), revocation: finding("UNKNOWN", "notice_revocations"),
    recipientMatch: program ? finding(program.recipientMatch,"mock_program_data",program.recipientMatch==="AMBIGUOUS" ? ["RECIPIENT_AMBIGUOUS"] : program.recipientMatch==="UNKNOWN" ? ["SOURCE_UNAVAILABLE"] : []) : finding("UNKNOWN", "mock_identity"),
    payment: finding("UNKNOWN", "mock_payment"), eligibility: rule ? {...finding("UNKNOWN","mock_program_data"),...evaluateEligibility(program,rule.parameters)} : finding("UNKNOWN", "mock_program_data"),
  };
  const notice = tokens.length === 1 ? await verifyNoticeForCase(tokens[0], snapshot.registry, Math.floor(Date.parse(assessedAt) / 1000)) : null;
  if (notice) findings = mergeNoticeFindings(findings, notice.findings);
  if (tokens.length > 1) findings.signature.reasonCodes = ["DETAILS_MISMATCH"];
  return AssessmentSchema.parse({ id: crypto.randomUUID(), caseId, assessedAt, evidenceVersion,
    ruleVersionId: rule?.id ?? UNAVAILABLE_RULE_BASIS_ID, evidenceRefs, findings, sourceVersions: [
      ...Object.values(findings).flatMap((item) => item.sourceRefs),
      ...(notice?.issuer.sourceRefs ?? []),
      { service: rule ? "published_rule" : "rule_basis", recordRef: rule?.id ?? UNAVAILABLE_RULE_BASIS_ID, sourceVersion: rule?.version ?? 1, observedAt: assessedAt },
    ], contradictions: [], missingEvidence: [...(!notice || notice.findings.signature.result === "NOT_VERIFIED" ? ["crypto_verification"] : []),
      ...(tokens.length > 1 ? ["multiple_notice_inputs"] : []), ...(!program || program.recipientMatch!=="MATCH" ? ["identity_source"] : []), "payment_source",
      ...(!program || program.enrollment==="UNKNOWN" || program.monthlyIncomeMinor===null ? ["program_source"] : []), ...(!rule ? ["rule_basis_unavailable"] : []), "contradiction_checks_unavailable", ...(!hasToken ? ["notice_token"] : [])], ai, aiRunIds: ai.runId ? [ai.runId] : [] });
}

export async function persistAssessment(tx: Transaction, assessment: Assessment) {
  const { caseId, evidenceVersion, assessedAt, evidenceRefs } = assessment;
  await tx.db.query("insert into public.assessments(id,case_id,evidence_version,rule_version_id,assessed_at,record) values($1,$2,$3,$4,$5,$6)",
    [assessment.id, caseId, evidenceVersion, assessment.ruleVersionId, assessedAt, assessment]);
  for (const id of evidenceRefs) await tx.db.query("insert into public.assessment_evidence values($1,$2,$3)", [assessment.id, caseId, id]);
  for (const [ordinal, ref] of assessment.sourceVersions.entries()) await tx.db.query("insert into public.assessment_sources values($1,$2,$3,$4,$5,$6)",
    [assessment.id, ordinal, ref.service, ref.recordRef, ref.sourceVersion, ref.observedAt]);
  await tx.db.query("insert into public.case_events(case_id,actor_id,action,evidence_version,assessment_id) values($1,$2,'ASSESSMENT_CREATED',$3,$4)",
    [caseId, tx.identity.principal.id, evidenceVersion, assessment.id]);
  return { assessmentId: assessment.id };
}

/** Resolution recomputes current deterministic facts inside its atomic transaction; no AI/network. */
export async function createAssessment(tx: Transaction, caseId: string, expectedEvidenceVersion: number) {
  return persistAssessment(tx, await composeAssessment(await captureAssessment(tx, caseId, expectedEvidenceVersion)));
}
