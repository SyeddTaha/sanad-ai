import "server-only";
import { RuleVersionSchema } from "@/contracts/v1";
import type { Transaction } from "@/backend/authorization/transaction";
import { SYNTHETIC_POLICY_LABEL, SYNTHETIC_PROGRAM_REF } from "@/lib/rule-contract";

export function ruleRecord(row: Record<string, unknown>) {
  return RuleVersionSchema.parse({ id: row.id, version: row.version, parameters: row.parameters,
    publishedBy: row.published_by, publishedAt: new Date(row.published_at as string).toISOString(), contentDigest: row.content_digest });
}

/** Reservation lock first for case work, then hold this shared lock through commit.
 * Publication exclusively locks the same singleton; it never takes a case lock.
 */
export async function currentRule(tx: Transaction) {
  const { rows: [head] } = await tx.db.query("select current_rule_id from public.rule_publication where singleton for share");
  if (!head?.current_rule_id) return null;
  const { rows: [row] } = await tx.db.query("select * from public.rule_versions where id=$1", [head.current_rule_id]);
  return ruleRecord(row);
}
export function publishedRule(rule: ReturnType<typeof ruleRecord>) {
  return { programRef: SYNTHETIC_PROGRAM_REF, policyLabel: SYNTHETIC_POLICY_LABEL, rule };
}
