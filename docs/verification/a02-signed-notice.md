# A02 signed notice module

The server-only module in `src/backend/notices/signed-notice.ts` signs payloads
validated by the frozen `SignedNoticePayloadSchema` and verifies compact JWS
tokens with the exact `Ed25519` algorithm identifier. Verification uses the
original compact token through `jose` and never rebuilds the signing input.
Headers and payloads reject duplicate JSON members before parsing.

Verification returns the shared signature, expiry, and notice-revocation
finding types plus an internal issuer-trust finding. It does not expose a
payment or eligibility result. Unknown/revoked/unavailable keys and issuers
remain distinct from a cryptographically invalid signature. Finding reasons,
source references, timestamps, and error codes are deterministic; no LLM
participates.

## Required production adapters

- Implement `NoticeSigningKeyProvider` with server-side, non-extractable
  Ed25519 private keys, selecting a key for the requested issuer. Never return
  private key material in a response or log.
- Implement `TrustedIssuerRegistry` against the server-controlled registry.
  Preserve distinct unknown, untrusted, revoked, and unavailable states, and
  return the registry source versions used for findings. Do not fetch any
  notice-supplied key or URL.
- Supply `verifySignedNotice` with server time in UTC epoch seconds.
- Enforce global notice-ID uniqueness in the issuer persistence flow before
  signing. This module does not add persistence or migrations.
- Keep API routes, authorization, payment lookup, recipient matching, and
  eligibility evaluation in their owning backend services. A valid signature
  is not payment confirmation or eligibility.

No public route, database schema, shared contract, or signing-key storage
provider is added by A02.

## Verification

Focused command:

```sh
node --conditions=react-server --import tsx --test src/backend/notices/signed-notice.test.ts
```

Recorded result: 15 passed, 0 failed.

Additional checks:

| Command | Result |
| --- | --- |
| `node --conditions=react-server --import tsx --test spikes/ai-trust/crypto/verify-notice.test.ts` | 12 passed, 0 failed |
| `npm run test:contracts` | 25 passed, 0 failed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed without diagnostics |
| `npm run build` | Passed |
| `git diff --check` | Passed |

The module tests use synthetic Ed25519 keys and isolated registry adapters.
They do not verify a production registry, persistent notice-ID uniqueness,
secret-store configuration, or API integration.
