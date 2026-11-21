# B02: server-side RBAC and scoped consent

Task baseline: `4b3cd42` (merged B01). Branch: `feat/rbac-consent`.
The owner-designated [official Markdown brief](brief/AI_Hackathon_Problem_Statement.md)
governs this work. Frozen `src/contracts/v1` exports remain unchanged. B02 adds
small endpoint compositions in `src/lib/consent-contract.ts`, as authorized by
the backend owner. B03 submission/evidence persistence and B04 resolution remain deferred.

## Public HTTP operations

Imports for browser-safe schemas and constants: `@/lib/consent-contract`.
Use B01's verified HttpOnly cookie or human Bearer JWT. Cookie mutations require
the same `Origin`; all mutations require `Content-Type: application/json` and
`Idempotency-Key` matching `[A-Za-z0-9_-]{1,128}`. Conflicting credentials fail.
API-key authentication remains B05; `X-API-Key` is rejected by B01.

Every response has `{ data, requestId }` or the frozen `{ requestId, error }`
envelope. Sensitive responses include `Cache-Control: private, no-store`.

| Method/path | Request schema | Response data | Required authority |
| --- | --- | --- | --- |
| `POST /api/v1/case-drafts` | `ReserveCaseRequestSchema`: `{}` | 201 `CaseReservationSchema`: `{caseId,citizenId,version:1,createdAt}` | Active human CITIZEN; server derives owner and ID. Reservation only, no draft content or submitted Case. |
| `GET /api/v1/cases/{caseId}/consents` | UUID path; no body | 200 `{items: ConsentGrant[],nextCursor:null}` | Active human CITIZEN owning reservation, including before submission. Includes revoked/expired history. |
| `POST /api/v1/cases/{caseId}/consents` | `CreateConsentRequestSchema`: `{recipientType,recipientId,purpose,actions,expiresAt}` | 201 `ConsentGrant` | Citizen owner confirmation using their own authenticated request. |
| `POST /api/v1/consents/{grantId}/revoke` | UUID path; `RevokeConsentRequestSchema`: `{expectedVersion}` | 200 revoked `ConsentGrant` | Citizen grantor; matching version, not already revoked. |

Response schemas are `CaseReservationResponseSchema`, `ConsentResponseSchema`,
and `ConsentListResponseSchema`. ConsentGrant is the unchanged frozen v1 record:
`{id,caseId,grantorCitizenId,recipientType,recipientId,purpose,actions,expiresAt,
revokedAt,createdAt,version}`. Times use UTC ISO timestamps; IDs are UUIDs.
No body may specify actor, citizen ID, grants, roles, timestamps of creation or version.

| Error | HTTP | Trigger |
| --- | --- | --- |
| `MALFORMED_REQUEST` | 400 | Bad JSON, missing/invalid idempotency key, conflicting credential schemes. |
| `UNAUTHENTICATED` / `INVALID_API_KEY` | 401 | Missing/invalid/expired/revoked human session, or API-key scheme before B05. |
| `FORBIDDEN` | 403 | Inactive/roleless principal, foreign or nonexistent target, non-Citizen consent operation, failed cookie CSRF. |
| `CONSENT_REQUIRED` | 403 | Protected delegated access lacks applicable live consent/action/assignment. |
| `INSUFFICIENT_SCOPE` | 403 | Policy evaluation with insufficient verified API scopes; B05 authentication not exposed. |
| `STALE_VERSION` | 409 | Revoke expectedVersion differs from current grant. |
| `INVALID_TRANSITION` | 409 | Attempt to revoke an already-revoked grant with a new mutation key and current version. |
| `IDEMPOTENCY_CONFLICT` | 409 | Same actor/operation/target/key with different validated payload. |
| `PAYLOAD_TOO_LARGE` / `UNSUPPORTED_MEDIA_TYPE` | 413 / 415 | Body exceeds 8192 streamed bytes or non-JSON mutation. |
| `VALIDATION_FAILED` | 422 | Invalid schema/UUID, unknown purpose/recipient, incompatible or duplicate actions, expiry not in future. |
| `RATE_LIMITED` / `SERVICE_UNAVAILABLE` | 429 / 503 | Auth rate limit or provider/DB/locking/audit failure. Details are sanitized. |

Foreign and nonexistent targets return the same denial. Owner checks run before
idempotent replay; replay storage contains only B02 reservation/grant records,
never evidence. Identical successful retries return their original data and status
with a new requestId. Failed transactions do not consume the key.

## Purpose disclosures and permission matrix

These are the complete server-controlled operational purposes. UI must disclose
recipient, purpose, selected actions and expiry before Citizen confirmation;
sharing choices start unselected. Values retain the existing synthetic fixture vocabulary.

| Purpose | Recipient | Disclosed use / permissible actions |
| --- | --- | --- |
| `synthetic_helper_assistance` | `PRINCIPAL`, active HELPER | Assist this Citizen's reserved Case: `READ_CASE`, `READ_EVIDENCE`, `WRITE_DRAFT`, `ADD_EVIDENCE`, `SUBMIT_CASE`, `REQUEST_ASSESSMENT`. |
| `synthetic_department_review` | Existing `DEPARTMENT` | Departmental review: `READ_CASE`, `READ_EVIDENCE`, `REQUEST_ASSESSMENT`, `REVIEW_CASE`, `RESOLVE_CASE`, `CLOSE_CASE`, `ASSIGN_CASE`, `ESCALATE_CASE`, each subject to actor role and assignment. |
| `synthetic_audit_review` | `PRINCIPAL`, active AUDITOR | Read this Case's protected audit inputs/evidence: `READ_CASE`, `READ_EVIDENCE`; no mutation. |
| `synthetic_ai_assistance` | Registered `AI_PROCESSOR` | Process disclosed scoped input for extraction, classification and explanations: `PROCESS_AI` only. |

`SANAD_AI_PROCESSOR_ID` is `a1000000-0000-4000-8000-000000000001`, the fixed registry
entry for the AI module's configured adapter. It is an authorization identifier,
not a claim of implemented AI. Other processor IDs are rejected. Any provider
change needs a reviewed disclosure; the adapter must not choose a different
processor to bypass consent. Expiry is mandatory and must be in the future.

| Actor | Boundary |
| --- | --- |
| CITIZEN | Own reservation/case only; read Case/evidence, draft/add evidence, submit, request assessment; manage own consent. Ownership does not grant review/resolve/close/dispatch. |
| HELPER | Named principal grant, helper purpose, requested action AND helper role permission. Never grant themselves access, resolve or close. |
| OFFICER | Assigned officer AND explicit assigned department AND current membership in that department AND active department grant for requested action. Cannot use helper grants for officer powers. |
| ADMIN | No automatic private Case/evidence access. `ASSIGN_CASE` requires department membership and an active department grant containing that action. B04 must project only opaque Case ID/status/priority/version for dispatch. Administrative management routes remain their assigned tasks. |
| AUDITOR | Minimal retained audit metadata is a separate read-only boundary for B04. Private Case/evidence reads require a named principal audit-purpose grant. No mutations from audit grants. |
| SERVICE (future B05) | Verified API scopes intersect with role/grant/assignment; absent scopes deny. Cannot become a Citizen confirmation. B02's HTTP path accepts humans only. |
| AI processing | Independent processor grant AND current initiating `READ_EVIDENCE` and `REQUEST_ASSESSMENT` permission; API scopes must cover all three if present. |

Multiple roles are evaluated through complete individual permission paths. A
helper action grant cannot combine with an unrelated officer/admin role to resolve.

## Backend integration

Primary request boundary: `@/backend/authorization/service` → `withAuthorizedCase`.
It invokes B01 principal verification, opens a transaction, reloads server roles,
active status and session, locks the reservation, loads assignment/memberships/
grants, uses database time, audits the decision, and rechecks before commit.
The pure evaluator `authorize` from `@/backend/authorization/policy` accepts
trusted server context only. Never parse an AuthorizationContext from HTTP input.

```ts
import { withAuthorizedCase } from "@/backend/authorization/service";

const result = await withAuthorizedCase(request, {
  caseId, action: "ADD_EVIDENCE", purpose: "synthetic_helper_assistance",
}, async (tx) => {
  // B03 supplies validated evidence SQL, expectedVersion checks and output DTO.
  // Use tx.db for ALL SQL, including protected idempotent-result retrieval.
  // An error rolls back the write and its ALLOWED audit together.
  return saveValidatedEvidence(tx.db, input);
});
```

Staff integrations use `purpose: "synthetic_department_review"`; audit evidence
uses `synthetic_audit_review`. Purpose/action are selected by server workflow,
never copied from role headers or unvalidated caller context. B04 assignment
must set both `assigned_officer_id` and `assigned_department_id`; missing explicit
department fails closed. Assignment/status writes must use the same lock protocol.
The wrapper rechecks after work, so B04 operations that intentionally transfer
assignment must use the lower transaction boundary to check authority immediately
before that transfer and commit the transition/audit atomically.

For compound future workflows, import `inAuthorizationTransaction`, `lockTarget`,
`audit`, and `Transaction` from `@/backend/authorization/transaction`, then
`loadAuthorization`/`reconcileConsentStatus` from the service and `authorize`
from policy. Recheck ALL requested permissions inside that transaction before
writing/replaying, deny explicitly, and preserve minimum audit events.
No external AI/network work inside the database transaction.

AI modules run `withAuthorizedCase` with `action: "PROCESS_AI"`, their initiating
workflow purpose, and server-selected `processorId: SANAD_AI_PROCESSOR_ID` before
reading inputs and AGAIN before persisting/delivering output. Release the first
transaction before calling the provider. Discard output after revocation.
Previously delivered data and a provider request already sent cannot be recalled.

## Transactions, revocation and case status

Lock order: begin READ COMMITTED → shared locks on profiles/role assignments/
department memberships → shared Auth-session row lock → reservation row FOR UPDATE
→ optional mutation-key advisory lock → consent/Case updates and audit → commit.
Shared catalog locks prevent concurrent role/membership inserts/removals; this
small prototype trades catalog-write concurrency for clear permission safety.
Future admin writers must follow that ordering. Database triggers additionally
lock reservations for Case/grant SQL changes and reject redefinition of existing
grants. Revoke then create to narrow sharing. Never edit applied migrations.

Withdrawal and protected writes serialize on the reservation. If withdrawal
commits first, the waiting writer reloads revoked grants and denies. If a
protected write acquires the lock first, it commits before withdrawal; later
writes deny. A second time-sensitive permission check prevents expiry during
work from committing a protected mutation. No previous-request permission cache.

A valid department review authorization contains `READ_CASE`, `READ_EVIDENCE`
and `REVIEW_CASE` in one live grant for the assigned department (or any authorized
department before assignment). Read-only partial sharing does not start review.
When none remains, applicable open Cases become `PENDING_CONSENT`; restoration
returns pending Cases to `SUBMITTED`, requiring fresh review. Independent valid
grants keep review authorized. Helper grants never substitute for department grants.
`RESOLVED` and `CLOSED` remain unchanged. Consent mutations and authorized Case/
consent reads reconcile expired sharing lazily and append one interruption event;
access denies immediately regardless of recorded status. No expiry worker.

Client JSON streams are authenticated, bounded to 8192 bytes and five seconds,
and validated before opening a database transaction or acquiring locks.

Events: `CASE_RESERVED`, `CONSENT_GRANTED`, `CONSENT_WITHDRAWN`, `CONSENT_LIST`, `CONSENT_RETRY`,
`CONSENT_INTERRUPTED`, `CONSENT_RESTORED`, requested protected action decisions,
and sanitized failed/denied consent attempts. Records hold actor, action, outcome,
request ID, timestamp and optional opaque target/grant reference. No private
evidence, prompts, tokens, passwords or request bodies enter audit records.
Mutation, status and success events are atomic; after rollback, a minimal failure
event is appended independently. Audit unavailability fails the operation closed.

## Verification and B03 gate

Migration `20261121000300_rbac_consent.sql` is applied to the designated development
Supabase and repeat application reports current. Browser database roles remain
denied; B02 adds no permissive RLS or service-role Case-table access.

Executed evidence and review results are recorded in [B02 verification](b02-verification.md).
Run `npm run test:b02:live` against a production server on localhost:3200, with
B01's ignored environment credentials. Set `B02_BASE_URL` to override. Run B01 and
B02 live suites sequentially because B01 temporarily changes demo profile activity.
Tests clean up their synthetic Cases, grants and replay keys, retain minimal audit
history, and sign out test sessions.

Citizen/helper UI can now reserve IDs, show grant history and separately confirm/
withdraw helper, department and AI sharing. Staff UI must not fetch private
unassigned evidence. B03 can persist draft/evidence/submission using this boundary;
it must preserve owner IDs, lock/version checks, consent checks on replay and its
own transactional audit. No B03 implementation is included. Public deployment,
browser/audio validation and full evidence HTTP endpoints remain later gates.
