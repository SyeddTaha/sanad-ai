import "server-only";

import type {
  NoticeRevocationResolution,
  RegistryIssuerResolution,
  RegistryKeyResolution,
  TrustedIssuerRegistry,
} from "./signed-notice";

/** Explicit non-production trust data for deterministic tests and local demos. */
export type SyntheticIssuerRecord = {
  issuerId: string;
  status: "ACTIVE" | "REVOKED";
  sourceVersion: number;
};

export type SyntheticKeyRecord = {
  kid: string;
  issuerId: string;
  publicKey: CryptoKey;
  trustStatus: "ACTIVE" | "REVOKED" | "UNTRUSTED";
  sourceVersion: number;
};

export type SyntheticNoticeRecord = {
  issuerId: string;
  noticeId: string;
  status: "ACTIVE" | "REVOKED";
  sourceVersion: number;
};

export type SyntheticRegistrySnapshot = {
  issuers: readonly SyntheticIssuerRecord[];
  keys: readonly SyntheticKeyRecord[];
  notices: readonly SyntheticNoticeRecord[];
  unavailable?: readonly ("keys" | "issuers" | "notices")[];
};

/**
 * In-memory synthetic implementation of A02's server-side registry seam.
 * This is not a production trust registry or persistent source of authority.
 */
export class SyntheticDemoTrustedIssuerRegistry implements TrustedIssuerRegistry {
  private readonly issuers: ReadonlyMap<string, SyntheticIssuerRecord>;
  private readonly keys: ReadonlyMap<string, SyntheticKeyRecord>;
  private readonly notices: ReadonlyMap<string, SyntheticNoticeRecord>;
  private readonly unavailable: ReadonlySet<string>;

  constructor(snapshot: SyntheticRegistrySnapshot) {
    this.issuers = uniqueMap(snapshot.issuers, (record) => record.issuerId, "issuer");
    this.keys = uniqueMap(snapshot.keys, (record) => record.kid, "key");
    this.notices = uniqueMap(snapshot.notices, (record) => noticeMapKey(record.issuerId, record.noticeId), "notice");
    this.unavailable = new Set(snapshot.unavailable ?? []);

    for (const record of this.issuers.values()) assertVersion(record.sourceVersion, "issuer");
    for (const record of this.keys.values()) {
      assertVersion(record.sourceVersion, "key");
      if (record.publicKey.type !== "public"
        || record.publicKey.algorithm.name !== "Ed25519"
        || !record.publicKey.usages.includes("verify")) {
        throw new Error("Synthetic registry keys must be Ed25519 public verification keys");
      }
    }
    for (const record of this.notices.values()) assertVersion(record.sourceVersion, "notice");
  }

  resolveKey(kid: string): RegistryKeyResolution {
    if (this.unavailable.has("keys")) return { status: "UNAVAILABLE" };
    const record = this.keys.get(kid);
    if (!record) return { status: "UNKNOWN_KEY" };
    return { status: "FOUND", ...record };
  }

  resolveIssuer(issuerId: string): RegistryIssuerResolution {
    if (this.unavailable.has("issuers")) return { status: "UNAVAILABLE" };
    const record = this.issuers.get(issuerId);
    return record ? { status: record.status, sourceVersion: record.sourceVersion } : { status: "UNKNOWN_ISSUER" };
  }

  resolveNotice(issuerId: string, noticeId: string): NoticeRevocationResolution {
    if (this.unavailable.has("notices")) return { status: "UNAVAILABLE" };
    const record = this.notices.get(noticeMapKey(issuerId, noticeId));
    // Absence of an explicit revocation record is not evidence of active standing.
    return record ? { status: record.status, sourceVersion: record.sourceVersion } : { status: "UNAVAILABLE" };
  }
}

function uniqueMap<T>(records: readonly T[], keyOf: (record: T) => string, label: string): ReadonlyMap<string, T> {
  const map = new Map<string, T>();
  for (const record of records) {
    const key = keyOf(record);
    if (map.has(key)) throw new Error(`Duplicate synthetic ${label} record`);
    map.set(key, Object.freeze({ ...record }));
  }
  return map;
}

function assertVersion(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Invalid synthetic ${label} source version`);
}

function noticeMapKey(issuerId: string, noticeId: string): string {
  return `${issuerId}\u0000${noticeId}`;
}
