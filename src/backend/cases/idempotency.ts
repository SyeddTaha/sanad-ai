import "server-only";
import { createHash } from "node:crypto";
import { AuthFailure } from "@/backend/auth/principal";
import { audit, type Transaction } from "@/backend/authorization/transaction";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}

/** Read only after authorization, including before external work. Reservation lock is required. */
export async function operationReplay<T>(tx: Transaction, caseId: string, operation: string, key: string, body: unknown): Promise<{ result: T } | null> {
  const digest = createHash("sha256").update(JSON.stringify(canonical(body))).digest("hex");
  const identity = [tx.identity.principal.id, caseId, operation, key];
  // The reservation lock already serializes all mutations of this target.
  const { rows: [existing] } = await tx.db.query("select digest,result from public.case_operation_keys where actor_id=$1 and case_id=$2 and operation=$3 and key=$4", identity);
  if (existing) {
    if (existing.digest !== digest) throw new AuthFailure("IDEMPOTENCY_CONFLICT");
    return { result: existing.result as T };
  }
  return null;
}

/** Call only after authorization; retain references/revisions, never private evidence copies. */
export async function replayable<T>(tx: Transaction, caseId: string, operation: string, key: string, body: unknown, work: () => Promise<T>): Promise<T> {
  const existing = await operationReplay<T>(tx, caseId, operation, key, body);
  if (existing) {
    await audit(tx, "CASE_RETRY", "ALLOWED", caseId);
    return existing.result;
  }
  const digest = createHash("sha256").update(JSON.stringify(canonical(body))).digest("hex");
  const identity = [tx.identity.principal.id, caseId, operation, key];
  const result = await work();
  await tx.db.query("insert into public.case_operation_keys(actor_id,case_id,operation,key,digest,result) values($1,$2,$3,$4,$5,$6)", [...identity, digest, JSON.stringify(result)]);
  return result;
}
