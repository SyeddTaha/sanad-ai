# B03: Case and Evidence Passport persistence

Branch `feat/cases-evidence`, clean baseline `5587ab6` (merged PR #4).
On 21 November 2026 the human owner approved the bounded endpoint compositions,
draft GET/PATCH, and an explicit unavailable rule basis. Frozen `src/contracts/v1`
exports are unchanged. The official Markdown brief, glossary, six ADRs and
canonical specification govern the implementation.

## HTTP integration

Browser-safe schemas/types: `@/lib/case-contract`; reuse `@/contracts/v1` for Case,
Assessment, Passport and errors. Use B01's HttpOnly cookie or human Bearer JWT.
All writes require JSON, `Idempotency-Key` matching `[A-Za-z0-9_-]{1,128}` and
same-origin protection for cookies. Responses use `{data,requestId}` or the
frozen error envelope, `Cache-Control: private, no-store` and
`Vary: Cookie, Authorization`.

| Method/path relative to `/api/v1` | Request | Response data / authority |
| --- | --- | --- |
| `POST /case-drafts` (B02) | `{}` | 201 owner-bound reservation; Citizen only. |
| `GET /case-drafts/{caseId}` | UUID | 200 `CaseDraft`; `READ_EVIDENCE`. Submitted drafts return 409. |
| `PATCH /case-drafts/{caseId}` | `{expectedVersion,noticeToken,messageText,disputeText,relatedCaseId}` | 200 saved `CaseDraft`; `WRITE_DRAFT`. Full replacement, explicit nulls. |
| `POST /cases` | `{caseId,expectedDraftVersion}` | 201 frozen `Case`; `SUBMIT_CASE`. Retains reserved ID and Citizen. |
| `GET /cases/{caseId}` | UUID | 200 frozen `Case` metadata; `READ_CASE`. No embedded evidence. |
| `GET /cases/{caseId}/history` | Optional UUID `cursor`, decimal `limit` (default 20, max 100) | 200 `{items:CaseEvent[],nextCursor}`; `READ_CASE`. Includes B02 reservation/consent and B03 workflow events. |
| `POST /cases/{caseId}/evidence` | `{expectedVersion,kind,content,supersedesId}` | 201 `{evidence,caseVersion,evidenceVersion}`; `ADD_EVIDENCE`. |
| `POST /cases/{caseId}/assessments` | `{expectedEvidenceVersion,includeAi}` | 201 frozen `Assessment`; both `REQUEST_ASSESSMENT` and `READ_EVIDENCE`. Supports reserved pre-submission targets. |
| `GET /cases/{caseId}/evidence-passport` | Optional UUID `assessmentId`, otherwise latest | 200 frozen `EvidencePassport`; `READ_EVIDENCE`. Case status is independently nullable before submission and current afterward. |
| `GET /cases/{caseId}/assessments/{assessmentId}/trace` | UUIDs | 200 frozen `Assessment` with evidence/source refs and rule/AI provenance; `READ_EVIDENCE`. |

Exports include request schemas, `DraftResponseSchema`, `CaseResponseSchema`,
`HistoryResponseSchema`, `AddEvidenceResponseSchema`, `AssessmentResponseSchema`
and `PassportResponseSchema`. No client field can supply an owner, author,
timestamp, finding, source snapshot, rule reference, AI result or status.

Notice tokens are opaque input limited to 8,192 characters, not a claim of valid
JWS. Message text is limited to 16,384; disputes/statements to 2,000. Bodies are
streamed, bounded to 64 KiB/five seconds, and authenticated/validated before DB
locks. Clear optional text with null; non-null disputes must be meaningful.

Evidence kinds: `NOTICE_INPUT` with `{noticeToken,messageText}`,
`CITIZEN_STATEMENT` with `{text}`, and `CORRECTION` with `{text}` and a required
same-Case `supersedesId`. Other kinds use `supersedesId:null`. Corrections never
edit authoritative source records. Client `SOURCE_SNAPSHOT` writes are rejected.

Submission needs saved nonempty input and the current draft revision. Active
department review sharing produces `SUBMITTED`; otherwise `PENDING_CONSENT`.
B02 defines the required purpose/actions and independently handles sharing
expiry, withdrawal and restoration. After submission, add evidence through the
evidence endpoint. `RESOLVED`/`CLOSED` reject evidence changes; further disputes
use a new reservation linked to an authorized same-Citizen Case. Staff workflow
transitions/resolution remain B04.

## Authorization, retries and errors

All protected work uses B01/B02's `inAuthorizationTransaction`,
`loadAuthorization`, `authorize`, `reconcileConsentStatus` and minimal audit.
Complete server-selected helper/department/audit permission paths are evaluated
independently; partial permissions from different roles never combine. Admins
have no automatic private access. SQL uses the same transaction connection.

Lock order remains catalogs/session, reservation `FOR UPDATE`, protected work
and audit, fresh permission check, commit. Concurrent writes serialize and
stale expected revisions fail. If withdrawal commits first, waiting requests
deny; if a protected write holds the lock first, it commits before withdrawal.
Evidence, versions, replay records, Case events and success audit roll back
together. No external calls occur under database locks.

Mutation keys bind actor, target, operation and canonical validated payload.
Identical retries return original content/status/versions with a new request ID;
a GET obtains current state. Draft/evidence/Assessment outcomes store immutable
references and original revisions. Submission stores original Case metadata,
never raw evidence. Failed operations consume no successful key. The reserved
Case primary key independently prevents duplicate submission under another key.
All replays recheck current authentication, roles, ownership/delegation and
consent. An Assessment replay that originally used processing consent checks it
again. Keys are retained throughout the prototype/demo; no cleanup policy is added.

Errors use the frozen status mapping: 400 malformed transport/key; 401 invalid
authentication; 403 authorization failure; 404 an authorized absent resource;
422 malformed schema or invalid link/correction. Foreign and nonexistent
reservation targets have identical denial. Stale revisions are 409
`STALE_VERSION`, stale Assessment inputs `STALE_ASSESSMENT`, terminal writes or
non-replay repeated submission `INVALID_TRANSITION`, changed keyed payload
`IDEMPOTENCY_CONFLICT`. Oversized JSON is 413; non-JSON writes 415; operational
failures are sanitized retryable 503. Errors never echo evidence or exceptions.

## Evidence and integration boundaries

B03 has **no crypto, identity, payment, program-data or AI adapter**. Production
code never imports successful contract fixtures. Signature stays `NOT_VERIFIED`;
expiry, revocation, recipient matching, payment and eligibility stay `UNKNOWN`.
Unavailable sources and missing token/rules/contradiction checks are explicit.
An empty contradiction list does not establish agreement: no comparison ran.

Immutable `assessment_rule_bases` record
`b3000000-0000-4000-8000-000000000001` has availability `UNAVAILABLE`, version 1.
The owner approved this opaque ID in the required `ruleVersionId` field. It is
**not a published RuleVersion**, contains no thresholds and makes no eligibility
judgment. Source provenance identifies the basis; `missingEvidence` includes
`rule_basis_unavailable`. Do not parse it as `RuleVersionSchema` or use a B03
fallback Assessment for resolution. Future integrations create new Assessments
with real published rules; this earlier basis/history remains unchanged.

`includeAi:false` or absent processing consent yields `NOT_AUTHORIZED` and null
run/model/prompt/advisory values. Explicit consent plus `includeAi:true` yields
`UNAVAILABLE`, `provider_not_configured` and null run/version/confidence values.
No provider request or canned success occurs. Future adapters must validate
output, preserve deterministic findings, use B02's consent boundary before
inputs/output, and keep network calls outside authorization transactions.

## Persistence and setup

| Additive migration | Purpose |
| --- | --- |
| `20261121000400_case_evidence.sql` | Immutable evidence, Assessments, same-Case evidence refs, source observations and Case events; RLS/privileges/indexes. |
| `20261121000500_case_operation_keys.sql` | Protected append-only mutation hashes and original outcomes/references. |
| `20261121000600_case_inputs_and_basis.sql` | Draft pointers/revisions, approved unavailable basis, stronger Assessment identifier checks. |
| `20261121000700_case_input_guards.sql` | Reservation locks on B03 SQL writes; draft revision/ownership invariants; submitted input guards. |

Existing Case/reservation/consent/audit tables remain authoritative. Draft
storage references immutable evidence rather than copying raw content into a
second history store. Changed saves advance draft/evidence revisions; unchanged
saves retain them. Assessments preserve exact input/source manifests, timestamps,
contradictions, missing evidence and AI provenance. New evidence never changes
an earlier Assessment. SQL triggers prohibit history edits/deletes. Direct
`anon`, `authenticated` and `service_role` access to new private tables is denied.

Use existing ignored development environment/CA/demo credentials from
[B01](backend-foundation.md). No new secrets are needed:

```sh
npm ci
npm run db:migrate
npm run db:seed
npm run test:contracts
npm run test:backend
npm run typecheck
npm run lint
npm run build
npm run start -- --port 3300
# Another terminal; optional B03_BASE_URL overrides http://localhost:3300
npm run test:b03:live
```

The live suite uses real Supabase Auth/PostgreSQL and production HTTP. It retains
synthetic immutable Case/evidence history and logs out its sessions. Its rollback
test temporarily installs a trigger scoped to its synthetic Case, removed in
`finally`; run on development only. Embedded tests use PGlite PostgreSQL and
mock Auth only at the external fetch boundary; those are not hosted evidence.

Results and review: [B03 verification](b03-verification.md). Public deployment,
browser/audio acceptance, real crypto/AI/mocks, published rules, API keys and
officer workflow remain separate gates. Stop here; B03 does not authorize B04.
