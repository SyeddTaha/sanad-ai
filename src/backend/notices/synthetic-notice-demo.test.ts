import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPair } from "jose";
import { SyntheticDemoTrustedIssuerRegistry } from "./synthetic-demo-registry";
import { runSyntheticNoticeDemo } from "./synthetic-notice-demo";

test("A05 demo scenarios expose independent notice findings and source versions through A04", async () => {
  const results = await runSyntheticNoticeDemo();
  const byName = new Map(results.map((result) => [result.scenario, result]));

  assert.deepEqual([...byName.keys()], [
    "valid", "tampered-signature", "expired", "revoked", "unknown-issuer", "unknown-key", "registry-unavailable",
  ]);
  assert.deepEqual(
    [byName.get("valid")?.signature, byName.get("valid")?.expiry, byName.get("valid")?.revocation, byName.get("valid")?.issuerTrust],
    ["VALID", "CURRENT", "ACTIVE", "TRUSTED"],
  );
  assert.deepEqual(
    [byName.get("tampered-signature")?.signature, byName.get("tampered-signature")?.expiry,
      byName.get("tampered-signature")?.revocation, byName.get("tampered-signature")?.issuerTrust],
    ["INVALID", "UNKNOWN", "UNKNOWN", "UNKNOWN"],
  );
  assert.deepEqual(
    [byName.get("expired")?.signature, byName.get("expired")?.expiry, byName.get("expired")?.revocation, byName.get("expired")?.issuerTrust],
    ["VALID", "EXPIRED", "ACTIVE", "TRUSTED"],
  );
  assert.deepEqual(
    [byName.get("revoked")?.signature, byName.get("revoked")?.expiry, byName.get("revoked")?.revocation, byName.get("revoked")?.issuerTrust],
    ["VALID", "CURRENT", "REVOKED", "TRUSTED"],
  );
  assert.deepEqual(
    [byName.get("unknown-issuer")?.signature, byName.get("unknown-issuer")?.expiry,
      byName.get("unknown-issuer")?.revocation, byName.get("unknown-issuer")?.issuerTrust],
    ["NOT_VERIFIED", "UNKNOWN", "UNKNOWN", "UNKNOWN"],
  );
  assert.deepEqual(
    [byName.get("unknown-key")?.signature, byName.get("unknown-key")?.expiry,
      byName.get("unknown-key")?.revocation, byName.get("unknown-key")?.issuerTrust],
    ["NOT_VERIFIED", "UNKNOWN", "UNKNOWN", "UNKNOWN"],
  );
  assert.deepEqual(
    [byName.get("registry-unavailable")?.signature, byName.get("registry-unavailable")?.expiry,
      byName.get("registry-unavailable")?.revocation, byName.get("registry-unavailable")?.issuerTrust],
    ["VALID", "CURRENT", "UNKNOWN", "TRUSTED"],
  );
  assert.equal(byName.get("registry-unavailable")?.errorCode, "REGISTRY_UNAVAILABLE");
  assert.deepEqual(byName.get("valid")?.sourceVersions.map(({ service, sourceVersion }) => [service, sourceVersion]), [
    ["trusted_issuer_registry", 7],
    ["signed_notice", 1],
    ["notice_revocation_registry", 10],
    ["trusted_issuer_registry", 3],
  ]);
  for (const result of results) {
    assert.equal("payment" in result, false);
    assert.equal("identity" in result, false);
    assert.equal("eligibility" in result, false);
  }
});

test("synthetic registry distinguishes unknown records, unavailable sources and missing revocation records", async () => {
  const { publicKey } = await generateKeyPair("Ed25519", { extractable: false });
  const registry = new SyntheticDemoTrustedIssuerRegistry({
    issuers: [{ issuerId: "issuer_known", status: "ACTIVE", sourceVersion: 2 }],
    keys: [{ kid: "key_known", issuerId: "issuer_known", publicKey, trustStatus: "ACTIVE", sourceVersion: 5 }],
    notices: [],
  });

  assert.deepEqual(await registry.resolveKey("key_missing"), { status: "UNKNOWN_KEY" });
  assert.deepEqual(await registry.resolveIssuer("issuer_missing"), { status: "UNKNOWN_ISSUER" });
  assert.deepEqual(await registry.resolveNotice("issuer_known", "notice_missing"), { status: "UNAVAILABLE" });
  assert.deepEqual(await registry.resolveIssuer("issuer_known"), { status: "ACTIVE", sourceVersion: 2 });
  assert.deepEqual(await registry.resolveKey("key_known"), {
    status: "FOUND", kid: "key_known", issuerId: "issuer_known", publicKey,
    trustStatus: "ACTIVE", sourceVersion: 5,
  });

  const outage = new SyntheticDemoTrustedIssuerRegistry({
    issuers: [], keys: [], notices: [], unavailable: ["keys", "issuers", "notices"],
  });
  assert.deepEqual(await outage.resolveKey("key_known"), { status: "UNAVAILABLE" });
  assert.deepEqual(await outage.resolveIssuer("issuer_known"), { status: "UNAVAILABLE" });
  assert.deepEqual(await outage.resolveNotice("issuer_known", "notice_known"), { status: "UNAVAILABLE" });
});

test("synthetic registry rejects duplicate records and invalid source versions", async () => {
  const { publicKey } = await generateKeyPair("Ed25519", { extractable: false });
  const key = { kid: "key_known", issuerId: "issuer_known", publicKey, trustStatus: "ACTIVE" as const, sourceVersion: 1 };
  assert.throws(() => new SyntheticDemoTrustedIssuerRegistry({ issuers: [], keys: [key, key], notices: [] }), /Duplicate synthetic key/);
  assert.throws(() => new SyntheticDemoTrustedIssuerRegistry({
    issuers: [{ issuerId: "issuer_known", status: "ACTIVE", sourceVersion: 0 }], keys: [], notices: [],
  }), /Invalid synthetic issuer source version/);
});

test("synthetic issuer, key and notice revocation records keep independent versions", async () => {
  const { publicKey } = await generateKeyPair("Ed25519", { extractable: false });
  const registry = new SyntheticDemoTrustedIssuerRegistry({
    issuers: [{ issuerId: "issuer_revoked", status: "REVOKED", sourceVersion: 8 }],
    keys: [
      { kid: "key_revoked", issuerId: "issuer_revoked", publicKey, trustStatus: "REVOKED", sourceVersion: 6 },
      { kid: "key_untrusted", issuerId: "issuer_revoked", publicKey, trustStatus: "UNTRUSTED", sourceVersion: 4 },
    ],
    notices: [{ issuerId: "issuer_revoked", noticeId: "notice_revoked", status: "REVOKED", sourceVersion: 12 }],
  });

  assert.deepEqual(await registry.resolveIssuer("issuer_revoked"), { status: "REVOKED", sourceVersion: 8 });
  assert.deepEqual(await registry.resolveKey("key_revoked"), {
    status: "FOUND", kid: "key_revoked", issuerId: "issuer_revoked", publicKey,
    trustStatus: "REVOKED", sourceVersion: 6,
  });
  assert.deepEqual(await registry.resolveKey("key_untrusted"), {
    status: "FOUND", kid: "key_untrusted", issuerId: "issuer_revoked", publicKey,
    trustStatus: "UNTRUSTED", sourceVersion: 4,
  });
  assert.deepEqual(await registry.resolveNotice("issuer_revoked", "notice_revoked"), {
    status: "REVOKED", sourceVersion: 12,
  });
});

test("synthetic notice demo refuses to run in production", async () => {
  const env = process.env as Record<string, string | undefined>;
  const previous = env.NODE_ENV;
  env.NODE_ENV = "production";
  try {
    await assert.rejects(runSyntheticNoticeDemo(), /disabled in production/);
  } finally {
    if (previous === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previous;
  }
});
