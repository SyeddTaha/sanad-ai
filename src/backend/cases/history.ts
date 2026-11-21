import "server-only";
import { IdSchema } from "@/contracts/v1";
import { AuthFailure } from "@/backend/auth/principal";
import type { Transaction } from "@/backend/authorization/transaction";

export async function caseHistory(tx: Transaction, caseId: string, params: URLSearchParams) {
  const cursor = params.get("cursor");
  const limitText = params.get("limit") ?? "20";
  if (!/^[1-9][0-9]?$|^100$/.test(limitText) || (cursor !== null && !IdSchema.safeParse(cursor).success)) throw new AuthFailure("VALIDATION_FAILED");
  const limit = Number(limitText);
  // Reuse B02's minimal events; do not copy its grants or any private evidence into history.
  const { rows } = await tx.db.query(`with history as (
    select id,case_id,actor_id,action,case_version,evidence_version,evidence_id,assessment_id,created_at from public.case_events where case_id=$1
    union all
    select id,target_id,actor_id,action,null::integer,null::integer,null::uuid,null::uuid,created_at from public.audit_events
      where target_id=$1 and outcome='ALLOWED' and action in ('CASE_RESERVED','CONSENT_GRANTED','CONSENT_WITHDRAWN','CONSENT_INTERRUPTED','CONSENT_RESTORED')
  ) select * from history where $2::uuid is null or (created_at,id) > (select created_at,id from history where id=$2)
    order by created_at,id limit $3`, [caseId, cursor, limit + 1]);
  if (cursor && !rows.length) {
    // An absent/end cursor returns an empty page without disclosing foreign history.
    return { items: [], nextCursor: null };
  }
  const items = rows.slice(0, limit).map((row) => ({ id: row.id, caseId: row.case_id, actorId: row.actor_id, action: row.action,
    caseVersion: row.case_version, evidenceVersion: row.evidence_version, evidenceId: row.evidence_id, assessmentId: row.assessment_id,
    createdAt: new Date(row.created_at as string).toISOString() }));
  return { items, nextCursor: rows.length > limit ? String(items.at(-1)!.id) : null };
}
