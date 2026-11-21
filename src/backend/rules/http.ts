import "server-only";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { IdSchema } from "@/contracts/v1";
import { AuthFailure } from "@/backend/auth/principal";
import { privateJson } from "@/backend/auth/session";
import { audit, inAuthorizationTransaction, type Dependencies } from "@/backend/authorization/transaction";
import { errorJson, idempotent, readBody } from "@/backend/consent/http";
import { PublishRuleRequestSchema, SYNTHETIC_POLICY_LABEL, SYNTHETIC_PROGRAM_REF } from "@/lib/rule-contract";
import { currentRule, publishedRule, ruleRecord } from "./service";

export async function handleRules(request: NextRequest, operation: "current" | "publish" | "version", dependencies: Dependencies = {}, ruleId?: string) {
  const requestId = crypto.randomUUID();
  let input: z.infer<typeof PublishRuleRequestSchema>;
  let key: string;
  try {
    const data = await inAuthorizationTransaction(request, requestId, "RULE_" + operation.toUpperCase(), async (tx) => {
      if (!tx.identity.principal.roles.some((role) => role === "ADMIN" || (operation !== "publish" && role === "OFFICER"))) throw new AuthFailure("FORBIDDEN");
      if (operation === "version") {
        if (!IdSchema.safeParse(ruleId).success) throw new AuthFailure("VALIDATION_FAILED");
        const {rows:[row]}=await tx.db.query("select * from public.rule_versions where id=$1",[ruleId]);
        if (!row) throw new AuthFailure("NOT_FOUND");
        await audit(tx,"RULE_READ","ALLOWED",ruleId);
        return publishedRule(ruleRecord(row));
      }
      if (operation === "current") {
        if (request.nextUrl.searchParams.has("programRef") && request.nextUrl.searchParams.get("programRef") !== SYNTHETIC_PROGRAM_REF) throw new AuthFailure("VALIDATION_FAILED");
        const rule = await currentRule(tx);
        if (!rule) throw new AuthFailure("NOT_FOUND");
        await audit(tx, "RULE_READ", "ALLOWED", rule.id);
        return publishedRule(rule);
      }
      // Single global policy stream: publication holds this exclusive lock through audit/commit.
      await tx.db.query("select singleton from public.rule_publication where singleton for update");
      return idempotent(tx, "rule-publish", key, input, async () => {
        const current = await currentRule(tx);
        if ((current?.version ?? null) !== input.expectedCurrentVersion) throw new AuthFailure("STALE_VERSION");
        const contentDigest = createHash("sha256").update(JSON.stringify({ programRef: SYNTHETIC_PROGRAM_REF,
          policyLabel: SYNTHETIC_POLICY_LABEL, parameters: input.parameters })).digest("hex");
        const { rows: [row] } = await tx.db.query(`insert into public.rule_versions(version,program_ref,policy_label,parameters,content_digest,published_by)
          values($1,$2,$3,$4,$5,$6) returning *`, [(current?.version ?? 0)+1, SYNTHETIC_PROGRAM_REF, SYNTHETIC_POLICY_LABEL, input.parameters, contentDigest, tx.identity.principal.id]);
        const rule = ruleRecord(row);
        await tx.db.query("update public.rule_publication set current_rule_id=$1 where singleton", [rule.id]);
        await audit(tx, "RULE_PUBLISHED", "ALLOWED", rule.id);
        return publishedRule(rule);
      });
    }, dependencies, async () => {
      if (operation !== "publish") return;
      const parsed = PublishRuleRequestSchema.safeParse(await readBody(request));
      if (!parsed.success) throw new AuthFailure("VALIDATION_FAILED");
      input = parsed.data;
      const parsedKey = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).safeParse(request.headers.get("idempotency-key"));
      if (!parsedKey.success) throw new AuthFailure("MALFORMED_REQUEST");
      key = parsedKey.data;
    });
    return privateJson({ data, requestId }, operation === "publish" ? 201 : 200);
  } catch (error) { return errorJson(error, requestId); }
}
