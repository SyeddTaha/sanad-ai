import "server-only";
import type { NextRequest } from "next/server";
import { ConsentGrantSchema, IdSchema, type ConsentAction } from "@/contracts/v1";
import { AuthFailure } from "@/backend/auth/principal";
import { authorize, type Decision, type Permission, type PolicyContext } from "./policy";
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
type CasePermission = Permission & { caseId: string | (() => string); alternativePurposes?: readonly string[]; additionalActions?: ConsentAction[] };
type RequestOptions = { requestId?: string; auditAction?: string; prepare?: () => Promise<void>; recheck?: (context: PolicyContext) => void };
function completeDecision(context: PolicyContext, permission: CasePermission): Decision {
  const purposes = [permission.purpose, ...permission.alternativePurposes ?? []];
  let denial: Decision | undefined;
  for (const purpose of purposes) {
    const decisions = [permission.action, ...permission.additionalActions ?? []].map((action) => authorize(context, { ...permission, action, purpose }));
    if (decisions.every((decision) => decision.allowed)) return decisions[0];
    denial ??= decisions.find((decision) => !decision.allowed);
  }
  return denial ?? { allowed: false, code: "CONSENT_REQUIRED" };
}
export async function withAuthorizedCase<T>(request: NextRequest, permission: CasePermission,
  work: (tx: Transaction, context: PolicyContext) => Promise<T>, dependencies: Dependencies = {}, options: RequestOptions = {}): Promise<T> {
  const event = options.auditAction ?? permission.action;
  const result = await inAuthorizationTransaction(request, options.requestId ?? crypto.randomUUID(), event, async (tx) => {
    const caseId = typeof permission.caseId === "function" ? permission.caseId() : permission.caseId;
    if (!IdSchema.safeParse(caseId).success) throw new AuthFailure("VALIDATION_FAILED");
    const context = await loadAuthorization(tx, caseId).catch((error: unknown) => {
      // A nonexistent and an inaccessible owner-bound target have identical denial.
      if (error instanceof AuthFailure && error.code === "FORBIDDEN") throw new AuthFailure("CONSENT_REQUIRED");
      throw error;
    });
    const decision = completeDecision(context, permission);
    if (decision.allowed || (context.principal.roles.includes("OFFICER") && context.target.assignedOfficerId === context.principal.id &&
      context.assignedDepartmentId && context.departmentIds.includes(context.assignedDepartmentId))) await reconcileConsentStatus(tx, caseId);
    if (!decision.allowed) {
      await audit(tx, event, "DENIED");
      return { allowed: false as const, code: decision.code };
    }
    const value = await work(tx, context);
    await audit(tx, event, "ALLOWED", caseId, decision.authorizationRef);
    // Time passes even under a lock. Do not commit a write or return data after grant expiry.
    const fresh = await loadAuthorization(tx, caseId);
    if (!completeDecision(fresh, permission).allowed) throw new AuthFailure("CONSENT_REQUIRED");
    options.recheck?.(fresh);
    return { allowed: true as const, value };
  }, dependencies, options.prepare);
  if (!result.allowed) throw new AuthFailure(result.code ?? "FORBIDDEN");
  return result.value;
}
