import "server-only";
import { AuthFailure } from "@/backend/auth/principal";
import type { Transaction } from "@/backend/authorization/transaction";
import { EvidenceItemSchema, type AddEvidenceRequest } from "@/lib/case-contract";

export async function evidenceRecord(tx: Transaction, caseId: string, evidenceId: string) {
  const { rows: [row] } = await tx.db.query("select * from public.evidence_items where id=$1 and case_id=$2", [evidenceId, caseId]);
  if (!row) throw new AuthFailure("NOT_FOUND");
  return EvidenceItemSchema.parse({ id: row.id, caseId: row.case_id, kind: row.kind, content: row.content, supersedesId: row.supersedes_id,
    actorId: row.actor_id, evidenceVersion: row.evidence_version, createdAt: new Date(row.created_at as string).toISOString() });
}

export async function addEvidence(tx: Transaction, caseId: string, input: AddEvidenceRequest) {
  const { rows: [record] } = await tx.db.query("select status,version,evidence_version from public.cases where id=$1", [caseId]);
  if (!record) throw new AuthFailure("NOT_FOUND");
  if (record.version !== input.expectedVersion) throw new AuthFailure("STALE_VERSION");
  if (["RESOLVED", "CLOSED"].includes(String(record.status))) throw new AuthFailure("INVALID_TRANSITION");
  if (input.supersedesId) {
    const { rows } = await tx.db.query("select id from public.evidence_items where id=$1 and case_id=$2", [input.supersedesId, caseId]);
    if (!rows.length) throw new AuthFailure("VALIDATION_FAILED");
  }
  const { rows: [changed] } = await tx.db.query("update public.cases set evidence_version=evidence_version+1 where id=$1 returning version,evidence_version", [caseId]);
  const { rows: [evidence] } = await tx.db.query(`insert into public.evidence_items(case_id,kind,content,supersedes_id,actor_id,evidence_version)
    values($1,$2,$3,$4,$5,$6) returning id`, [caseId, input.kind, input.content, input.supersedesId, tx.identity.principal.id, changed.evidence_version]);
  await tx.db.query(`insert into public.case_events(case_id,actor_id,action,case_version,evidence_version,evidence_id)
    values($1,$2,'EVIDENCE_ADDED',$3,$4,$5)`, [caseId, tx.identity.principal.id, changed.version, changed.evidence_version, evidence.id]);
  return { evidenceId: String(evidence.id), caseVersion: Number(changed.version), evidenceVersion: Number(changed.evidence_version) };
}
