import "server-only";
import { createHash } from "node:crypto";
import { importJWK } from "jose";
import { z } from "zod";
import { ReferenceSchema, VersionSchema } from "@/contracts/v1";
import type { Transaction } from "@/backend/authorization/transaction";
import type { RegistryKeyResolution, TrustedIssuerRegistry } from "./signed-notice";

const PublicKeySchema = z.strictObject({ kty: z.literal("OKP"), crv: z.literal("Ed25519"), x: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
const RecordSchema = z.strictObject({ kind: z.enum(["ISSUER", "KEY", "NOTICE"]), record_ref: ReferenceSchema,
  issuer_id: ReferenceSchema, version: VersionSchema, status: z.enum(["ACTIVE", "REVOKED", "UNTRUSTED"]), public_key: PublicKeySchema.nullable() });

/** Read only trusted setup records. Table lock serializes publication with final persistence/resolution. */
export async function registrySnapshot(tx: Transaction) {
  await tx.db.query("lock table public.trusted_registry_records in share mode");
  const { rows } = await tx.db.query(`select distinct on (kind,record_ref) kind,record_ref,issuer_id,version,status,public_key
    from public.trusted_registry_records order by kind,record_ref,version desc`);
  const records = rows.map((row) => RecordSchema.parse(row));
  const fingerprint = createHash("sha256").update(JSON.stringify(records)).digest("hex");
  const registry: TrustedIssuerRegistry = {
    async resolveKey(kid): Promise<RegistryKeyResolution> {
      const row = records.find((item) => item.kind === "KEY" && item.record_ref === kid);
      if (!row) return { status: "UNKNOWN_KEY" };
      try {
        if (!row.public_key) return { status: "UNAVAILABLE" };
        const publicKey = await importJWK(row.public_key, "Ed25519");
        if (!(publicKey instanceof CryptoKey)) return { status: "UNAVAILABLE" };
        return { status: "FOUND", kid, issuerId: row.issuer_id, publicKey, trustStatus: row.status, sourceVersion: row.version };
      } catch { return { status: "UNAVAILABLE" }; }
    },
    resolveIssuer(issuerId) {
      const row = records.find((item) => item.kind === "ISSUER" && item.record_ref === issuerId);
      if (!row) return { status: "UNKNOWN_ISSUER" };
      return row.status === "UNTRUSTED" ? { status: "UNAVAILABLE" } : { status: row.status, sourceVersion: row.version };
    },
    resolveNotice(issuerId, noticeId) {
      const row = records.find((item) => item.kind === "NOTICE" && item.record_ref === noticeId && item.issuer_id === issuerId);
      return !row || row.status === "UNTRUSTED" ? { status: "UNAVAILABLE" } : { status: row.status, sourceVersion: row.version };
    },
  };
  return { registry, fingerprint };
}
