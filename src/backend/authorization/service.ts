import "server-only";
import type { NextRequest } from "next/server";
import { ConsentGrantSchema, IdSchema, type ConsentAction } from "@/contracts/v1";
import { AuthFailure } from "@/backend/auth/principal";
import { authorize, type Decision, type Permission, type PolicyContext } from "./policy";
import { audit, inAuthorizationTransaction, lockTargets, type Dependencies, type Transaction } from "./transaction";

export function consentRecord(row: Record<string, unknown>) {
  return ConsentGrantSchema.parse({ id: row.id, caseId: row.case_id, grantorCitizenId: row.grantor_citizen_id,
    recipientType: row.recipient_type, recipientId: row.recipient_id, purpose: row.purpose, actions: row.actions,
    expiresAt: new Date(row.expires_at as string).toISOString(), createdAt: new Date(row.created_at as string).toISOString(),
    revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at as string).toISOString(), version: row.version });
}
export async function loadAuthorization(tx: Transaction, caseId: string): Promise<PolicyContext> {
  const [snapshot]=await loadCaseAuthorizations(tx,[caseId]);
  if (!snapshot) throw new AuthFailure("FORBIDDEN");
  return snapshot.context;
}

/** One bounded batch, with the same locks and policy inputs as individual requests. */
export async function loadCaseAuthorizations(tx:Transaction,caseIds:string[]) {
  const reservations=await lockTargets(tx,caseIds);
  const {rows:cases}=await tx.db.query("select * from public.cases where id=any($1::uuid[])",[caseIds]);
  const {rows}=await tx.db.query("select *,to_json(actions) as actions from public.consent_grants where case_id=any($1::uuid[]) order by id",[caseIds]);
  const { rows: [clock] } = await tx.db.query("select clock_timestamp() as time");
  const records=new Map(cases.map(record=>[String(record.id),record]));
  const grants=rows.map(consentRecord);
  return reservations.map(reservation=>{
    const caseId=String(reservation.id);
    const record=records.get(caseId);
    const context:PolicyContext={...tx.identity,target:{caseId,citizenId:String(reservation.citizen_id),assignedOfficerId:record?.assigned_officer_id as string ?? null},
      assignedDepartmentId:record?.assigned_department_id as string ?? null,apiKeyScopes:null,
      grants:grants.filter(grant=>grant.caseId===caseId),evaluatedAt:new Date(clock.time as string).toISOString()};
    return {context,record};
  });
}

/** Lazy expiry reconciliation; the reservation is already locked by loadAuthorization. */
export function hasDepartmentSharing(context:PolicyContext) {
  return context.grants.some((grant)=>grant.caseId===context.target.caseId && grant.grantorCitizenId===context.target.citizenId &&
    grant.recipientType==="DEPARTMENT" && grant.purpose==="synthetic_department_review" && grant.revokedAt===null &&
    Date.parse(grant.createdAt)<=Date.parse(context.evaluatedAt) && Date.parse(grant.expiresAt)>Date.parse(context.evaluatedAt) &&
    ["READ_CASE","READ_EVIDENCE","REVIEW_CASE"].every((action)=>grant.actions.includes(action as ConsentAction)) &&
    (!context.assignedDepartmentId || grant.recipientId===context.assignedDepartmentId));
}
export async function reconcileConsentStatus(tx: Transaction, caseId: string) {
  const { rows: [record] } = await tx.db.query("select status from public.cases where id=$1",[caseId]);
  if (!record || ["RESOLVED", "CLOSED"].includes(String(record.status))) return;
  const active=hasDepartmentSharing(await loadAuthorization(tx,caseId));
  const status = active ? (record.status === "PENDING_CONSENT" ? "SUBMITTED" : record.status) : "PENDING_CONSENT";
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
