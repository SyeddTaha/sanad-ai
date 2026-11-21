import "server-only";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { ErrorHttpStatus, IdSchema } from "@/contracts/v1";
import { AuthFailure, SESSION_COOKIE } from "@/backend/auth/principal";
import { privateJson } from "@/backend/auth/session";
import { audit, inAuthorizationTransaction, requireCitizen, lockTarget, type Dependencies, type Transaction } from "@/backend/authorization/transaction";
import { consentRecord, reconcileConsentStatus } from "@/backend/authorization/service";
import { CaseReservationResponseSchema, ReserveCaseRequestSchema, CreateConsentRequestSchema, RevokeConsentRequestSchema, ConsentPurposes, SANAD_AI_PROCESSOR_ID } from "@/lib/consent-contract";

type Operation = "reserve" | "list" | "grant" | "revoke";
export function errorJson(error: unknown, requestId: string) {
  const code = error instanceof AuthFailure ? error.code : "SERVICE_UNAVAILABLE";
  return privateJson({ requestId, error: { code, messageKey: "errors." + code.toLowerCase(), fieldErrors: [], retryable: ["SERVICE_UNAVAILABLE", "RATE_LIMITED", "REQUEST_IN_PROGRESS"].includes(code) } }, ErrorHttpStatus[code]);
}
async function readBody(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE) && (request.headers.get("origin") !== request.nextUrl.origin || request.headers.get("sec-fetch-site") === "cross-site")) throw new AuthFailure("FORBIDDEN");
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new AuthFailure("UNSUPPORTED_MEDIA_TYPE");
  if (!request.body) throw new AuthFailure("MALFORMED_REQUEST");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new AuthFailure("PAYLOAD_TOO_LARGE"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AuthFailure("MALFORMED_REQUEST"); }
}
export async function idempotent<T>(tx: Transaction, operation: string, key: string, body: unknown, work: () => Promise<T>): Promise<T> {
  const digest = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  await tx.db.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify([tx.identity.principal.id, operation, key])]);
  const { rows } = await tx.db.query("select digest,result from public.consent_operation_keys where actor_id=$1 and operation=$2 and key=$3", [tx.identity.principal.id, operation, key]);
  if (rows[0]) {
    if (rows[0].digest !== digest) throw new AuthFailure("IDEMPOTENCY_CONFLICT");
    return rows[0].result as T;
  }
  const result = await work();
  await tx.db.query("insert into public.consent_operation_keys(actor_id,operation,key,digest,result) values($1,$2,$3,$4,$5::jsonb)",
    [tx.identity.principal.id, operation, key, digest, JSON.stringify(result)]);
  return result;
}

export async function handleConsent(request: NextRequest, operation: Operation, target?: string, dependencies: Dependencies = {}) {
  const requestId = crypto.randomUUID();
  try {
    const data = await inAuthorizationTransaction(request, requestId, "CONSENT_" + operation.toUpperCase(), async (tx) => {
      if (target && !IdSchema.safeParse(target).success) throw new AuthFailure("VALIDATION_FAILED");
      requireCitizen(tx);
      let caseId = target;
      if (operation === "revoke") {
        const { rows: [row] } = await tx.db.query("select case_id from public.consent_grants where id=$1 and grantor_citizen_id=$2", [target, tx.identity.principal.id]);
        if (!row) throw new AuthFailure("FORBIDDEN");
        caseId = String(row.case_id);
      }
      if (operation !== "reserve") {
        if (!caseId) throw new AuthFailure("VALIDATION_FAILED");
        requireCitizen(tx, (await lockTarget(tx, caseId)).citizen_id);
      }
      if (operation === "list") {
        await reconcileConsentStatus(tx, caseId!);
        const { rows } = await tx.db.query("select *,to_json(actions) as actions from public.consent_grants where case_id=$1 order by created_at,id", [caseId]);
        await audit(tx, "CONSENT_LIST", "ALLOWED", caseId);
        return { items: rows.map(consentRecord), nextCursor: null };
      }
      const schema = operation === "reserve" ? ReserveCaseRequestSchema : operation === "grant" ? CreateConsentRequestSchema : RevokeConsentRequestSchema;
      const body = schema.safeParse(await readBody(request));
      if (!body.success) throw new AuthFailure("VALIDATION_FAILED");
      const key = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).safeParse(request.headers.get("idempotency-key"));
      if (!key.success) throw new AuthFailure("MALFORMED_REQUEST");
      return idempotent(tx, operation + (target ? ":" + target : ""), key.data, body.data, async () => {
        if (operation === "grant") {
          const grant = CreateConsentRequestSchema.parse(body.data);
          const policy = ConsentPurposes[grant.purpose];
          if (grant.recipientType !== policy.recipientType || !grant.actions.every((action) => (policy.actions as readonly string[]).includes(action))) throw new AuthFailure("VALIDATION_FAILED");
          const { rows: [clock] } = await tx.db.query("select clock_timestamp() as time");
          if (Date.parse(grant.expiresAt) <= new Date(clock.time as string).getTime()) throw new AuthFailure("VALIDATION_FAILED");
          if (grant.recipientType === "PRINCIPAL") {
            const { rows } = await tx.db.query(`select p.id from public.profiles p join public.role_assignments r on r.profile_id=p.id
              where p.id=$1 and p.active and r.role=$2`, [grant.recipientId, policy.role]);
            if (!rows.length || grant.recipientId === tx.identity.principal.id) throw new AuthFailure("VALIDATION_FAILED");
          } else if (grant.recipientType === "DEPARTMENT") {
            if (!(await tx.db.query("select id from public.departments where id=$1", [grant.recipientId])).rows.length) throw new AuthFailure("VALIDATION_FAILED");
          } else if (grant.recipientId !== SANAD_AI_PROCESSOR_ID) throw new AuthFailure("VALIDATION_FAILED");
          const { rows: [row] } = await tx.db.query(`insert into public.consent_grants(case_id,grantor_citizen_id,recipient_type,recipient_id,purpose,actions,expires_at,created_at)
            values($1,$2,$3,$4,$5,array(select jsonb_array_elements_text($6::jsonb))::public.sanad_consent_action[],$7,clock_timestamp()) returning *,to_json(actions) as actions`,
            [caseId, tx.identity.principal.id, grant.recipientType, grant.recipientId, grant.purpose, JSON.stringify(grant.actions), grant.expiresAt]);
          await audit(tx, "CONSENT_GRANTED", "ALLOWED", caseId, String(row.id));
          await reconcileConsentStatus(tx, caseId!);
          return consentRecord(row);
        }
        if (operation === "revoke") {
          const { expectedVersion } = RevokeConsentRequestSchema.parse(body.data);
          const { rows: [grant] } = await tx.db.query("select * from public.consent_grants where id=$1 for update", [target]);
          if (grant.version !== expectedVersion) throw new AuthFailure("STALE_VERSION");
          if (grant.revoked_at !== null) throw new AuthFailure("INVALID_TRANSITION");
          const { rows: [row] } = await tx.db.query("update public.consent_grants set revoked_at=clock_timestamp() where id=$1 returning *,to_json(actions) as actions", [target]);
          await audit(tx, "CONSENT_WITHDRAWN", "ALLOWED", caseId, target);
          await reconcileConsentStatus(tx, caseId!);
          return consentRecord(row);
        }
        const { rows: [row] } = await tx.db.query("insert into public.case_reservations(citizen_id) values($1) returning id,citizen_id,created_at", [tx.identity.principal.id]);
        const result = CaseReservationResponseSchema.shape.data.parse({ caseId: row.id, citizenId: row.citizen_id, createdAt: new Date(row.created_at as string).toISOString(), version: 1 });
        await audit(tx, "CASE_RESERVED", "ALLOWED", result.caseId);
        return result;
      });
    }, dependencies);
    return privateJson({ data, requestId }, operation === "reserve" || operation === "grant" ? 201 : 200);
  } catch (error) { return errorJson(error, requestId); }
}

