import "server-only";
import type { AuthorizationContext, ConsentAction, ErrorCode } from "@/contracts/v1";
import { ConsentPurposes, OperationalPurposeSchema } from "@/lib/consent-contract";

export type Permission = { action: ConsentAction; purpose: string; processorId?: string };
export type PolicyContext = AuthorizationContext & { assignedDepartmentId?: string | null };
export type Decision = { allowed: boolean; code?: ErrorCode; authorizationRef?: string };
const citizenActions: ConsentAction[] = ["READ_CASE", "READ_EVIDENCE", "WRITE_DRAFT", "ADD_EVIDENCE", "SUBMIT_CASE", "REQUEST_ASSESSMENT"];

/** Pure policy over trusted server state. Use withAuthorizedCase at request boundaries. */
export function authorize(context: PolicyContext, permission: Permission): Decision {
  const { principal, target } = context;
  if (!principal.active) return { allowed: false, code: "FORBIDDEN" };
  if (context.apiKeyScopes !== null && !context.apiKeyScopes.includes(permission.action)) return { allowed: false, code: "INSUFFICIENT_SCOPE" };
  if (principal.kind === "SERVICE" && context.apiKeyScopes === null) return { allowed: false, code: "INSUFFICIENT_SCOPE" };
  if (permission.action === "PROCESS_AI") {
    if (!authorize(context, { action: "READ_EVIDENCE", purpose: permission.purpose }).allowed ||
      !authorize(context, { action: "REQUEST_ASSESSMENT", purpose: permission.purpose }).allowed) return { allowed: false, code: "FORBIDDEN" };
    const grant = context.grants.find((g) => g.caseId === target.caseId && g.grantorCitizenId === target.citizenId &&
      g.recipientType === "AI_PROCESSOR" && g.recipientId === permission.processorId && g.purpose === "synthetic_ai_assistance" &&
      g.actions.includes("PROCESS_AI") && g.revokedAt === null && Date.parse(g.createdAt) <= Date.parse(context.evaluatedAt) && Date.parse(g.expiresAt) > Date.parse(context.evaluatedAt));
    return grant ? { allowed: true, authorizationRef: grant.id } : { allowed: false, code: "CONSENT_REQUIRED" };
  }
  if (principal.kind === "HUMAN" && principal.id === target.citizenId && principal.roles.includes("CITIZEN") && citizenActions.includes(permission.action)) {
    return { allowed: true };
  }
  const parsed = OperationalPurposeSchema.safeParse(permission.purpose);
  if (!parsed.success) return { allowed: false, code: "FORBIDDEN" };
  const policy = ConsentPurposes[parsed.data];
  for (const grant of context.grants) {
    if (grant.caseId !== target.caseId || grant.grantorCitizenId !== target.citizenId || grant.purpose !== permission.purpose ||
      grant.revokedAt !== null || Date.parse(grant.createdAt) > Date.parse(context.evaluatedAt) ||
      Date.parse(grant.expiresAt) <= Date.parse(context.evaluatedAt) || !grant.actions.includes(permission.action)) continue;
    if (grant.recipientType === "PRINCIPAL" && policy.recipientType === "PRINCIPAL" && grant.recipientId === principal.id &&
      principal.roles.includes(policy.role) && (policy.actions as readonly string[]).includes(permission.action)) {
      return { allowed: true, authorizationRef: grant.id };
    }
    if (grant.recipientType === "DEPARTMENT" && policy.recipientType === "DEPARTMENT" && context.departmentIds.includes(grant.recipientId)) {
      if (principal.roles.includes("OFFICER") && target.assignedOfficerId === principal.id &&
        context.assignedDepartmentId === grant.recipientId && permission.action !== "ASSIGN_CASE" &&
        (policy.actions as readonly string[]).includes(permission.action)) return { allowed: true, authorizationRef: grant.id };
      // Dispatch is deliberately separate from READ_CASE/READ_EVIDENCE.
      if (principal.roles.includes("ADMIN") && permission.action === "ASSIGN_CASE") return { allowed: true, authorizationRef: grant.id };
    }
  }
  return { allowed: false, code: "CONSENT_REQUIRED" };
}
