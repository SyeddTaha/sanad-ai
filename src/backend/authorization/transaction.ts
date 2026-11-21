import "server-only";
import type { NextRequest } from "next/server";
import { connectDatabase } from "../../../scripts/database";
import { AuthFailure, requestToken, requirePrincipal } from "@/backend/auth/principal";
import type { AuthClients } from "@/backend/auth/supabase";
import { SessionContextSchema, type SessionContext } from "@/lib/auth/session-contract";

export interface Database {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  end(): Promise<void>;
}
export type Dependencies = { database?: () => Promise<Database>; clients?: AuthClients };
export type Transaction = { db: Database; identity: SessionContext; requestId: string };
export async function audit(tx: Transaction, action: string, outcome = "ALLOWED", target?: string, ref?: string) {
  await tx.db.query(`insert into public.audit_events(request_id,actor_id,action,outcome,target_id,authorization_ref)
    values($1,$2,$3,$4,$5,$6)`, [tx.requestId, tx.identity.principal.id, action, outcome, target ?? null, ref ?? null]);
}

/** No external network/AI calls in work. Its DB writes and audit commit together. */
export async function inAuthorizationTransaction<T>(request: NextRequest, requestId: string, action: string,
  work: (tx: Transaction) => Promise<T>, dependencies: Dependencies = {}, prepare?: () => Promise<void>): Promise<T> {
  let db: Database | undefined;
  let actorId: string | undefined;
  try {
    const verified = await requirePrincipal(request, dependencies.clients);
    actorId = verified.principal.id;
    // Only decoded after B01 has verified this exact token and its session binding.
    const session = JSON.parse(Buffer.from(requestToken(request).split(".")[1], "base64url").toString()).session_id;
    // Consume/validate client streams after authentication and before acquiring any DB locks.
    await prepare?.();
    db = await (dependencies.database ?? connectDatabase)();
    await db.query("begin");
    await db.query("set local lock_timeout = '15s'");
    await db.query("set local statement_timeout = '20s'");
    // Small prototype catalogs: shared table locks also prevent concurrent role/membership inserts.
    await db.query("lock table public.profiles, public.role_assignments, public.department_memberships in share mode");
    await db.query("select id from auth.sessions where id=$1 and user_id=$2 for share", [session, actorId]);
    const { rows } = await db.query("select public.sanad_session_context($1,$2) as context", [actorId, session]);
    if (!rows[0]?.context) throw new AuthFailure("UNAUTHENTICATED");
    const identity = SessionContextSchema.parse(rows[0].context);
    if (!identity.principal.active || !identity.principal.roles.length) throw new AuthFailure("FORBIDDEN");
    const value = await work({ db, identity, requestId });
    await db.query("commit");
    return value;
  } catch (error) {
    if (db) await db.query("rollback");
    const failure = error instanceof AuthFailure ? error : new AuthFailure("SERVICE_UNAVAILABLE");
    // Roll back mutation/audit together, then retain only a minimal failed/denied attempt.
    db ??= await (dependencies.database ?? connectDatabase)();
    await db.query(`insert into public.audit_events(request_id,actor_id,action,outcome) values($1,$2,$3,$4)`,
      [requestId, actorId ?? failure.actorId ?? null, action, failure.code === "SERVICE_UNAVAILABLE" ? "FAILED" : "DENIED"]);
    throw failure;
  } finally { await db?.end(); }
}

export async function lockTarget(tx: Transaction, caseId: string) {
  const rows=await lockTargets(tx,[caseId]);
  // Deliberately identical for a foreign or nonexistent owner-bound target.
  if (!rows[0]) throw new AuthFailure("FORBIDDEN");
  return rows[0];
}
export async function lockTargets(tx:Transaction,caseIds:string[]) {
  const {rows}=await tx.db.query("select id,citizen_id,created_at from public.case_reservations where id=any($1::uuid[]) order by id for update",[caseIds]);
  return rows;
}
export function requireCitizen(tx: Transaction, owner?: unknown) {
  if (tx.identity.principal.kind !== "HUMAN" || !tx.identity.principal.roles.includes("CITIZEN") ||
    (owner !== undefined && owner !== tx.identity.principal.id)) throw new AuthFailure("FORBIDDEN");
}
