import "server-only";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import type { ConsentAction } from "@/contracts/v1";
import { AuthFailure, SESSION_COOKIE } from "@/backend/auth/principal";
import { SessionContextSchema } from "@/lib/auth/session-contract";
import { ApiKeyScopesByRole } from "@/lib/api-key-contract";
import type { Database } from "@/backend/authorization/transaction";

// Explicitly supported application operations. New operations default to denial.
const publicActions: Record<string, readonly ConsentAction[]> = {
  CASE_READ: ["READ_CASE"], CASE_HISTORY_READ: ["READ_CASE"], DRAFT_READ: ["READ_EVIDENCE"],
  PASSPORT_READ: ["READ_EVIDENCE"], ASSESSMENT_READ: ["READ_EVIDENCE"], EVIDENCE_READ: ["READ_EVIDENCE"],
  DECISIONS_READ: ["READ_EVIDENCE"], PROGRAM_INPUTS_READ: ["READ_EVIDENCE"], DRAFT_SAVED: ["WRITE_DRAFT"],
  EVIDENCE_ADDED: ["ADD_EVIDENCE"], CASE_SUBMITTED: ["SUBMIT_CASE"], CASE_RESUBMITTED: ["SUBMIT_CASE"],
  ASSESSMENT_CREATED: ["REQUEST_ASSESSMENT", "READ_EVIDENCE"], CASE_ASSIGNED: ["ASSIGN_CASE"],
  PRIORITY_CHANGED: ["ASSIGN_CASE"], REVIEW_STARTED: ["REVIEW_CASE"], EVIDENCE_REQUESTED: ["REVIEW_CASE"],
  CASE_ESCALATED: ["ESCALATE_CASE"], CASE_CLOSED: ["CLOSE_CASE"],
  CASE_RESOLVED: ["RESOLVE_CASE", "READ_EVIDENCE", "REQUEST_ASSESSMENT"],
  STAFF_QUEUE_READ: [], // The queue checks its officer/dispatch scope before querying.
};

export function requestApiKey(request: NextRequest) {
  if (request.headers.has("authorization") || request.cookies.has(SESSION_COOKIE)) throw new AuthFailure("MALFORMED_REQUEST");
  const secret = request.headers.get("x-api-key") ?? "";
  if (!/^sanad_[A-Za-z0-9_-]{43}$/.test(secret)) throw new AuthFailure("INVALID_API_KEY");
  return createHash("sha256").update(secret).digest("hex");
}

export async function authenticateApiKey(db: Database, digest: string, action: string, locked = false) {
  const { rows: [key] } = await db.query(`select id,principal_id,to_json(scopes) as scopes from public.api_keys
    where secret_hash=$1 and revoked_at is null and created_at<=clock_timestamp() and expires_at>clock_timestamp()
    ${locked ? "for share" : ""}`, [digest]);
  if (!key) throw new AuthFailure("INVALID_API_KEY");
  const actorId = String(key.principal_id);
  const { rows: [row] } = await db.query(`select jsonb_build_object(
    'principal',jsonb_build_object('id',p.id,'kind','SERVICE','active',p.active,
      'roles',array(select role from public.role_assignments where profile_id=p.id order by role)),
    'departmentIds',array(select department_id from public.department_memberships where profile_id=p.id order by department_id)) as context
    from public.profiles p where p.id=$1`, [actorId]);
  if (!row) throw new AuthFailure("INVALID_API_KEY");
  const identity = SessionContextSchema.parse(row.context);
  if (!identity.principal.active || !identity.principal.roles.length) throw new AuthFailure("FORBIDDEN", actorId);
  const permitted: readonly string[] = identity.principal.roles.flatMap((role) => [...ApiKeyScopesByRole[role]]);
  const scopes = (key.scopes as ConsentAction[]).filter((scope) => permitted.includes(scope));
  if (!Object.hasOwn(publicActions, action)) throw new AuthFailure("FORBIDDEN", actorId);
  if (!publicActions[action].every((scope) => scopes.includes(scope))) throw new AuthFailure("INSUFFICIENT_SCOPE", actorId);
  return { identity, scopes, credentialId: String(key.id) };
}
