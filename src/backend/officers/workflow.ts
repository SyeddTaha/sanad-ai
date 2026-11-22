import "server-only";
import { AuthFailure } from "@/backend/auth/principal";
import type { Transaction } from "@/backend/authorization/transaction";

export async function lockedCase(tx: Transaction, caseId: string, expectedVersion: number) {
  const { rows: [record] } = await tx.db.query("select * from public.cases where id=$1 for update", [caseId]);
  if (!record) throw new AuthFailure("NOT_FOUND");
  if (record.version !== expectedVersion) throw new AuthFailure("STALE_VERSION");
  return record;
}

export async function recordDecision(tx: Transaction, previous: Record<string, unknown>, action: string, reason: string | null,
  basis?: { assessmentId: string; reviewedAssessmentId: string; ruleVersionId: string }) {
  const { rows: [record] } = await tx.db.query("select * from public.cases where id=$1", [previous.id]);
  const { rows: [decision] } = await tx.db.query(`insert into public.case_decisions(case_id,actor_id,action,reason,
    previous_officer_id,officer_id,previous_department_id,department_id,previous_status,status,case_version,evidence_version,assessment_id,reviewed_assessment_id,rule_version_id)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`, [record.id, tx.identity.principal.id, action, reason,
    previous.assigned_officer_id,record.assigned_officer_id,previous.assigned_department_id,record.assigned_department_id,
    previous.status,record.status,record.version,record.evidence_version,basis?.assessmentId ?? null,basis?.reviewedAssessmentId ?? null,basis?.ruleVersionId ?? null]);
  await tx.db.query(`insert into public.case_events(case_id,actor_id,action,case_version,evidence_version,assessment_id)
    values($1,$2,$3,$4,$5,$6)`, [record.id,tx.identity.principal.id,action,record.version,record.evidence_version,basis?.assessmentId ?? null]);
  return String(decision.id);
}
