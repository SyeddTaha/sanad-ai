import "server-only";
import { AuthFailure } from "@/backend/auth/principal";
import type { Transaction } from "@/backend/authorization/transaction";
import { draftSnapshot, draftRecord, requireUnsubmitted } from "./drafts";

export async function submitCase(tx: Transaction, caseId: string, expectedDraftVersion: number) {
  await requireUnsubmitted(tx, caseId);
  const snapshot = await draftSnapshot(tx, caseId);
  if (snapshot.version !== expectedDraftVersion) throw new AuthFailure("STALE_VERSION");
  const input = await draftRecord(tx, snapshot);
  if (!input.noticeToken && !input.messageText?.trim() && !input.disputeText?.trim()) throw new AuthFailure("VALIDATION_FAILED");
  await tx.db.query(`insert into public.cases(id,citizen_id,status,evidence_version,related_case_id)
    values($1,$2,'PENDING_CONSENT',$3,$4)`, [caseId, snapshot.citizenId, snapshot.evidenceVersion, snapshot.relatedCaseId]);
  // The caller reconciles active department review sharing before returning the Case.
}
