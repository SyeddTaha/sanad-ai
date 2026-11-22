# SANAD Complete Technical Guide

**Scope:** source-based handoff for the backend lead, written 22 November 2026. SANAD is a synthetic hackathon prototype, not a government, identity, banking, or payment service. Code is the implementation reference; the official brief has priority for product intent. Current deployment/verification evidence is in [`final-release-audit.md`](final-release-audit.md) and [`docs/verification/final-release-test-evidence.txt`](verification/final-release-test-evidence.txt).

## 1. Problem SANAD solves

SANAD addresses the trust and access gap around simulated public-relief notices and payment disputes. A recipient may receive a genuine, expired, altered, or fraudulent message; lack literacy or reliable connectivity; or need help from a community worker. The product model is evidence first: independently check what can be checked, show unknowns, gather a reviewable record, and let an authorized human resolve the Case. This framing comes from the [official challenge brief](brief/AI_Hackathon_Problem_Statement.md) and the detailed [SANAD handoff](brief/SANAD_Hackathon_Master_Handoff.md).

**It does not move money, confirm a real government payment, identify a real person, or issue an official eligibility decision.** Data services and program inputs are synthetic. Current payment finding is `UNKNOWN`; identity and general government-data mock APIs are not implemented. The code's `recipientMatch` field is a case-scoped synthetic source value, not a result from an identity authority.

## 2. Capabilities and limits

Implemented server capabilities include Supabase Auth-backed human sessions, five database-assigned roles, server-side authorization and consent, private Case drafts and immutable evidence/Assessment history, an Evidence Passport, six separate finding types, Ed25519 signed-notice validation, a server-owned versioned trusted-registry reader, an AI assessment service and orchestration, synthetic eligibility rules with immutable versions, Admin dispatch and Officer workflows, audit metadata, and a scoped public REST API with generated OpenAPI.

Important limits:

- Citizen integration is partial. Current source sends dispute drafts/submissions, Case/history/Passport loads, and consent grants/revocations to the API; the sample home/Passport/consent preview still uses fixtures, and the notice-check page explicitly does not send text. The browser report dated about 16:30 PKT does not identify an immutable application commit; its dispute attempt timed out, so the current connected path is **NOT VERIFIED** end to end. See [`browser-acceptance.md`](testing/browser-acceptance.md), [`citizen-screen.tsx`](../src/components/citizen/citizen-screen.tsx), and [`citizen-api.ts`](../src/components/citizen/citizen-api.ts).
- Public deployment remains **not ready**: the 11:58 PKT release audit reported SQL-backed API-key rejection, Officer queue, and Admin dispatch failures (12/16 HTTP probes passed; root plus those three failed at that time). A later ~16:30 PKT browser run saw root redirect and login work, but Citizen submission timed out and Officer/Admin pages stayed loading without queue responses. The observations are time- and probe-specific; they do not establish current hosted recovery. Local production smoke passed. Do not infer hosted availability from local tests.
- The current source has an assessment orchestration that calls the AI adapter when configured and assembles crypto findings, but the latest audit's live AI evaluation was skipped because credentials were absent. Do not claim that a live-provider Assessment was demonstrated.
- No mock payment lookup, standalone mock identity API, or general mock program API exists. There is only an append-only, case-scoped `synthetic_program_inputs` source.
- AI confidence is explicitly uncalibrated advisory data. It routes uncertainty to human review; it cannot make the signature, payment, identity, or eligibility finding authoritative.
- Low-literacy, Urdu audio, weak-network, offline synchronization, and safe shared-phone family switching are not demonstrated as complete end-to-end journeys. Audio helpers and local session isolation code exist, but the browser evidence does not prove operational acceptance.
- The persistent trusted registry can be read by assessment code, but no product-facing issuer onboarding, key-management, or notice-signing API is present. The CLI notice demo uses a fresh in-memory synthetic key and registry.

## Feature map: user action through persistence

This map makes the user-facing seam explicit. API methods are rooted at `/api/v1`; checks listed are server-side unless noted. The associated sections below explain their behavior in detail.

| Feature / problem addressed | User action | Frontend and API | Backend and tables | Key checks / failure cases |
|---|---|---|---|---|
| Authentication: establish a verified identity | Sign in, inspect session, sign out | [`login/page.tsx`](../src/app/login/page.tsx); `/auth/login`, `/session`, `/auth/logout` | [`backend/auth`](../src/backend/auth/); `profiles`, `role_assignments`, `department_memberships`, Supabase `auth.sessions`, `audit_events` | Invalid/expired/revoked session, inactive/no-role profile, cross-origin cookie mutation, Auth/SQL outage. |
| Citizen draft: save without submitting | Create/resume and save a draft | `/citizen/dispute`; `/case-drafts`, `/case-drafts/{id}` | `cases/drafts.ts`; `case_reservations`, `case_inputs`, `evidence_items`, `case_events` | Citizen owner derived from session; expected draft version; strict fields; idempotency; no submitted Case may be edited as a draft. |
| Submit Case: create a reviewable request | Submit saved text/evidence | `/citizen/dispute`; `/cases` POST | `cases/submission.ts`; `cases`, reservation/input/evidence/event tables | Nonempty draft, owner-bound reservation, expected draft revision; department sharing determines pending-consent state. |
| Consent: constrain who can see/work | Grant, list, or revoke recipient sharing | `/citizen/consent`; `/cases/{id}/consents`, `/consents/{grantId}/revoke` | `consent/http.ts`, `authorization/policy.ts`; `consent_grants`, `consent_operation_keys`, `audit_events` | Active recipient, compatible purpose/actions, future expiry, owner, expected version, revocation and expiry rechecked under locks. |
| Evidence/versioning: preserve corrections | Add evidence or correction | Citizen API methods; `/cases/{id}/evidence` | `cases/evidence.ts`; `evidence_items`, `cases.evidence_version`, `case_events` | Expected Case version, open status, valid same-Case superseded item, no client-provided authoritative source snapshot; append-only history. |
| Independent findings and Passport | Request Assessment or read Passport | `/citizen/case` live loader; `/cases/{id}/assessments`, `/evidence-passport` | `cases/assessments.ts`; `assessments`, `assessment_evidence`, `assessment_sources`, `case_events` | Evidence version and current rule/source snapshot; unknown remains unknown; no payment adapter; immutable Assessment. |
| Signed notice / issuer trust | Current UI cannot submit notice; backend verifier consumes token in Assessment | `/citizen/verify` currently sends no API; Assessment endpoint; no signing endpoint | `notices/signed-notice.ts`, `notices/database-registry.ts`; `trusted_registry_records`, Assessment/source tables | Exact Ed25519 only, trusted `kid`/issuer binding, duplicate member and embedded key rejection, expiry/revocation/unavailable remain separate. |
| AI classification | Optional processing of message text | AI option on Assessment API; current results view is sample-only | `cases/assessment-operation.ts`, `adapters/assessment-adapters.ts`, `ai/assessment.ts`; immutable `assessments` and audit metadata | Current PROCESS_AI consent and key scope; strict output schema; timeout/provider failures abstain; low confidence/suspicion routes to human; no financial authority. |
| Synthetic eligibility rules | Admin edits and publishes bounded policy | `/staff/admin`; `/rules/current`, `/rules/{id}`, `/rules/publish` | `rules/http.ts`, `rules/service.ts`, `rules/eligibility.ts`; `rule_versions`, `rule_publication`, `synthetic_program_inputs` | Admin only to publish; allowed `program_demo` parameters; expected current version; historical versions immutable; unknown input → UNKNOWN. |
| Admin dispatch | Assign/reassign or set priority | `/staff/admin`; `/admin/dispatch`, `/admin/officers`, Case `/assign` and `/priority` | `officers/http.ts`, `officers/workflow.ts`; `cases`, `department_memberships`, `case_decisions`, `case_events` | Admin department membership, active Officer in same department, expected version/reason; metadata only, not evidence. |
| Officer review and resolution | Start review, request proof, escalate, resolve, close | `/staff/officer`, `/staff/officer/cases/{id}`; queue and nested Case action APIs | `officers/http.ts`, `officers/resolution.ts`; `cases`, `case_decisions`, `case_events`, Assessment/rule/source tables | Assigned officer, current department consent, transition/reason/version checks; resolution freshness and atomic audit. |
| Auditor trace | Read audit events or explicitly shared Assessment | No Auditor page; `/audit?caseId=...`, protected Case trace | `officers/reads.ts`, `cases/http.ts`; `audit_events`, Case/evidence/Assessment history | AUDITOR role for metadata; separate audit-purpose consent for evidence; pagination; no raw prompts/credentials. |
| API keys | Issue, use, list, revoke a service capability | No key-management page; `/api-keys`, `X-API-Key` on documented operations | `api-keys/http.ts`, `api-keys/auth.ts`; `api_keys`, audit events | Role ceiling, hash-only persistence, <=30 day expiry, current issuer roles, scope + normal consent, serial revoke. |
| Public REST contract | Inspect machine-readable operations | `GET /openapi` | `openapi/document.ts`, `openapi/operations.ts`; generated from Zod schemas | Document describes source operations; semantic/server authorization checks exceed JSON schema. Hosted SQL failures still apply to private operations. |

## 3. Architecture and stack

One Next.js application contains the App Router pages, REST route handlers, server-only domain services, contracts, and shared browser clients. It is TypeScript, Next.js 16.4.6, React 19, Zod 4, Supabase Auth, PostgreSQL via `pg`, and `jose` for JWS. The runtime is not a collection of microservices: browser requests go to `/api/v1`; route handlers compose server-only services; protected database work runs in PostgreSQL transactions. Supabase Auth validates identities/session JWTs, while a narrow SQL function binds the verified token's session to active database roles and departments.

Production intent is Vercel hosting the Next.js build, with Supabase Auth and PostgreSQL as managed services. The server needs `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, runtime `SUPABASE_STRING`, and where required a trusted `SUPABASE_DB_CA_PEM` or CA file. Browser-visible `NEXT_PUBLIC_*` variables are only the Supabase URL and publishable key. Never put private values in source, browser configuration, or this guide. Remote PostgreSQL TLS verification is enabled in [`scripts/database.ts`](../scripts/database.ts). The hosted runtime SQL path failed in the latest audit; this is an architecture target and not a claim that the current hosted deployment is healthy. See [`deployment.md`](deployment.md).

## 4. Database model and relationships

Migrations are ordered in [`supabase/migrations/`](../supabase/migrations/) and applied through [`scripts/migrate.ts`](../scripts/migrate.ts). Important relationships:

| Area | Tables | Purpose and relationships |
|---|---|---|
| Identity and tenancy boundary | `profiles`, `role_assignments`, `departments`, `department_memberships` | A profile points to `auth.users`; role assignments are many per profile; staff can belong to departments. Roles are an enum: CITIZEN, HELPER, OFFICER, ADMIN, AUDITOR. |
| Draft and Case ownership | `case_reservations`, `case_inputs`, `cases` | A Citizen first reserves a UUID against an immutable owner. Draft input pointers refer to immutable evidence. Submission creates the Case with the reserved ID and owner. `related_case_id` is constrained to a same-Citizen Case. Case assignment records officer and department. |
| Sharing | `consent_grants`, `consent_operation_keys` | Grants bind a Case and granting Citizen to a principal, department, or AI processor, with purpose, exact actions, expiry, revocation, and version. Replay state is private and keyed by actor/operation/idempotency key. |
| Evidence and assessments | `evidence_items`, `assessments`, `assessment_evidence`, `assessment_sources`, `assessment_rule_bases` | Evidence is append-only and can supersede earlier evidence. Assessments store a contract-shaped immutable record, evidence references, source versions, and rule basis. The explicit unavailable initial rule basis is retained for historical Assessment records. |
| Workflow history | `case_events`, `case_decisions` | Append-only event trail and Officer/Admin decision trail. Decisions record before/after status, assignments, revisions, reason, and resolution assessment/rule references where applicable. |
| Rules | `rule_versions`, `rule_publication` | Immutable policy versions plus a singleton pointer to the current published synthetic rule. |
| API credentials | `api_keys` | A SHA-256 secret hash, issuer profile, scopes, expiry, revocation timestamp; only revocation may update the immutable record. |
| Trusted issuer data | `trusted_registry_records` | Immutable versioned `ISSUER`, `KEY`, and `NOTICE` records with issuer binding, status, and public JWK for keys. Private signing keys are not stored here. |
| Audit | `audit_events` | Request/actor/action/outcome and opaque target/authorization reference. No evidence content, API-key plaintext, or AI prompt is intended here. |

Sensitive tables enable RLS and revoke direct access from `anon`, `authenticated`, and even the Supabase `service_role` for the protected application tables. The trusted application SQL connection is the server boundary. Triggers enforce version increments, reservation locks, append-only history, owner immutability, and Case/evidence revision consistency. See the migration files and [`docs/adr/0001-separate-evidence-findings-from-case-status.md`](adr/0001-separate-evidence-findings-from-case-status.md) through [`0006`](adr/0006-urdu-audio-and-shared-phone-isolation.md).

## 5. Authentication and five roles

Login is `POST /api/v1/auth/login`, which verifies credentials through Supabase Auth and sets an HttpOnly `sanad-session` cookie; it does not return a browser-readable bearer token. `GET /api/v1/session` verifies the JWT with Auth, extracts its session ID only after verification, and asks `sanad_session_context` for current profile activity, roles, and department membership. An absent, expired, or signed-out session is rejected. Logout invalidates the server session and cookie. Login/logout mutations require same-origin `Origin`.

| Role | Intended responsibility | Server-side boundary |
|---|---|---|
| CITIZEN | Own draft, submit, read own Case, set/revoke sharing, add evidence | Owner is derived from authenticated principal; cannot self-assert owner or role. |
| HELPER | Assist named Citizens with scoped permission | Needs an explicit principal grant from that Citizen for that Case, purpose, actions, and duration. No general “40 families” access. |
| OFFICER | Review assigned Cases in a department | Must be active, assigned to that Case, belong to its assigned department, and have current department-review consent for requested actions. |
| ADMIN | Dispatch, assign, adjust priority, publish synthetic rules | Dispatch returns minimal metadata. Admin is not granted private evidence access by being Admin. |
| AUDITOR | Read authorized audit metadata and, when separately granted, Case/evidence trace | Audit endpoint returns limited event metadata; evidence access also requires an explicit audit-purpose grant. |

Seed account identifiers are synthetic and defined in [`scripts/demo-accounts.ts`](../scripts/demo-accounts.ts). Passwords are environment-supplied; this handbook does not disclose them.

## 6. RBAC and consent enforcement

The policy is not a UI toggle. [`src/backend/authorization/policy.ts`](../src/backend/authorization/policy.ts) checks an active principal, allowed role, ownership/assignment, API-key scope, the compatible purpose, exact action, recipient identity or department, grant start/expiry, and revocation. Consent purposes are bounded: `synthetic_helper_assistance`, `synthetic_department_review`, `synthetic_audit_review`, and `synthetic_ai_assistance`. The server does not combine partial grants from multiple roles into one permission path.

Protected reads and writes use [`withAuthorizedCase`](../src/backend/authorization/service.ts), a serializable-by-lock order transaction around current authorization state. The reservation row serializes Case and grant changes. Data is not returned from a cached earlier authorization: permissions are rechecked before commit/response; consent expiry and withdrawal can deny retrieval, including idempotent replay. Audit insertion commits with protected changes, so audit failure rolls back the operation. Anonymous/direct-client database access is denied by database privileges and RLS. Cookie requests use same-origin protections; API keys and session credentials cannot be mixed.

Citizen consent is scoped, time-bounded, revocable, and action-specific. For Officer review the grant is to a department; assignment alone does not confer access. When department sharing expires or is withdrawn, a nonterminal Case is reconciled to `PENDING_CONSENT`. AI processing requires its own processor-purpose grant plus the Assessment request/read permissions; if AI was authorized for a run, the orchestration rechecks that authorization before persistence.

## 7. Citizen draft and Case lifecycle

The backend supports this flow: reserve a Case ID as the authenticated Citizen; save a versioned draft; append evidence as needed; submit only a nonempty draft; reconcile department consent. The owner ID is read from the reservation, not the request. A submitted Case begins with `PENDING_CONSENT` and advances to `SUBMITTED` when a valid department review grant is available. Status is distinct from verification findings.

Statuses: `SUBMITTED` → `UNDER_REVIEW` → `NEEDS_EVIDENCE` → `SUBMITTED` after new evidence and resubmission; or `UNDER_REVIEW` → `RESOLVED` → `CLOSED`. Consent loss can move a nonterminal Case to `PENDING_CONSENT`; restoration can move it back to `SUBMITTED`. Exact transition guards live in [`workflow.ts`](../src/backend/officers/workflow.ts), [`http.ts`](../src/backend/cases/http.ts), and [`case.ts`](../src/contracts/v1/case.ts).

**UI reality:** `/citizen/dispute` calls the server to create/resume a draft, save reason/evidence, and submit. `/citizen/case` calls the API to load Case, history, and an existing Passport (or create a deterministic Assessment if absent). `/citizen/consent` includes live load/grant/revoke controls. However, the home summary, `/citizen/results`, and preview grants remain fixture-backed; `/citizen/verify` only displays an unavailable message and sends no notice. The later browser report timed out on dispute submission and did not complete live consent grant/revoke; it does not pin an immutable application commit. Thus current UI behavior is **NOT VERIFIED** end to end.

## 8. Evidence submission, correction, and versioning

Drafts are revision-checked with `expectedVersion`. A changed draft appends `NOTICE_INPUT` and/or `CITIZEN_STATEMENT` evidence at a new `evidence_version`; `case_inputs` points at the current evidence IDs. Existing evidence is not overwritten. Submitted Case evidence adds `evidence_items` rows, may point `supersedes_id` at an earlier item from that Case, increments the Case evidence version, and creates a Case event. Corrections are a distinct `CORRECTION` kind and must supersede an item. Historical rows reject update/delete. `SOURCE_SNAPSHOT` cannot be supplied by a client as authoritative upstream data.

An expected-version mismatch returns `STALE_VERSION`; finalized Cases reject evidence changes. Writes require idempotency keys; identical retry returns the original operation result under a fresh authorization check, while a changed payload with the same key conflicts. These protections reduce duplicate writes under retries but are not offline sync.

## 9. Six independent verification findings

An Assessment carries six separate facts in [`src/contracts/v1/evidence.ts`](../src/contracts/v1/evidence.ts):

| Finding | Question it represents | Current source/limit |
|---|---|---|
| `signature` | Does the notice's exact signed payload verify under the issuer's trusted Ed25519 key? | Implemented using compact JWS and the trusted registry; unavailable registry/unknown key/tampering remain unverified or invalid. |
| `expiry` | Was the signed notice within its issued validity interval at verification time? | Deterministic epoch-time check; distinct from signature. |
| `revocation` | Is this notice explicitly active or revoked in the registry? | Versioned notice record; missing/unavailable stays `UNKNOWN`, not implicitly active. |
| `recipientMatch` | Does the synthetic record match the recipient reference? | Case-scoped synthetic `recipientMatch` input. No real identity API. |
| `payment` | Does a mock payment source confirm the payment state? | Always `UNKNOWN` in current Assessment composition because no payment adapter exists. |
| `eligibility` | Does synthetic input meet the currently published demo rule? | Deterministic evaluator, but remains `UNKNOWN` with missing/ambiguous identity, unknown enrollment, absent income, or absent policy. |

An `EvidencePassport` is a projection of one immutable Assessment plus current Case status; it is not a government credential or final proof of payment. The Assessment stores `contradictions` and `missingEvidence`, but current composition has an empty contradictions list and includes `contradiction_checks_unavailable` among missing evidence. Do not claim contradiction detection between government sources exists.

## 10. Ed25519 signed-notice verification

Notices use compact JWS with exact protected `{alg: "Ed25519", kid, typ: "sanad-notice+jws"}` and a strict v1 payload: issuer/notice/recipient/program/payment references, amount in minor units, currency, issued and expiry epoch seconds. `jose` verifies the original compact token/signing bytes; the verifier does not parse and reconstruct a signing input. Duplicate JSON members are rejected. Embedded keys/URLs (`jwk`, `jku`, `x5u`, etc.), unsupported algorithms, malformed headers/payloads, invalid signatures, unknown/revoked keys, issuer/key mismatch, and unavailable registry states fail distinctly.

Signature validity does not confirm that the payment settled, the recipient is the person holding the phone, the issuer is a real government body, or the claimant is eligible. A copied genuine notice can still be misused; expiry and a versioned revocation lookup help identify stale notices but do not prevent every replay. The current assessment uses a server-loaded registry snapshot; no public signing route or production private key provider is exposed. See [`signed-notice.ts`](../src/backend/notices/signed-notice.ts), [`database-registry.ts`](../src/backend/notices/database-registry.ts), and [A02 verification](verification/a02-signed-notice.md).

## 11. Trusted issuer registry

`trusted_registry_records` is an append-only SQL table, keyed by `(kind, record_ref, version)`, with separate issuer, key, and notice records. Keys carry public Ed25519 JWK only; the registry code selects the latest version for each record and constructs a read-only `TrustedIssuerRegistry`. The Assessment snapshot takes a shared table lock and fingerprints the records; this fingerprint is compared before persistence so a concurrent registry change can stale the Assessment. Issuer/key binding is checked independently. Missing notice-revocation record is unavailable rather than active.

Records are server-owned setup data. There is no product Admin registry editor, issuer onboarding flow, private signing-key persistence, key rotation workflow UI, or notice signing API. Development seed scripts do not provision registry records. That operational setup is a known gap and must not be improvised against production.

## 12. AI classification and fallback logic

When `includeAi` is true and current `PROCESS_AI` consent permits it, [`assessment-operation.ts`](../src/backend/cases/assessment-operation.ts) captures a versioned authorized snapshot, releases the DB transaction before external provider work, calls [`assessForCase`](../src/backend/adapters/assessment-adapters.ts) / [`assessReliefMessage`](../src/backend/ai/assessment.ts), then reauthenticates and rechecks consent, evidence, Case, rule, program input, and registry fingerprint before appending an immutable Assessment. AI uses the server-configured Groq-compatible provider (`GROQ_API_KEY`, model `openai/gpt-oss-120b`); provider configuration is not the same as proof of a live successful run.

The model extracts untrusted issuer/amount/reference claims and classifies `SUSPICIOUS_MESSAGE`, `PAYMENT_DISPUTE`, `CLARIFICATION`, or `UNKNOWN`. Its strict schema is validated. Invalid JSON/schema, timeout, rate limit, missing provider config, and provider failure produce explicit failure/unavailable metadata or abstention; provider text and error details are not echoed. Deterministic checks override risky routes: suspicious or contradictory claims, direct payment request, and confidence below the current rule threshold route to Officer review; missing required data requests evidence; complete ordinary messages may be information-only. Confidence is advisory and marked `UNCALIBRATED`. AI output cannot write cryptographic or financial finding values and cannot resolve a Case.

The frozen v1 `AiAssessmentMetadata` does **not** include the internal extracted claims, explanation string, latency, token usage, or calibration flag. The persisted Assessment therefore contains less than the full provider trace; `aiRunIds` and model/prompt/schema metadata are present for a successful AI run. The Assessment trace endpoint returns the immutable Assessment, behind evidence authorization. Latest live-AI evaluation did not run for lack of credentials; distinguish source integration and deterministic tests from live production AI proof.

## 13. Assessment and Evidence Passport lifecycle

`POST /cases/{caseId}/assessments` requires current evidence version, an idempotency key, `REQUEST_ASSESSMENT` plus `READ_EVIDENCE`, and optionally AI processing consent. Under authorization, the server snapshots evidence references, current synthetic program input, current rule, registry records, and time. It computes deterministic signature/expiry/revocation/recipient/payment/eligibility findings; currently payment remains unknown, missing identity remains unknown absent case input, and contradictions are not computed. Optional AI metadata is advisory. The persisted immutable Assessment references evidence IDs, source records and source versions, rule version, timestamps, missing evidence and AI run metadata.

`GET /cases/{caseId}/evidence-passport` exposes a Passport projection. `GET /cases/{caseId}/assessments/{assessmentId}/trace` reads a particular immutable Assessment. New evidence, changed synthetic source data, changed rule, or changed registry invalidates a previous review basis for resolution. A failure of an external AI provider does not justify inventing a result.

## 14. Admin dispatch and Officer queue

Admin dispatch returns minimal Case metadata in the Admin's departments where a matching live department-sharing grant permits dispatch. Admin can assign/reassign to an active Officer belonging to the selected department and set `NORMAL`/`HIGH` priority with a reason and expected Case version. Admin dispatch does not return evidence. Reassignment may invalidate existing department-consent alignment and moves a nonterminal Case to `PENDING_CONSENT` until Citizen sharing supports that department.

Officer queue only returns Cases assigned to that Officer and department, with current `READ_CASE` and `READ_EVIDENCE` department sharing. It supports priority, oldest, and confidence ordering plus status filtering and cursor pagination. Confidence is only the latest Assessment's advisory AI confidence and may be null; it is not a correctness ranking. Staff UI source exists in `/staff/admin` and `/staff/officer`, but live public queue requests failed in the latest hosted smoke and the feature branch's actual browser path must be separately verified.

## 15. Case review, resolution, closure

Assigned Officer can start review (`SUBMITTED` → `UNDER_REVIEW`), request evidence (`UNDER_REVIEW` → `NEEDS_EVIDENCE` with reason), escalate priority to HIGH with a reason, and close only a resolved Case. Citizen/authorized helper can resubmit a `NEEDS_EVIDENCE` Case only after adding evidence newer than the recorded request. Every decision writes a `case_decisions` row and matching Case event.

Resolution requires `UNDER_REVIEW`, fresh expected Case version, human reason, reviewed Assessment ID, current Officer assignment/department consent, current published rule, and matching current evidence version. In one transaction it recomputes deterministic findings and checks the reviewed deterministic basis against the newly composed basis. A stale rule, changed evidence/source/registry, revoked consent, changed assignment, concurrent resolution, or audit failure aborts. Resolution records reviewed and final Assessment IDs and rule version and sets `RESOLVED`; it does not mark a payment as paid or change independent findings. Close then sets `CLOSED`.

## 16. Rules and versioning

Only one explicitly synthetic policy exists: `program_demo`, label `SANAD Synthetic Relief Demo`. Admin publishes the bounded parameters `maxMonthlyIncomeMinor`, `minRoutingConfidence`, and `integrityFailurePriority`; a validated publication appends a rule version with publisher, time and SHA-256 content digest and advances the singleton pointer. Existing rules cannot be updated/deleted. `expectedCurrentVersion` prevents lost updates. Officer/Admin may read current or historical rules; only Admin publishes.

Eligibility checks synthetic recipient match, enrollment and income. A non-match, ambiguity, missing input, unknown enrollment, or missing income yields `UNKNOWN`. Income above the configured ceiling is `INELIGIBLE`; otherwise ACTIVE enrollment plus match yields `ELIGIBLE`. This result is bounded by fictitious inputs and rule, not an actual benefit determination. Assessment history keeps the rule ID/version used; resolution rejects outdated versions.

## 17. Audit trail and AI trace

`audit_events` records request ID, actor, action, outcome (`ALLOWED`, `DENIED`, `FAILED`), target and optional authorization reference. `case_events` records chronological Case/evidence/Assessment events. `case_decisions` records human workflow choices and reasons. These are different records: audit metadata answers who attempted an operation, Case events track lifecycle, decisions capture substantive staff actions, and Assessment is the immutable evidence/finding snapshot.

`GET /api/v1/audit?caseId=...` is Auditor-only and returns metadata, not raw evidence, AI prompts, provider responses, or API key secrets. Case-specific Assessment trace is evidence-protected and contains the persisted contract fields described above. The full internal AI output trace is not all persisted because the v1 metadata schema omits several fields. Audit access itself is audited. Audit failures roll back protected mutations.

## 18. REST API and API keys

`GET /api/v1/openapi` serves generated OpenAPI 3.1 from the same Zod request/response schemas and endpoint operation list. There are 32 documented paths (38 HTTP operations). Main route groups: auth/session; Case drafts; Case/evidence/consent/history/Passport/Assessment; Admin and Officer queues/actions; rules; audit; API-key lifecycle. Private responses use `Cache-Control: private, no-store` and vary by credential headers.

API keys are service capabilities bound to the issuing profile's current active state, roles and department membership. A human issues one with named scopes and an expiry no more than 30 days; plaintext is returned once (`sanad_` plus random bytes), while only SHA-256 hash is persisted. Runtime scopes are intersected with role ceilings and do not bypass ownership, assignment, department membership, or consent. Revoke by the issuing human. Revocation serializes with in-flight authorized work. API keys cannot log in, reserve a Citizen Case, manage keys, or impersonate the Citizen. See [B05 API guide](b05-public-api.md).

All mutations validate strict Zod schemas, expected versions where relevant, body size, and idempotency. Errors use a sanitized request-ID envelope; no credential or evidence is echoed. API endpoints exist in source, but hosted SQL route failures mean availability is not currently established.

## 19. Production deployment architecture and current state

The intended release is one Next.js app on Vercel, Supabase Auth for user/password/JWT sessions, and Supabase PostgreSQL reached over a server-side TLS-verified SQL connection. CI workflow `.github/workflows/ci.yml` runs install, lint, typecheck, contract tests, offline backend tests and Webpack production build. Live integrations require a configured development database/Auth and are not CI smoke proof. Browser code sees only publishable Supabase configuration.

The release audit records local production HTTP smoke 16/16 PASS and current development live suites B01–B05 with 12/8/12/14/9 passing tests. Its 11:58 PKT public HTTP smoke had 12 PASS / 4 FAIL: root entry and SQL-backed API-key rejection/Officer queue/Admin dispatch. A later ~16:30 PKT browser run observed root redirect and role login, but Citizen dispute timed out and staff queues remained loading; no queue response was captured. The inferred SQL cause was not proven. Public end-to-end completion is not established and should not be claimed until the hosted behavior is retested and blockers resolved.

## 20. Security and privacy protections

- Synthetic identities and payment/program data only; product is visibly a prototype.
- Supabase Auth verification; database-derived role, active-profile, session-expiry and department context; sign-out invalidates prior session use.
- Server-side RBAC, owner/assignment/department and purpose/action-based consent; consent rechecked under locks before protected responses/writes.
- RLS plus revoked direct table privileges; application SQL boundary only for sensitive records.
- Same-origin `Origin` checks for cookie mutations, HttpOnly cookie, no-store private responses, bounded JSON streams, strict schemas, and safe error envelopes.
- Idempotency and version guards prevent duplicate writes and stale decisions; transaction plus audit writes are atomic.
- Append-only evidence, Assessments, decisions, rules, registry and credential history; secret API key hashing and one-time disclosure.
- JWS allowlists exact Ed25519, rejects embedded attacker keys and duplicate JSON members, and verifies original bytes.
- AI input/output schema validation, timeout/rate-limit/unavailable handling, untrusted message framing, no model authority fields, safe fixed explanations on risky outcomes, and human routing for uncertainty.

These are implementation controls, not a third-party security certification. The latest hosted runtime failure and unverified end-to-end Citizen journey remain practical operational gaps.

## Source map

- Official problem statement: [`brief/AI_Hackathon_Problem_Statement.md`](brief/AI_Hackathon_Problem_Statement.md)
- Frozen contracts: [`src/contracts/v1/`](../src/contracts/v1/) and [`src/contracts/v1/README.md`](../src/contracts/v1/README.md)
- Route catalog: [`src/backend/openapi/operations.ts`](../src/backend/openapi/operations.ts)
- Current source implementation: [`src/backend/`](../src/backend/)
- Database migrations: [`supabase/migrations/`](../supabase/migrations/)
- Current release evidence/limitations: [`final-release-audit.md`](final-release-audit.md), [`release-recovery-handoff.md`](release-recovery-handoff.md), [`docs/testing/browser-acceptance.md`](testing/browser-acceptance.md)
