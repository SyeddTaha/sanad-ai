# A05 synthetic trusted issuer registry

A05 implements A02's `TrustedIssuerRegistry` interface as
`SyntheticDemoTrustedIssuerRegistry`. It is an immutable in-memory adapter for
tests and local developer demonstrations only. It is not a production trust
registry, does not load external configuration, and does not persist issuer,
key, or revocation records. No schema, migration, route, or frontend surface is
added.

## Run the deterministic demo

```sh
node --conditions=react-server --import tsx scripts/synthetic-notice-demo.ts
```

The script generates a fresh ephemeral synthetic Ed25519 keypair, signs local
synthetic payloads, and calls A04's `verifyNoticeForCase` at fixed time
`1795300000`. It prints one JSON object per scenario containing signature,
expiry, revocation, issuer-trust results, error code, and applicable source
versions. It never prints or stores private key material. The helper throws if
`NODE_ENV=production`; it has no route or frontend import.

| Scenario | Signature | Expiry | Revocation | Issuer trust |
| --- | --- | --- | --- | --- |
| `valid` | `VALID` | `CURRENT` | `ACTIVE` | `TRUSTED` |
| `tampered-signature` | `INVALID` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` |
| `expired` | `VALID` | `EXPIRED` | `ACTIVE` | `TRUSTED` |
| `revoked` | `VALID` | `CURRENT` | `REVOKED` | `TRUSTED` |
| `unknown-issuer` | `NOT_VERIFIED` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` |
| `unknown-key` | `NOT_VERIFIED` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` |
| `registry-unavailable` | `VALID` | `CURRENT` | `UNKNOWN` | `TRUSTED` |

These are independent cryptographic, temporal, revocation, and trust findings.
The unknown-issuer token is cryptographically signed by the known synthetic key
but claims an unregistered issuer; A02 reports `NOT_VERIFIED` because the
registry cannot establish issuer trust.
The demo reports no payment settlement, recipient identity, or eligibility
finding. Unknown or missing revocation records become `UNAVAILABLE`; they are
not treated as active. Registry outages remain distinct from unknown records.

## Backend integration example

```ts
const result = await verifyNoticeForCase(token, trustedIssuerRegistry, nowSeconds);
const noticeFindings = result.findings;
const trustFinding = result.issuer; // retain separately; not payment or signature proof
```

Production code must receive `trustedIssuerRegistry` from a server-owned
composition root. Never instantiate this synthetic registry with notice-supplied
key material, issuer trust, or URLs. A02 resolves only a `kid` against its
registry interface and verifies the original compact JWS signing input.

## Taha's persistent-registry requirements

The backend owner must supply an authorized, durable implementation of
`TrustedIssuerRegistry` using the project's chosen existing persistence and
secret/key infrastructure. A02 expects:

- `resolveKey(kid)`: public Ed25519 key, owning issuer ID, key trust state, and
  monotonically versioned source record; distinguish unknown key, unavailable
  source, revoked key, and untrusted key.
- `resolveIssuer(issuerId)`: active/revoked state and source version; unknown
  issuer and unavailable source remain distinct.
- `resolveNotice(issuerId, noticeId)`: active/revoked state and source version;
  missing revocation state must be defined by the durable registry owner and
  must not silently become active. This synthetic adapter returns unavailable
  when no explicit notice record exists.
- Atomic ownership checks tying each `kid` to its issuer, and an issuer-side
  uniqueness constraint for notice IDs before signing. A02 does not provide
  persistence, migrations, signing-key storage, authorization, or API routes.

The current repository has no production issuer/key/revocation persistence
implementation. Until Taha provides it, the synthetic registry must not be
used to make real issuer trust claims. This task does not change Case creation,
Assessment persistence, authorization, consent, migrations, or payment/identity
services.
