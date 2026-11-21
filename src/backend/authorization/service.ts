import "server-only";
import type { NextRequest } from "next/server";
import { ConsentGrantSchema, IdSchema } from "@/contracts/v1";
import { AuthFailure } from "@/backend/auth/principal";
import { authorize, type Permission, type PolicyContext } from "./policy";
import { audit, inAuthorizationTransaction, lockTarget, type Dependencies, type Transaction } from "./transaction";

export function consentRecord(row: Record<string, unknown>) {
  return ConsentGrantSchema.parse({ id: row.id, caseId: row.case_id, grantorCitizenId: row.grantor_citizen_id,
    recipientType: row.recipient_type, recipientId: row.recipient_id, purpose: row.purpose, actions: row.actions,
    expiresAt: new Date(row.expires_at as string).toISOString(), createdAt: new Date(row.created_at as string).toISOString(),
    revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at as string).toISOString(), version: row.version });
}
export async function loadAuthorization(tx: Transaction, caseId: string): Promise<PolicyContext> {
  const reservation = await lockTarget(tx, caseId);
  const { rows: [record] } = await tx.db.query("select assigned_officer_id,assigned_department_id from public.cases where id=$1", [caseId]);
  const { rows } = await tx.db.query("select *,to_json(actions) as actions from public.consent_grants where case_id=$1 order by id", [caseId]);
  const { rows: [clock] } = await tx.db.query("select clock_timestamp() as time");
  return { ...tx.identity, target: { caseId, citizenId: String(reservation.citizen_id), assignedOfficerId: record?.assigned_officer_id as string ?? null },
    assignedDepartmentId: record?.assigned_department_id as string ?? null,
    apiKeyScopes: null, grants: rows.map(consentRecord), evaluatedAt: new Date(clock.time as string).toISOString() };
}

/** Lazy expiry reconciliation; the reservation is already locked by loadAuthorization. */
export async function reconcileConsentStatus(tx: Transaction, caseId: string) {
  const { rows: [record] } = await tx.db.query(`select c.status,exists(
    select 1 from public.consent_grants g join public.departments d on d.id=g.recipient_id
    where g.case_id=c.id and g.grantor_citizen_id=c.citizen_id and g.recipient_type='DEPARTMENT'
      and g.purpose='synthetic_department_review' and g.revoked_at is null and g.expires_at>clock_timestamp()
      and g.actions @> array['READ_CASE','READ_EVIDENCE','REVIEW_CASE']::public.sanad_consent_action[]
      and (c.assigned_department_id is null or g.recipient_id=c.assigned_department_id)
    ) as active from public.cases c where c.id=$1`, [caseId]);
  if (!record || ["RESOLVED", "CLOSED"].includes(String(record.status))) return;
  const status = record.active ? (record.status === "PENDING_CONSENT" ? "SUBMITTED" : record.status) : "PENDING_CONSENT";
  if (status === record.status) return;
  await tx.db.query("update public.cases set status=$2 where id=$1", [caseId, status]);
  await audit(tx, status === "PENDING_CONSENT" ? "CONSENT_INTERRUPTED" : "CONSENT_RESTORED", "ALLOWED", caseId);
}

/** Use for reads, writes and cached-result retrieval. Never reuse an earlier decision.
 * Callback runs under the reservation lock; all protected SQL must use tx.db.
 */
export async function withAuthorizedCase<T>(request: NextRequest, permission: Permission & { caseId: string },
  work: (tx: Transaction, context: PolicyContext) => Promise<T>, dependencies: Dependencies = {}): Promise<T> {
  const result = await inAuthorizationTransaction(request, crypto.randomUUID(), permission.action, async (tx) => {
    if (!IdSchema.safeParse(permission.caseId).success) throw new AuthFailure("VALIDATION_FAILED");
    const context = await loadAuthorization(tx, permission.caseId);
    const decision = authorize(context, permission);
    if (decision.allowed || (context.principal.roles.includes("OFFICER") && context.target.assignedOfficerId === context.principal.id &&
      context.assignedDepartmentId && context.departmentIds.includes(context.assignedDepartmentId))) await reconcileConsentStatus(tx, permission.caseId);
    await audit(tx, permission.action, decision.allowed ? "ALLOWED" : "DENIED", decision.allowed ? permission.caseId : undefined, decision.authorizationRef);
    if (!decision.allowed) return { allowed: false as const, code: decision.code };
    const value = await work(tx, context);
    // Time passes even under a lock. Do not commit a write or return data after grant expiry.
    const fresh = await loadAuthorization(tx, permission.caseId);
    if (!authorize(fresh, permission).allowed) throw new AuthFailure("CONSENT_REQUIRED");
    return { allowed: true as const, value };
  }, dependencies);
  if (!result.allowed) throw new AuthFailure(result.code ?? "FORBIDDEN");
  return result.value;
}
