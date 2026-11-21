import "server-only";
import { AuthFailure } from "@/backend/auth/principal";
import { CaseDraftSchema, type SaveDraftRequest } from "@/lib/case-contract";
import type { Transaction } from "@/backend/authorization/transaction";
import { evidenceRecord } from "./evidence";

export type DraftSnapshot = { caseId: string; citizenId: string; version: number; evidenceVersion: number;
  noticeEvidenceId: string | null; statementEvidenceId: string | null; relatedCaseId: string | null; createdAt: string; updatedAt: string };

export async function draftSnapshot(tx: Transaction, caseId: string): Promise<DraftSnapshot> {
  const { rows: [row] } = await tx.db.query(`select r.citizen_id,r.created_at as reserved_at,i.* from public.case_reservations r
    left join public.case_inputs i on i.case_id=r.id where r.id=$1`, [caseId]);
  if (!row) throw new AuthFailure("FORBIDDEN");
  const createdAt = new Date(row.reserved_at as string).toISOString();
  return { caseId, citizenId: String(row.citizen_id), version: Number(row.version ?? 1), evidenceVersion: Number(row.evidence_version ?? 1),
    noticeEvidenceId: row.notice_evidence_id as string ?? null, statementEvidenceId: row.statement_evidence_id as string ?? null,
    relatedCaseId: row.related_case_id as string ?? null, createdAt, updatedAt: row.updated_at ? new Date(row.updated_at as string).toISOString() : createdAt };
}

export async function draftRecord(tx: Transaction, snapshot: DraftSnapshot) {
  const notice = snapshot.noticeEvidenceId ? await evidenceRecord(tx, snapshot.caseId, snapshot.noticeEvidenceId) : null;
  const statement = snapshot.statementEvidenceId ? await evidenceRecord(tx, snapshot.caseId, snapshot.statementEvidenceId) : null;
  return CaseDraftSchema.parse({ caseId: snapshot.caseId, citizenId: snapshot.citizenId, version: snapshot.version,
    evidenceVersion: snapshot.evidenceVersion, relatedCaseId: snapshot.relatedCaseId, createdAt: snapshot.createdAt, updatedAt: snapshot.updatedAt,
    noticeToken: notice && "noticeToken" in notice.content ? notice.content.noticeToken : null,
    messageText: notice && "messageText" in notice.content ? notice.content.messageText : null,
    disputeText: statement && "text" in statement.content ? statement.content.text : null });
}

export async function requireUnsubmitted(tx: Transaction, caseId: string) {
  if ((await tx.db.query("select id from public.cases where id=$1", [caseId])).rows.length) throw new AuthFailure("INVALID_TRANSITION");
}

export async function saveDraft(tx: Transaction, caseId: string, input: SaveDraftRequest) {
  await requireUnsubmitted(tx, caseId);
  const previous = await draftSnapshot(tx, caseId);
  if (previous.version !== input.expectedVersion) throw new AuthFailure("STALE_VERSION");
  const old = await draftRecord(tx, previous);
  if (old.noticeToken === input.noticeToken && old.messageText === input.messageText && old.disputeText === input.disputeText && old.relatedCaseId === input.relatedCaseId) return previous;
  const nextVersion = previous.version + 1;
  const evidenceVersion = previous.evidenceVersion + 1;
  const insert = async (kind: string, content: unknown) => String((await tx.db.query(`insert into public.evidence_items(case_id,kind,content,actor_id,evidence_version)
    values($1,$2,$3,$4,$5) returning id`, [caseId, kind, content, tx.identity.principal.id, evidenceVersion])).rows[0].id);
  const noticeId = input.noticeToken !== null || input.messageText !== null ? await insert("NOTICE_INPUT", { noticeToken: input.noticeToken, messageText: input.messageText }) : null;
  const statementId = input.disputeText?.trim() ? await insert("CITIZEN_STATEMENT", { text: input.disputeText }) : null;
  await tx.db.query(`insert into public.case_inputs(case_id,version,evidence_version,notice_evidence_id,statement_evidence_id,related_case_id)
    values($1,$2,$3,$4,$5,$6) on conflict(case_id) do update set version=excluded.version,evidence_version=excluded.evidence_version,
    notice_evidence_id=excluded.notice_evidence_id,statement_evidence_id=excluded.statement_evidence_id,related_case_id=excluded.related_case_id,updated_at=clock_timestamp()`,
    [caseId, nextVersion, evidenceVersion, noticeId, statementId, input.relatedCaseId]);
  await tx.db.query("insert into public.case_events(case_id,actor_id,action,evidence_version) values($1,$2,'DRAFT_SAVED',$3)", [caseId, tx.identity.principal.id, evidenceVersion]);
  return draftSnapshot(tx, caseId);
}
