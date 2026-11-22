import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { IdSchema } from "@/contracts/v1";
import { AuthFailure } from "@/backend/auth/principal";
import { privateJson } from "@/backend/auth/session";
import { audit, inAuthorizationTransaction, type Dependencies } from "@/backend/authorization/transaction";
import { errorJson, idempotent, readBody } from "@/backend/consent/http";
import { page, pageOptions } from "@/backend/officers/pagination";
import { ApiKeyMetadataSchema, ApiKeyScopesByRole, IssueApiKeyRequestSchema, RevokeApiKeyRequestSchema } from "@/lib/api-key-contract";

function metadata(row: Record<string, unknown>) {
  return ApiKeyMetadataSchema.parse({ id: row.id, principalId: row.principal_id, name: row.name, scopes: row.scopes,
    createdAt: new Date(row.created_at as string).toISOString(), expiresAt: new Date(row.expires_at as string).toISOString(),
    revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at as string).toISOString() });
}
const columns = "id,principal_id,name,to_json(scopes) as scopes,created_at,expires_at,revoked_at";

export async function handleApiKeys(request: NextRequest, operation: "issue" | "list" | "revoke", target?: string, dependencies: Dependencies = {}) {
  const requestId = crypto.randomUUID();
  let input: unknown;
  let operationKey: string;
  let plaintext: string | null = null;
  try {
    const data = await inAuthorizationTransaction(request, requestId, "API_KEY_" + operation.toUpperCase(), async (tx) => {
      if (tx.identity.principal.kind !== "HUMAN") throw new AuthFailure("FORBIDDEN");
      if (operation === "list") {
        const { cursor, limit } = pageOptions(request.nextUrl.searchParams);
        const { rows } = await tx.db.query(`select ${columns} from public.api_keys where principal_id=$1 and ($2::uuid is null or id>$2) order by id limit $3`, [tx.identity.principal.id, cursor, limit + 1]);
        await audit(tx, "API_KEY_LIST");
        return page(rows.map(metadata), limit);
      }
      if (operation === "revoke") {
        if (!IdSchema.safeParse(target).success) throw new AuthFailure("VALIDATION_FAILED");
        const { rows: [row] } = await tx.db.query(`select ${columns} from public.api_keys where id=$1 and principal_id=$2 for update`, [target, tx.identity.principal.id]);
        if (!row) throw new AuthFailure("FORBIDDEN");
        return idempotent(tx, "api-key-revoke:" + target, operationKey, input, async () => {
          if (row.revoked_at === null) await tx.db.query("update public.api_keys set revoked_at=clock_timestamp() where id=$1", [target]);
          const { rows: [revoked] } = await tx.db.query(`select ${columns} from public.api_keys where id=$1`, [target]);
          await audit(tx, "API_KEY_REVOKED", "ALLOWED", target);
          return metadata(revoked);
        });
      }
      const issue = IssueApiKeyRequestSchema.parse(input);
      const permitted: readonly string[] = tx.identity.principal.roles.flatMap((role) => [...ApiKeyScopesByRole[role]]);
      if (!issue.scopes.every((scope) => permitted.includes(scope))) throw new AuthFailure("INSUFFICIENT_SCOPE");
      return idempotent(tx, "api-key-issue", operationKey, issue, async () => {
        const { rows: [clock] } = await tx.db.query("select clock_timestamp() as time");
        const lifetime = Date.parse(issue.expiresAt) - new Date(clock.time as string).getTime();
        if (lifetime <= 0 || lifetime > 30 * 86400000) throw new AuthFailure("VALIDATION_FAILED");
        const secret = "sanad_" + randomBytes(32).toString("base64url");
        const digest = createHash("sha256").update(secret).digest("hex");
        const { rows: [row] } = await tx.db.query(`insert into public.api_keys(principal_id,name,secret_hash,scopes,expires_at)
          values($1,$2,$3,array(select jsonb_array_elements_text($4::jsonb))::public.sanad_consent_action[],$5) returning ${columns}`,
        [tx.identity.principal.id, issue.name, digest, JSON.stringify(issue.scopes), issue.expiresAt]);
        await audit(tx, "API_KEY_ISSUED", "ALLOWED", String(row.id));
        plaintext = secret;
        // Only metadata is retained by idempotency. A lost response requires a new key.
        return metadata(row);
      });
    }, dependencies, async () => {
      if (operation === "list") return;
      const parsed = (operation === "issue" ? IssueApiKeyRequestSchema : RevokeApiKeyRequestSchema).safeParse(await readBody(request));
      if (!parsed.success) throw new AuthFailure("VALIDATION_FAILED");
      input = parsed.data;
      const parsedKey = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).safeParse(request.headers.get("idempotency-key"));
      if (!parsedKey.success) throw new AuthFailure("MALFORMED_REQUEST");
      operationKey = parsedKey.data;
    });
    return privateJson({ data: operation === "issue" ? { credential: data, key: plaintext } : data, requestId }, operation === "issue" && plaintext !== null ? 201 : 200);
  } catch (error) { return errorJson(error, requestId); }
}
