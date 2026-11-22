# B05: Public REST API, scoped API keys and OpenAPI

Branch: `feat/public-api`. Baseline: `d31994f` (merged B04 PR #11).
The official Markdown brief, SPEC and ADRs 0001–0006 govern this work.
Frozen `src/contracts/v1` exports are unchanged. B05 endpoint compositions are
in `src/lib/api-key-contract.ts`; existing B01–B04 application services own the workflows.

Machine-readable OpenAPI 3.1 JSON: **`GET /api/v1/openapi`** (public).
Request/response JSON Schemas come from the same Zod definitions used by the
handlers. Semantic refinements, purpose compatibility, expiry, meaningful text
and transactional freshness remain server checks. The offline test validates
the document and compares every documented method/path with actual route exports.

## Credential management

Use a verified human Bearer JWT or B01 HttpOnly session cookie. Use only one
credential scheme per request. Cookie writes require matching `Origin`.
All three management operations reject API-key authentication, including an
Admin key; an Admin cannot manage someone else's credentials.

| Method/path | Request | Response data |
| --- | --- | --- |
| `POST /api/v1/api-keys` | `{name,scopes,expiresAt}` plus `Idempotency-Key` | 201 `{credential:ApiKeyMetadata,key:string}` on first commit. Identical retry: 200 with `key:null` and original metadata. |
| `GET /api/v1/api-keys` | Optional `cursor` UUID, `limit` 1–100 (default 20) | `{items:ApiKeyMetadata[],nextCursor}`; own metadata, including expired/revoked history. |
| `POST /api/v1/api-keys/{keyId}/revoke` | `{}` plus `Idempotency-Key` | 200 revoked `ApiKeyMetadata`; repeat revocation is safe. |

Metadata: `{id,principalId,name,scopes,expiresAt,revokedAt,createdAt}`.
No read/retry/revoke response contains the secret or its hash. Issuance uses
32 cryptographically random bytes (`sanad_` plus base64url), stores only SHA-256,
and requires future expiry within 30 days. No credential is refreshed or edited.
After a lost issuance response, list metadata, revoke that credential and issue
another using a new idempotency key; plaintext cannot be recovered.

The credential acts as **SERVICE**, bound to its issuing profile ID. Current
roles, activity and department membership are loaded from the server on every
request. It does not impersonate a human Citizen confirmation. Separate
arbitrary service-account provisioning is outside this minimal surface.

| Current issuing role | Maximum scopes |
| --- | --- |
| CITIZEN alone | None; cannot issue a privileged service credential. |
| HELPER | `READ_CASE`, `READ_EVIDENCE`, `WRITE_DRAFT`, `ADD_EVIDENCE`, `SUBMIT_CASE`, `REQUEST_ASSESSMENT`, `PROCESS_AI` |
| OFFICER | `READ_CASE`, `READ_EVIDENCE`, `REQUEST_ASSESSMENT`, `REVIEW_CASE`, `RESOLVE_CASE`, `CLOSE_CASE`, `ESCALATE_CASE`, `PROCESS_AI` |
| ADMIN | `ASSIGN_CASE` |
| AUDITOR | `READ_CASE`, `READ_EVIDENCE` |

Issuance cannot exceed the union of current role ceilings. Runtime effective
scopes intersect stored scopes with current ceilings; role changes cannot add
new scopes to an existing key. Complete B02 permission paths still apply.

## Public workflow surface

Send `X-API-Key: <one-time-issued credential>`. Keys are accepted on existing
draft GET/PATCH, Case submission/detail/history, evidence GET/POST,
Assessment creation/trace, Evidence Passport, decisions, case-scoped synthetic
program-input reads, officer queue, Admin dispatch, assignment/priority and
officer start-review/request-evidence/escalate/resolve/close/resubmit operations.
OpenAPI specifies each operation's `x-api-key-scopes`; the officer queue requires
both `READ_CASE` and `READ_EVIDENCE`, resolution additionally requires
`REQUEST_ASSESSMENT`, and optional AI requires separate `PROCESS_AI` scope/consent.

The existing Citizen reservation and all consent operations remain verified
human-only. Login/logout/session, audit-metadata and rule publication/read
operations also retain their B01–B04 human boundary and are documented as such.
API keys add no permission to those routes. An Auditor key needs the independent
named audit grant for evidence; an Admin key has no private evidence access.

Ownership, assigned officer, explicit department, membership, compatible grant
purpose/actions, current consent and role remain mandatory. A HELPER key needs
a named grant to that issuing profile for each Case. An OFFICER key uses that
profile's actual assignment and active department sharing. Withdrawing consent
denies the next request, including retrieval of an idempotent earlier result.

JSON writes require `Content-Type: application/json` and
`Idempotency-Key: [A-Za-z0-9_-]{1,128}`. B02/B04/key bodies are bounded to 8 KiB;
B03 input bodies to 64 KiB, with a five-second stream deadline. B01 login has
its existing 4 KiB limit and Origin requirement. Expected revisions and workflow
semantics remain in [B03](b03-cases-evidence.md) and [B04](b04-officer-rules.md).
All private responses use `Cache-Control: private, no-store` and
`Vary: Cookie, Authorization, X-API-Key`.

| HTTP | Shared error codes / meaning |
| --- | --- |
| 400 | `MALFORMED_REQUEST`: conflicting credentials, bad JSON or mutation key. |
| 401 | `UNAUTHENTICATED` or `INVALID_API_KEY`: absent, invalid, expired or revoked authentication. |
| 403 | `INSUFFICIENT_SCOPE`, `CONSENT_REQUIRED`, `FORBIDDEN`: capability, role, owner, assignment, department or consent denial. |
| 404 | `NOT_FOUND`: authorized resource is absent. Foreign targets remain indistinguishable from unauthorized absent targets. |
| 409 | `IDEMPOTENCY_CONFLICT`, `STALE_VERSION`, `STALE_ASSESSMENT`, `INVALID_TRANSITION`: changed payload or workflow basis. |
| 413 / 415 / 422 | Bounded body exceeded / non-JSON body / schema or server semantic validation failure. |
| 429 / 503 | Existing provider throttling / sanitized database, locking, Auth or audit failure. |

Errors retain `{requestId,error:{code,messageKey,fieldErrors:[],retryable}}`.
They never echo credentials, personal evidence or exception details.

## Persistence, audit and races

Additive migration `20261122001100_scoped_api_keys.sql` creates the private,
RLS-enabled credential table, hash uniqueness, expiry constraints and immutable
history guard. `anon`, `authenticated` and `service_role` cannot read it.
Only the existing trusted application SQL connection accesses credentials.

Authentication first checks the credential without holding locks, before
consuming client JSON. Under the existing authorization transaction, lock
catalogs, then the credential row `FOR SHARE`, then reservation/Case rows in
the established order. Recheck credential expiry before commit. Revocation
takes the credential row `FOR UPDATE`; it serializes with protected work.
If protected work owns the lock first, it finishes before revocation; subsequent
requests fail. If revocation wins first, waiting protected work fails. No
previous-request authentication or consent cache is used.

`API_KEY_ISSUED`, `API_KEY_LIST`, `API_KEY_REVOKED` and
`API_KEY_AUTHENTICATED` retain only actor/request/action/outcome and opaque
credential references. Protected application mutations keep their existing
atomic audit. Secrets never enter audit or idempotency result storage.
Credential history and the hash are retained; no production retention/rotation
job or API-key rate limiter is added by this prototype.

## Missing mock dependency and limits

At baseline `d31994f`, Developer 2's crypto/AI/registry adapters are merged, but
there are **no identity, payment or general program-data mock adapters** to expose.
B04 `synthetic_program_inputs` is a case-scoped source history, not those APIs.
B05 does not duplicate the missing adapters or claim mock REST integrations.
Their eventual boundary must preserve `FOUND`, `NOT_FOUND`, `AMBIGUOUS` and
`UNAVAILABLE` separately from payment/eligibility findings. No real government
or banking integration is claimed.

Existing B03/B04 Assessment behavior remains explicit about unavailable
crypto/payment/AI sources. The separate adapters are not wired by B05.
Public-host deployment and browser/audio acceptance retain their separate gates.

## Verification and curl demonstration

Use the existing ignored development environment and CA; no new secrets:

```sh
npm run db:migrate
npm run db:seed
npm run test:contracts
npm run test:backend
npm run typecheck
npm run lint
npm run build
npm run start -- --port 3500
# A second terminal, same environment; defaults to localhost:3500:
npm run test:b05:live
# Repeatable real curl flow; sets up its own synthetic Case/consent via HTTP:
npm run demo:b05
```

The live suite uses real Supabase Auth/PostgreSQL and production HTTP. It retains
synthetic immutable Case/evidence history, revokes created keys and logs out
its sessions. Run it and B01–B04 live suites sequentially on development only:
they share demo roles/memberships and the current synthetic policy.

The following Bash/curl example needs `jq`, an authenticated helper JWT in
`HELPER_JWT`, its active read grant on `CASE_ID`, and a future `EXPIRES_AT`
within 30 days. Use a Citizen's existing consent flow to establish that grant.
It captures the secret without printing it; run with shell tracing disabled.

```sh
BASE=http://localhost:3500
EXPIRES_AT=2026-11-22T12:00:00Z  # replace after this time
# 1. Issue; keep the response/secret in memory only.
issued=$(curl -fsS "$BASE/api/v1/api-keys" \
  -H "Authorization: Bearer $HELPER_JWT" \
  -H 'Content-Type: application/json' -H "Idempotency-Key: issue-$(date +%s)" \
  --data "$(jq -nc --arg expiry "$EXPIRES_AT" '{name:"Synthetic curl demo",scopes:["READ_CASE"],expiresAt:$expiry}')")
API_KEY=$(printf '%s' "$issued" | jq -er '.data.key')
KEY_ID=$(printf '%s' "$issued" | jq -er '.data.credential.id')
# 2. Authorized metadata: 200.
curl -sS -o /dev/null -w '%{http_code}\n' "$BASE/api/v1/cases/$CASE_ID" -H "X-API-Key: $API_KEY"
# 3. Missing READ_EVIDENCE: 403 INSUFFICIENT_SCOPE.
curl -sS "$BASE/api/v1/cases/$CASE_ID/evidence-passport" -H "X-API-Key: $API_KEY"
# 4. Issuing human revokes: 200, metadata only.
curl -fsS "$BASE/api/v1/api-keys/$KEY_ID/revoke" \
  -H "Authorization: Bearer $HELPER_JWT" -H 'Content-Type: application/json' \
  -H "Idempotency-Key: revoke-$KEY_ID" --data '{}'
# 5. Same formerly authorized request: 401 INVALID_API_KEY.
curl -sS "$BASE/api/v1/cases/$CASE_ID" -H "X-API-Key: $API_KEY"
unset API_KEY issued HELPER_JWT
```

Actual verification evidence and blockers are recorded in
[B05 verification](b05-verification.md). Stop at B05; no merge or next task is authorized.
