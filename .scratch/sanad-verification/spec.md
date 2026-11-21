# SANAD: evidence-first notice verification and disputes

Status: human-owner-approved bounded contract baseline; affected-developer signoff pending
Contract revision: candidate-v1.0.0 (promotion target: v1.0.0)
Implementation gate: bounded schema/type/fixture baseline approved; promotion and deferred integration gates pending
Updated: 21 November 2026, Asia/Karachi

This is the local-tracker specification. The six architectural decisions are accepted. On 21 November 2026, the requesting human accepted ownership of shared contracts and database migrations and approved all 17 consolidated contract decisions, the exported schemas/types/fixtures as a bounded baseline, the clarifications below and explicit deferrals. This records that human's approval only; affected-developer signoff is pending. Existing exports remain `candidate-v1.0.0` until that signoff and promotion validation. Candidate wording below continues to apply to deferred/unexported projections; the approved exported baseline and its scope are recorded in the approval ledger. No runtime integration or additional feature work is authorized by this record.

## Problem Statement

A relief recipient cannot reliably tell whether an apparent payment notice came from a participating issuer, whether a payment actually completed, or whether program records support eligibility. Edited messages, incomplete records, ambiguous names, low literacy, shared phones, and unreliable connectivity make a single reassuring verdict unsafe. Community Helpers need narrowly authorized access, while Department Officers need evidence-backed disputes and a history that survives corrections, rule changes, and consent withdrawal.

We help synthetic relief-benefit recipients and Community Helpers verify a participating issuer's notice and submit a reviewable dispute even when messages may be altered, records conflict, reading is difficult, and connectivity drops.

## Solution

Build one Next.js TypeScript monolith using Supabase/PostgreSQL, serving one synthetic relief program and participating issuer initially. A Citizen scans a synthetic QR token or receives assisted text input, hears separate evidence findings, chooses sharing explicitly, and submits a Case for authorized human review. The Evidence Passport records independent findings; the Case tracks the dispute workflow. AI extracts, classifies, recommends routing, and explains validated findings without establishing cryptographic facts or approving payments.

Provide distinct Citizen, Community Helper, Department Officer, Admin, and Auditor permissions. A shopkeeper uses the citizen-facing verification journey without an additional privileged role. Every page and demo distinguishes the prototype, synthetic records, real cryptographic checks, and actually functioning AI. Prerecorded Urdu instructions are useful accessibility assets, not an AI voice feature.

### Source and decision authority

The official AI_Hackathon_Problem_Statement PDF is authoritative, but no PDF is present in the workspace. The [Markdown challenge brief](../../docs/brief/AI_Hackathon_Problem_Statement.md) is the provisional requirements source; fidelity to the PDF remains unverified. The [master handoff](../../docs/brief/SANAD_Hackathon_Master_Handoff.md) supplies context and proposals, not evidence of implementation. The [copilot guide](../../docs/brief/Hackathon_Copilot_All_In_One.md) supplies process advice.

Use [the domain glossary](../../GLOSSARY.md) and these accepted decisions:

| Decision | Governing record |
| --- | --- |
| Independent evidence findings and case status | [ADR 0001](../../docs/adr/0001-separate-evidence-findings-from-case-status.md) |
| Server-side roles, scoped consent, and limited audit retention | [ADR 0002](../../docs/adr/0002-enforce-role-and-consent-boundaries.md) |
| Strict compact JWS, exact Ed25519 identifier, and trusted keys | [ADR 0003](../../docs/adr/0003-use-strict-jws-and-trusted-issuer-registry.md) |
| Immutable rules and assessments; transactional resolution | [ADR 0004](../../docs/adr/0004-versioned-assessments-and-transactional-case-resolution.md) |
| Zod contracts, centralized mocks, and safe retries | [ADR 0005](../../docs/adr/0005-shared-contracts-and-central-mock-services.md) |
| Urdu Audio Guidance and shared-phone isolation | [ADR 0006](../../docs/adr/0006-urdu-audio-and-shared-phone-isolation.md) |

### Human-owner approval and bounded promotion

Approval source: the requesting human SANAD project owner's explicit declaration
on 21 November 2026: "I am the named human owner of shared contracts and database
migrations." The human approved all 17 decisions in the consolidated contract
approval request, including the bounded freeze and explicit deferrals. The exact
decision register is the [contract approval ledger](../../src/contracts/v1/README.md#approval-ledger).
The approved baseline is the exported schemas, inferred types and synthetic
fixtures at `11de106cd1e4ef8ac153c8c54aed07a40bee4156`. Existing public field names,
enums and fixture shapes are retained. This is a contract projection of the six
ADRs, not a replacement of their authorization, evidence or human-review rules.

Binding clarifications:

1. Consent purposes must be validated against a server-controlled operational
   allowlist for their disclosed use. `purpose: Reference` validates syntax only;
   an arbitrary purpose string cannot authorize access. Runtime allowlist
   enforcement remains pending with authorization implementation.
2. Missing payment records and contradictory payment details remain
   distinguishable: use `RECORD_NOT_FOUND` for absence and `DETAILS_MISMATCH` for
   contradictory details (`RECIPIENT_MISMATCH` when specifically applicable).
   Neither automatically establishes `FAILED`. A missing record leaves payment
   `UNKNOWN`; a mismatched record does not prove this Citizen's payment completed.
3. AI confidence is advisory, is not assumed to be a calibrated probability, and
   cannot establish authoritative findings or authorize financial decisions.
   It cannot override deterministic findings or the human Case resolution gate.

Explicitly pending: full draft and endpoint contracts; mock service interfaces;
full AI output contracts; runtime authorization and persistence; OpenAPI
projection; crypto feasibility (Developer 2); AI provider feasibility;
accessibility and deployment verification; and affected-developer signoff.
Operational catalogs, official-PDF fidelity and live demo parameters also retain
their recorded prerequisites. Approved fixture values are examples only.

The bounded approval narrows the initial G2 freeze to the existing export
surface. It does not assert completion of the broader G2 interfaces or direct-API
integration requirements. No teammate approval is inferred from the human
owner's approval, prior agent code reviews or passing schema tests. Capture each
affected developer's explicit approval, reviewed commit, evidence and date.

After affected developers explicitly approve, promote `CONTRACT_REVISION` and
the export-test expectation to `v1.0.0`, update revision/status documentation,
then run the existing 25 contract tests, TypeScript check, lint and production
build. Record fresh results for that promoted commit in the PR into `main`.
Until then, the candidate can be prepared as a draft PR but must not be presented
as promoted or merge-ready. Deferred consumers remain gated even after promotion.

### Required capability coverage

| Brief requirement | Behavior and acceptance coverage |
| --- | --- |
| Secure JWT/OAuth login and server RBAC | Verified sessions, explicit principals, default-deny authorization; SEC tests |
| Dashboard, progress, status, and history | Citizen/helper case list, independent draft progress, officer queue, auditable timeline; CASE and UX tests |
| Create, assign, escalate, close | Explicit endpoints and constrained state transitions; CASE tests |
| Public REST API, API keys, OpenAPI | Versioned API, scoped service principals, documented security and errors; API tests |
| Audit every user, AI, and automated action | Minimal append-only metadata and protected decision inputs; AUD tests |
| See, share, withdraw, correct | Citizen sharing view, independent grants, immediate authorization changes, append-only corrections; SEC and AUD tests |
| Mock identity, payment, and data services | Separate in-process interfaces and protected REST routes using one synthetic fixture set; MOCK tests |
| Database migrations, deployment, logs, basic tests | Contract-owner migrations, hosted vertical slice, sanitized operational evidence; RELEASE tests |
| At least three additional platform features | Admin rule editor, officer queue with priority/confidence sorting, and low-bandwidth mode; RULE, AI, and UX tests |
| At least three AI capabilities | Real structured extraction, classification/routing, and grounded explainability, with human-approval guardrails; AI tests |
| Wrong-approval cost and uncertainty | No automatic payment/case approval; deterministic findings, review handoff, measured error and routing counts; AI and RELEASE tests |
| Bad data, scams, edited notices | Explicit ambiguity/absence, signed-payload mutation checks, honest false alarms; CRYPTO, MOCK, and AI tests |

The brief permits low-bandwidth mode as an additional feature; this limited-resilience design does not satisfy or claim the optional full offline-first-sync bonus. The build deadline is 22 November 2026, 18:00 PKT. Submission requires a working deployed prototype and live demo, repository, README, and public demo-video link; slides are optional.

## User Stories

1. As a Citizen, I want to scan a synthetic notice QR or receive assisted text input, so that reading a long token is unnecessary.
2. As a Citizen, I want to hear Urdu instructions and replay them, so that I can complete the primary journey without reading.
3. As a Citizen, I want signature validity, expiry, revocation, recipient matching, payment, and eligibility explained separately, so that one authentic statement cannot imply every claim is true.
4. As a Citizen, I want missing records described as unknown, so that incomplete evidence does not falsely disqualify me.
5. As a Citizen, I want uncertainty and contradictions handed to a human with context, so that the system does not guess.
6. As a Citizen, I want to submit a dispute and hear its progress and history, so that I know what happens next.
7. As a Citizen, I want to see who has access, for what purpose, and until when, so that sharing remains under my control.
8. As a Citizen, I want helper, department, and AI-processing permissions explained and confirmed independently, so that accepting assistance is not blanket consent.
9. As a Citizen, I want to withdraw one grant without changing independent grants, so that I can remove a helper while retaining officer review.
10. As a Citizen, I want corrections to preserve prior evidence and identify their source, so that mistakes can be addressed without rewriting history.
11. As a Citizen, I want audible and visible unsent/saving/saved/failed feedback, so that I do not mistake an in-memory draft for a safely submitted Case.
12. As a Citizen, I want an interrupted submission retried without duplicates, so that weak signal does not create multiple disputes.
13. As a Citizen, I want tested narration when dynamic Urdu speech fails, so that a provider outage does not silently remove accessibility.
14. As a shopkeeper using the Citizen journey, I want a notice checked without receiving another person's private records, so that verification does not become unauthorized disclosure.
15. As a Community Helper, I want only explicitly shared Cases and actions, so that assisting many families does not expose unrelated records.
16. As a Community Helper, I want a Citizen to grant access in their own authenticated confirmation, so that my interaction cannot authorize itself.
17. As a Community Helper, I want safe family switching that clears private views, drafts, and audio, so that the next family sees none of the previous family's evidence.
18. As a Community Helper, I want late responses and pending retries isolated to the originating session, so that switching does not apply an old action to a new Citizen.
19. As a Department Officer, I want only assigned, department-authorized Cases in my queue, so that role membership alone does not expose evidence.
20. As a Department Officer, I want priority and confidence sorting with missing scores identified, so that uncertainty can be reviewed without invented confidence.
21. As a Department Officer, I want to request evidence, resolve with a reason, and close a Case, so that the dispute has an accountable end-to-end workflow.
22. As a Department Officer, I want resolution to reject changed consent, evidence, or rules, so that an old browser view cannot commit a stale decision.
23. As a Department Officer, I want assignment and escalation recorded separately, so that routing changes do not rewrite evidence or masquerade as resolutions.
24. As an Admin, I want to manage synthetic users, roles, issuer metadata, mock fixtures, and API principals, so that the prototype can be exercised without real data.
25. As an Admin, I want to publish validated eligibility and routing rules without redeployment, so that new Assessments use current policy immediately.
26. As an Admin, I want prior published rules and Assessments preserved, so that a changed threshold cannot erase how an earlier result was reached.
27. As an Admin, I want my administrative role separated from private case access, so that management permissions do not bypass Citizen sharing.
28. As an Auditor, I want minimal action and consent metadata, so that accountability remains available after withdrawal without copying private evidence into logs.
29. As an authorized Auditor, I want protected decision inputs, sources, versions, confidence, and outcomes, so that an AI explanation can be checked against its actual basis.
30. As an Auditor, I want read-only permissions and explicit raw-evidence authorization, so that auditing cannot alter records or bypass withdrawal.
31. As an API consumer, I want documented v1 schemas and consistent errors, so that integration does not depend on UI behavior.
32. As an API consumer, I want a scoped, expiring, revocable key, so that machine access has a specific identity and permission boundary.
33. As a developer, I want shared Zod definitions and central fixtures, so that frontend, backend, AI, and mocks agree on one contract.
34. As a developer, I want direct API authorization, concurrency, and retry tests before integration, so that apparently working screens do not hide security failures.
35. As a judge, I want to mutate a synthetic Signed Notice and observe a real signature failure, so that the authenticity claim is demonstrable.
36. As a judge, I want honest evidence of live AI, uncertainty, deployment, and accessibility, so that prerecorded assets or unexecuted tests are not presented as completed features.

## Implementation Decisions

### 1. Architecture and testable boundary

Use one Next.js App Router application with server-only domain services and PostgreSQL transactions. UI requests and public REST routes use the same authorization and case-operation boundary; server components and internal mock consumers must not create alternate permission paths. Supabase supplies PostgreSQL; Supabase Auth is the candidate JWT/OAuth session provider, subject to setup verification. The existing app has a starter page and the exported bounded contract baseline with 25 contract tests, but no feature APIs, real auth or database migrations.

Keep notice verification, assessment, consent, case operations, and the three mock interfaces as modules within the monolith. The contract owner owns migrations and shared schemas. Frontend, AI, and administrative views consume those contracts; they do not redefine them. Before implementation, read the locally installed Next.js route-handler, authentication, and data-security guides. Never place signing keys, AI credentials, database administrative credentials, or API secrets in browser bundles or logs.

The primary automated seam is the authenticated v1 HTTP boundary against an isolated test database and controlled provider adapters. Browser tests add the actual Urdu and shared-device journey. Pure cryptographic mutation fixtures and controlled concurrent database operations supplement this boundary where an HTTP-only test cannot isolate the failure. These are the direct API and browser seams explicitly approved in the interview, not new approval requests.

For the bounded exported baseline, the human separately approved the public v1 contract seam: schema parsing/rejection, transition shapes, synthetic fixture compatibility, API envelopes and export consistency. Its 25 tests do not replace the deferred runtime HTTP/database/browser acceptance tests.

### 2. Shared scalar and transport contracts

All object schemas are strict Zod definitions: reject unknown properties rather than silently accepting alternate contract shapes. Infer TypeScript types from those schemas. Generate OpenAPI from them where practical and check representative examples against the same runtime definitions. Documentation route paths below are HTTP paths, not implementation file assignments.

| Scalar | Candidate definition |
| --- | --- |
| `Id` | Server-issued UUID for cases, drafts, grants, assessments, principals, events, and rule versions. |
| `Reference` | Opaque synthetic reference, 1–64 ASCII letters, digits, underscores, or hyphens; never a real identity number. |
| `Timestamp` | RFC 3339 UTC timestamp ending in `Z` in API/data records. |
| `EpochSeconds` | Nonnegative safe integer UTC seconds in Signed Notice payloads. |
| `Version` | Positive safe integer; increment on the relevant mutable record change. |
| `MoneyMinor` | Nonnegative safe integer in minor currency units; reject floats, numeric strings, and unsafe integers. |
| `Currency` | Candidate v1 literal `PKR` for the single synthetic program. |
| `Confidence` | Advisory number from 0 through 1 from a validated successful model result; otherwise null, never a fabricated default. It is not assumed to be a calibrated probability and cannot establish authoritative findings or authorize financial decisions. |
| `Language` | `ur` or `en`; Urdu is the primary audio language. |

Candidate request limits: 64 KiB JSON body, 16,384 characters of message text, 8,192 characters of compact JWS, and 2,000 characters for a dispute or resolution reason. References and identifiers have their own limits. The owner verifies these limits accommodate all signed fixtures before freezing them. Version one accepts text and QR-carried tokens, not arbitrary attachment uploads or general OCR.

Successful JSON responses contain `data` and a server-generated `requestId`. Collections put `items` and nullable `nextCursor` inside `data`; default page size is 20 and maximum 100. A failed response contains `requestId` and `error`, whose fields are `code`, `messageKey`, `fieldErrors`, and `retryable`; each field error contains only `path` and `messageKey`, never echoed private input. User-facing messages and audio map from message keys, not raw exceptions.

| HTTP status | Candidate error codes and meaning |
| --- | --- |
| 400 | `MALFORMED_REQUEST`: invalid JSON or malformed transport. |
| 401 | `UNAUTHENTICATED`, `INVALID_API_KEY`: absent, invalid, expired, or revoked credentials. |
| 403 | `FORBIDDEN`, `CONSENT_REQUIRED`, `ASSIGNMENT_REQUIRED`, `INSUFFICIENT_SCOPE`: authorization failure with no private response body. |
| 404 | `NOT_FOUND`: no accessible target; inaccessible case-specific reads may use this same response to avoid disclosing existence. |
| 409 | `INVALID_TRANSITION`, `STALE_VERSION`, `STALE_ASSESSMENT`, `IDEMPOTENCY_CONFLICT`, `REQUEST_IN_PROGRESS`. |
| 413 | `PAYLOAD_TOO_LARGE`. |
| 415 | `UNSUPPORTED_MEDIA_TYPE`. |
| 422 | `VALIDATION_FAILED`: schema or cross-field validation failure. |
| 429 | `RATE_LIMITED`: bounded retry with a retry-after indication. |
| 503 | `SERVICE_UNAVAILABLE`: the overall operation cannot be completed; a successful Assessment with an unavailable source instead carries an explicit unknown finding. |

Authentication and disclosure checks precede returning resource data or an idempotent replay. A foreign target must not reveal whether it exists through detailed errors. Sensitive responses, including errors and narration, disable browser/proxy caching using explicit no-store behavior; do not rely on a framework default. Cookie-authenticated mutations require same-origin/CSRF protections. Provider errors are sanitized.

### 3. Signed Notice contract

The candidate protected JWS header has exactly `alg`, `kid`, and `typ`: `alg` is the literal `Ed25519`, `kid` is a trusted registry key identifier, and candidate `typ` is `sanad-notice+jws`. Reject extra key-location headers, embedded keys, unsupported critical headers, algorithm substitutions, missing headers, malformed compact segments, and duplicate JSON member names. Duplicate member rejection must happen before a JSON parser discards them. Do not accept `EdDSA` as an alias.

| Signed payload field | Type and validation |
| --- | --- |
| `v` | Literal integer `1`; unsupported versions remain not verified. |
| `issuerId` | `Reference`, bound to the registry key's Issuer. |
| `noticeId` | Globally unique `Reference` at issuance; repeated verification of an existing notice is allowed. |
| `recipientRef` | Opaque synthetic `Reference`, not a grant of access. |
| `programRef` | Opaque synthetic program `Reference`. |
| `paymentRef` | Opaque synthetic payment `Reference`. |
| `amountMinor` | `MoneyMinor`. |
| `currency` | `Currency`. |
| `issuedAt` | `EpochSeconds`. |
| `expiresAt` | `EpochSeconds`, strictly greater than `issuedAt`. |

Verify the original encoded protected-header and payload segments. Do not parse, reserialize, sort, normalize, or reconstruct JSON to build signing input. A structurally invalid token is a rejected input or a not-verified finding, never a successful signature claim. Registry lookups use only the server-controlled registry; a notice-supplied URL is never fetched. Match the verified key to `issuerId` before attributing origin. Use server time for expiry; a future `issuedAt` is reported separately as not yet valid, without changing an otherwise valid signature result.

Registry key records contain `issuerId`, `kid`, Ed25519 public-key material, and trust status. Issuance keeps private key material server-side; its storage/provider and the exact compatible JOSE library are implementation prerequisites, not selected libraries in this spec. Notice records retain immutable payload/signature identity plus server-side expiry and revocation events. A previously verified token copied into a new message remains a copy, not a payment authorization, access credential, or duplicate-claim verdict.

Unknown Issuers/keys and registry outages produce `NOT_VERIFIED` or `UNKNOWN`, not fraud. A known-key invalid signature is an integrity failure. A valid signature survives an expiry/revocation finding; these dimensions never overwrite each other. Unverified payload fields may be shown as untrusted claims but cannot establish ownership or retrieve another Citizen's records. The registered, scoped Citizen context determines which private mock records can be queried. Surrounding SMS text is unsigned and checked separately against verified content.

### 4. Independent findings and Evidence Passport

Every finding includes `result`, `reasonCodes`, `sourceRefs`, and `observedAt`. Each source reference includes `service`, `recordRef`, `sourceVersion`, and `observedAt`; unavailable sources have a service-attempt reference rather than an invented record reference. A finding never carries another Citizen's private identifiers. Source timestamps describe when the source was observed, not an unsupported guarantee of present truth.

| Dimension | Candidate result enum |
| --- | --- |
| `signature` | `VALID`, `INVALID`, `NOT_VERIFIED` |
| `expiry` | `CURRENT`, `EXPIRED`, `NOT_YET_VALID`, `UNKNOWN` |
| `revocation` | `ACTIVE`, `REVOKED`, `UNKNOWN` |
| `recipientMatch` | `MATCH`, `MISMATCH`, `AMBIGUOUS`, `UNKNOWN` |
| `payment` | `SETTLED`, `PENDING`, `FAILED`, `UNKNOWN` |
| `eligibility` | `ELIGIBLE`, `INELIGIBLE`, `UNKNOWN` |

The owner-approved baseline reason codes are `SIGNATURE_VALID`, `SIGNATURE_INVALID`, `TOKEN_MISSING`, `UNKNOWN_ISSUER`, `UNKNOWN_KEY`, `UNSUPPORTED_VERSION`, `REGISTRY_UNAVAILABLE`, `NOTICE_EXPIRED`, `NOTICE_REVOKED`, `RECORD_NOT_FOUND`, `SOURCE_UNAVAILABLE`, `RECIPIENT_AMBIGUOUS`, `RECIPIENT_MISMATCH`, `DETAILS_MISMATCH`, `ELIGIBILITY_INPUT_MISSING`, and `RULE_THRESHOLD_EXCEEDED`. The sixteen identifiers are approved within the bounded baseline; corresponding operational Urdu/English explanation-key catalogs remain pending. Arbitrary model-produced strings cannot become authoritative reason codes.

An Evidence Passport response contains `caseId`, `assessmentId`, `assessedAt`, `evidenceVersion`, `ruleVersionId`, the six named findings, `contradictions`, `missingEvidence`, and `ai`. Contradictions contain the affected fields and scoped source references, not an LLM verdict of legal fraud. The response's `caseStatus` is independently nullable before submission; never infer it from a finding. Authorized history returns immutable prior Assessments separately. The UI and audio have no single combined `verified`, `safe`, or `approved` field or badge.

A found mock payment records its own settlement state. If reference, recipient, amount, currency, or program does not match, record the contradiction with `DETAILS_MISMATCH` (and `RECIPIENT_MISMATCH` when specifically applicable) and do not describe that record as this Citizen's completed payment. An absent record uses `RECORD_NOT_FOUND` and means payment `UNKNOWN`, not `FAILED`. Missing and contradictory payment evidence remain distinguishable through reason codes; neither automatically establishes a `FAILED` payment. Eligibility is `UNKNOWN` when required inputs are absent or identity is ambiguous; only complete deterministic rule evaluation may produce `ELIGIBLE` or `INELIGIBLE`, and neither authorizes payment.

### 5. Core logical records and ownership

These are logical schemas and constraints for migrations, not SQL implementation instructions or a requirement for one table per record. Unlisted mutable historical data must not be added silently to a shared contract.

| Record | Candidate required fields and invariants |
| --- | --- |
| Principal | `id`, `kind` (`HUMAN` or `SERVICE`), role membership, active status; identity and roles are server-verified. |
| Citizen mapping | Auth principal to opaque synthetic `recipientRef`; user input cannot replace that mapping. |
| Citizen Draft | `caseId`, `citizenId`, `version`, `evidenceVersion`, nullable `relatedCaseId`, `noticeToken` or null, `messageText`, `disputeText`, `createdAt`, `updatedAt`; owner-scoped, not a Case status. |
| Case | `id`, `citizenId`, `status`, `version`, `evidenceVersion`, nullable `relatedCaseId`, nullable `assignedOfficerId`, `priority`, `createdAt`, `submittedAt`, `updatedAt`; `id` is the reserved draft `caseId`. |
| Consent Grant | `id`, `caseId`, `grantorCitizenId`, `recipientType`, `recipientId`, `purpose`, `actions`, `expiresAt`, `revokedAt` or null, `createdAt`, `version`; explicit and default-deny. |
| Evidence item | `id`, `caseId`, `kind`, `sourceRef`, `sourceVersion`, protected content/reference, `observedAt`, `createdBy`, nullable `supersedesId`; append-only corrections. |
| Rule Version | `id`, `version`, `parameters`, `publishedAt`, `publishedBy`, content digest; published content is immutable. |
| Assessment | `id`, `caseId`, `assessedAt`, `evidenceVersion`, `ruleVersionId`, source-version manifest, findings, contradictions, missing evidence, AI run references; immutable. |
| Resolution | `id`, `caseId`, `assessmentId`, `officerId`, `reason`, `resolvedAt`; creation is part of the atomic resolution transaction. |
| Audit event | `id`, `caseId` or null, `actorId`, `actorKind`, `action`, `occurredAt`, `authorizationRefs`, `requestId`, relevant opaque event/version references; no raw evidence or sensitive prompts. |
| API key | `id`, `principalId`, secret hash, `scopes`, `expiresAt`, nullable `revokedAt`, `createdAt`; never store or log plaintext keys. |
| Idempotency record | Principal, operation, key, canonical validated request digest, completion state, result reference, and creation time; unique per principal/operation/key. |

The approved bounded baseline uses consent `recipientType` values `PRINCIPAL`, `DEPARTMENT`, and `AI_PROCESSOR`; a helper or service principal uses `PRINCIPAL`. Action values include `READ_CASE`, `READ_EVIDENCE`, `WRITE_DRAFT`, `ADD_EVIDENCE`, `SUBMIT_CASE`, `REQUEST_ASSESSMENT`, `REVIEW_CASE`, `RESOLVE_CASE`, `CLOSE_CASE`, and `PROCESS_AI`, plus the dispatch actions described in §6. The future authorization module intersects grant actions with the recipient's role and case assignment; a Citizen cannot grant a Helper resolution powers simply by inserting an action value. Consent purposes are explicit disclosed identifiers with audio/visual explanations. They must be validated against a server-controlled operational allowlist; arbitrary purpose strings cannot authorize access even when they pass the structural `Reference` schema. The existing helper/department purposes and expiry are approved as fixture examples only; operational allowlists, disclosures and lifetime policy remain pending before their workflows are implemented.

Candidate role codes are `CITIZEN`, `HELPER`, `OFFICER`, `ADMIN`, and `AUDITOR`, mapped to the glossary terms. IDs in records are `Id`, source/business references are `Reference`, API record times are `Timestamp`, and revision counters are `Version`; nullable fields accept an explicit null, not omitted alternative shapes. Drafts start at version/evidenceVersion 1. Changing notice/message/dispute content increments both draft and evidence versions; submission carries the evidence version into the Case. Case assignment/status changes increment Case version but do not change evidenceVersion.

The external evidence-write `kind` is `NOTICE_INPUT`, `CITIZEN_STATEMENT`, or `CORRECTION`. `NOTICE_INPUT.content` contains `noticeToken` and `messageText`; the other two contain `text`. `CORRECTION` requires an authorized existing `supersedesId` within the same Case. Server-created `SOURCE_SNAPSHOT` items are not accepted from client requests. Requesters cannot write findings, model provenance, source-service records, or the apparent author of an evidence item.

An optional `relatedCaseId` links a new dispute to an authorized prior Case belonging to the same Citizen; the server validates the link and carries it from draft to submitted Case. Finalized Case content is not edited to introduce a new dispute: corrections after closure use a linked Case and preserve the original history. A shopkeeper may inspect signed provenance without gaining the referenced beneficiary's identity/payment records; notice possession does not change this ownership boundary.

The human-owner-approved bootstrap behavior for case-specific consent is that an authenticated Citizen reserves an owner-bound `caseId` before helper sharing, so a helper never needs blanket access to create their own authorization. Server saving is optional until connectivity returns; an in-memory draft has no persisted-success claim. The reserved owner record survives submission, while its mutable draft content is promoted to protected evidence and cleared or referenced rather than becoming a second historical evidence store. Submission atomically creates the Case at the same `caseId`; no `DRAFT` value is added to the approved Case enum. Full draft contracts, migration representation and runtime bootstrap/handoff implementation remain deferred; affected-developer signoff is pending.

Source-record corrections and new evidence increment `evidenceVersion` or change the source-version manifest, invalidating resolution freshness. A correction never silently edits authoritative identity/payment records; Citizen-supplied corrections are evidence until the responsible synthetic service publishes a new source version. Signed Notices, prior Assessments, published rules, and audit events cannot be edited in place.

### 6. Central authorization and permission matrix

For every protected operation, authenticate the actual principal, resolve its server-held roles, identify the owner-bound target, intersect role permission with applicable unexpired/unrevoked grant actions, and enforce assignment where required. Ownership does not come from a request's `citizenId`, notice contents, a selected family label, or a client-supplied role. Recheck mutable permissions for retries and committing mutations. RLS or equivalent database policies must prevent direct browser/database access from bypassing this boundary; an application's Admin is not a database service-role credential.

Direct Citizen access to their own data is owner-authorized, not delegated consent. Delegated case access always needs both role permission and an applicable active grant. Minimal retained audit metadata is the approved exception to raw-evidence sharing; it does not authorize evidence reads. API-key authentication establishes a service principal, never an unrestricted role or an implicit Citizen session.

| Actor | Allowed operations | Required additional boundary |
| --- | --- | --- |
| Citizen | Reserve/save own draft, inspect own findings/history, submit own Case, add corrections, manage own grants, request permitted assessment/narration. | Verified owner mapping; only the Citizen's authenticated confirmation can grant sharing. |
| Community Helper | Read, edit draft, add evidence, submit, or request assessment only when the grant permits each action. | Active named principal grant for this `caseId`; never resolve, close, grant access, or change authoritative records. |
| Department Officer | Read assigned evidence, request assessment/evidence, escalate, resolve, and close. | Same-department membership, assignment, active department grant, and action permission; unassigned cases expose no private evidence. |
| Admin | Manage roles, rules, mocks, issuer metadata, service principals, and administrative dispatch. | No private case evidence by default. Candidate dispatch exposes only opaque case ID and minimal queue metadata under active department sharing; raw evidence still needs separate authorization. |
| Auditor | Read minimal audit metadata and permitted decision-trace metadata. | Read-only; raw evidence and protected input/output trace require a separate active principal grant with audit purpose. |
| Service principal | Only explicitly authorized operations within key scopes and its role. | Every case operation also requires owner/delegation authority, active consent, and assignment when applicable. Cannot impersonate Citizen confirmation. |
| AI processor | Process only scoped inputs for the disclosed AI purpose. | Explicit active processor grant plus authorized initiating operation; no role-management, signing, evidence-write, or case-resolution tools. |

The human-owner-approved departmental action vocabulary additionally includes `ASSIGN_CASE` and `ESCALATE_CASE`. An Admin may dispatch using `ASSIGN_CASE` and minimal metadata without gaining `READ_EVIDENCE`; a currently assigned Officer may escalate within the authorized department using `ESCALATE_CASE`. The exact dispatch DTO/permission matrix and enforcement remain deferred prerequisites for an authorized path to initial assignment; unassigned evidence must not be opened to every Officer.

Helper and department grants have different identifiers and revocation lifecycles. AI processing is separately disclosed and authorized; absence of AI consent leaves the deterministic/manual workflow usable. Reassignment does not expand a department grant to another department. Grant changes and expirations invalidate delegated access immediately; an expiration uses server time, not a client's clock. An administrative role change or assignment change likewise invalidates stale permissions.

The consent view lists recipient, disclosed purpose, actions, expiry, and current revoked/active status for each grant. Narrowing sharing revokes the old grant and creates a new one with auditable references; it does not silently mutate the meaning of an earlier authorization. Withdrawing consent denies future protected reads, writes, cached responses, narration fetches, and new AI processing under that grant. Already delivered information cannot be recalled. A provider request already sent cannot be recalled either; recheck consent before persisting or delivering its result, discard late unauthorized output, and document this take-back limit.

### 7. Case lifecycle and concurrency

The Case enum is exactly `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_EVIDENCE`, `PENDING_CONSENT`, `RESOLVED`, and `CLOSED`. Draft persistence states are not Case statuses. The following is the candidate explicit expansion of ADR 0004:

| Operation | Before | After | Authority |
| --- | --- | --- | --- |
| Submit saved draft | No submitted Case | `SUBMITTED` | Citizen or appropriately granted Helper/service principal; active department consent. |
| Submit without department sharing | No submitted Case | `PENDING_CONSENT` | Citizen or appropriately granted Helper/service principal. |
| Start review | `SUBMITTED` | `UNDER_REVIEW` | Assigned Officer with active department sharing. |
| Request evidence | `UNDER_REVIEW` | `NEEDS_EVIDENCE` | Assigned authorized Officer; nonempty request reason. |
| Resubmit additional evidence | `NEEDS_EVIDENCE` | `SUBMITTED` | Citizen or appropriately granted Helper; department sharing remains active. |
| Interrupt departmental review | `SUBMITTED`, `UNDER_REVIEW`, or `NEEDS_EVIDENCE` | `PENDING_CONSENT` | System enforces missing, expired, or revoked department consent. |
| Restore department sharing | `PENDING_CONSENT` | `SUBMITTED` | Citizen confirms a valid department grant; fresh review required. |
| Resolve | `UNDER_REVIEW` | `RESOLVED` | Assigned authorized Officer, required reason, fresh assessment, atomic checks. |
| Close | `RESOLVED` | `CLOSED` | Assigned authorized Officer with active department sharing. |

No generic endpoint accepts an arbitrary new status. All other transitions fail with `INVALID_TRANSITION`; Admin and AI roles do not bypass this list. Assignment changes record previous/new assignment and increment the Case version without fabricating evidence changes. Escalation records an event and priority/assignment update within existing departmental authority; it is not a new Case status. The candidate initial priority enum is `NORMAL` or `HIGH`, derived from published routing parameters and auditable escalation.

When consent expires, denial is immediate even if no worker has updated the displayed status. Authorized case evaluation reconciles active workflow status to `PENDING_CONSENT` and appends the interruption event once. Restoration returns it to `SUBMITTED`. Do not add an unneeded background workflow engine. Finalized `RESOLVED`/`CLOSED` history is not rewritten or reopened by withdrawal; subsequent officer access remains denied, and a close operation requires restored authorization. The human owner approved this terminal-state interpretation within the bounded baseline on 21 November 2026; runtime enforcement remains deferred and no seventh ADR is introduced.

Resolution runs a fresh deterministic assessment of the current evidence and sources under the current published rules. Reuse a prior successful AI run only as a referenced advisory result whose input manifest still matches; a fresh deterministic assessment does not falsely claim a new AI call. Invalid signature or conflicting evidence can be the subject of a reasoned dispute resolution, but cannot become payment approval or rewritten facts.

The resolution request identifies the Assessment actually reviewed and the expected Case version. Within one PostgreSQL transaction, establish the current rule pointer and source versions, current Case/assignment/version, effective active consent, and the reviewed Assessment's freshness. Reassess deterministic findings, including time-dependent expiry/revocation, and reject if the reviewed basis changed. Append the new final Assessment, Resolution, transition, and separate audit references atomically. Missing reason, changed evidence, changed rule version, changed assignment, withdrawn/expired consent, or invalid status rejects the whole resolution.

A version comparison outside a transaction or a plain snapshot read without a concurrency protocol is insufficient. Publication and resolution must participate in the same locking/version protocol for the program's current-rule pointer; evidence, assignment, and consent mutations must likewise serialize with the Case and authorization checks. Consistent lock ordering or a retryable serializable transaction may implement this, selected by the owner without a workflow engine. If publication commits first, resolution cannot use the old rules; if resolution commits first, its older Rule Version remains an accurate historical record. Tests must exercise both orderings with barriers rather than timing guesses. Do not hold a database transaction open across an external AI request.

### 8. Rule parameters and immutable publication

Candidate v1 parameters are `maxMonthlyIncomeMinor` (`MoneyMinor`), `minRoutingConfidence` (a number from 0 through 1), and `integrityFailurePriority` (`NORMAL` or `HIGH`). These are structured data, not executable JavaScript, SQL, or model instructions. An Admin edits an unpublished candidate, validates it, and publishes a new immutable Rule Version while atomically changing the program's current-rule pointer. New Assessments use that pointer immediately without redeployment; previous Assessments keep their original rules.

The candidate synthetic eligibility rule requires an unambiguous scoped recipient, an active program-enrollment record, and a known `monthlyIncomeMinor` at or below `maxMonthlyIncomeMinor`. Inactive enrollment or a known amount exceeding the threshold can produce `INELIGIBLE`; missing/ambiguous required inputs produce `UNKNOWN`. These are prototype rule findings, not real-world eligibility or financial approvals. Current exported parameter names are human-owner-approved; existing seeded values are approved only as illustrative fixtures. Operational thresholds and calibrated confidence claims remain unapproved.

The confidence parameter only controls a recommendation to ask for evidence or seek Officer review. Unknown/low confidence, contradictions, missing required evidence, and invalid AI output cannot auto-resolve a Case. Rule editing cannot disable signature validation, consent, role checks, mandatory human resolution, or the independent-finding model. The initial seed must include at least one actual deterministic eligibility rule so the live change demonstration is not merely a cosmetic routing change.

### 9. Mock service schemas and behavior

Identity, payment, and program-data services share fixtures and their own strict interfaces. The monolith calls the in-process interfaces rather than making loopback network calls; protected REST routes expose the same behavior for documented API and contract tests. Every lookup includes an authorized `caseId` context; changing a reference or adding a token must not authorize another Citizen's data.

The common lookup result contains `outcome`, `service`, `checkedAt`, and nullable `sourceVersion`. It is a discriminated union: `FOUND` has one typed `record`; `NOT_FOUND` has no record; `AMBIGUOUS` reports a bounded candidate count and authorized nonidentifying details; `UNAVAILABLE` contains a finite reason key and no invented record or source version. Only `FOUND` requires a record version. Do not confuse a functioning service returning `NOT_FOUND` with a service failure.

| Interface | Candidate lookup request | `FOUND.record` fields |
| --- | --- | --- |
| Identity | `caseId`, `recipientRef` | `recipientRef`, `recordRef`, `version`, synthetic name variants, match basis. |
| Payment | `caseId`, `paymentRef` | `recordRef`, `version`, `paymentRef`, `issuerId`, `programRef`, `recipientRef`, `amountMinor`, `currency`, `settlementStatus`, `updatedAt`. |
| Program data | `caseId`, `recipientRef`, `programRef` | `recordRef`, `version`, `recipientRef`, `programRef`, `enrollmentStatus` (`ACTIVE` or `INACTIVE`), nullable `monthlyIncomeMinor`, `updatedAt`. |

`settlementStatus` is `SETTLED`, `PENDING`, or `FAILED` only for a found payment. Otherwise the normalized payment finding is `UNKNOWN`. Name variants may support presentation and evidence requests but never automatic identity merges. Duplicate or conflicting synthetic records yield explicit ambiguity or contradictions. Failure simulation is Admin-controlled in server-side mock configuration; ordinary clients cannot select an always-successful scenario in their request.

The central fixture corpus includes an intact Signed Notice, each signed-field mutation, unknown Issuer/key, expired notice, revoked notice, valid signature with absent payment, pending/failed/settled payments, amount/recipient/program contradictions, name variants, duplicate recipients, missing enrollment/income, source outage, malformed/duplicate input, prompt injection, and interrupted submission. Fixture IDs and content are deterministic and shared, not separately invented in each frontend or AI module. Synthetic source changes receive new versions so historical Assessments remain interpretable.

### 10. AI input, output, and fallback

Use a real provider behind a server-only adapter. The provider, model, quota, exact timeout, prompt version, and output-schema version must be selected and verified before claiming the AI path works. One candidate bounded model request per Assessment can extract surrounding claims, classify/rank the request, and select an explanation plan from already established facts; it does not select trusted keys or perform authoritative source lookups. Crypto and lookup findings remain available without AI.

AI input contains an authorized `caseId`, untrusted message text, allowed fact identifiers and scoped evidence references, the relevant published routing parameters, and the declared output-schema/prompt versions. The model receives only purpose-authorized data. User text, QR content, source records, and instruction-like uploads are data rather than system authority; no arbitrary URL fetching, shell tools, signing, mock-record mutation, or case-transition tool is offered.

| Candidate AI output field | Schema and interpretation |
| --- | --- |
| `schemaVersion` | Literal `1`. |
| `extractedClaims` | Nullable claimed issuer/name, payment reference, amount, currency, and issue text, each with an input span where present; claims are not verified facts. No signed-token field. |
| `classification` | `SUSPICIOUS_MESSAGE`, `PAYMENT_DISPUTE`, `CLARIFICATION`, or `UNKNOWN`; a suggestion, not fraud proof. |
| `confidence` | Advisory `Confidence`; not assumed to be a calibrated probability. It cannot establish authoritative findings or authorize financial decisions. |
| `recommendedRoute` | `ASK_FOR_EVIDENCE`, `OFFICER_REVIEW`, or `INFORMATION_ONLY`; never an approved/rejected/paid state. |
| `explanationPlan` | Ordered allowed fact identifiers and predefined explanation keys; every reference must exist in this Assessment's authorized inputs. |

`extractedClaims` has the fixed fields `issuerName`, `paymentRef`, `amountMinor`, `currency`, and `issueText`. Each is null or a claim object containing `value`, `start`, and `end`; textual values are bounded strings, amount uses `MoneyMinor`, and currency uses `Currency`. Span offsets are zero-based UTF-16 offsets into the exact supplied message, with exclusive `end`, so the server can reject out-of-range or unsupported extraction. These remain claims even when their spans and types validate. Each explanation-plan item has `factId` and `explanationKey`; it cannot include a new authoritative fact or unsupported free-text payment promise.

Reject unknown fields, invalid enums/numbers, invented evidence references, out-of-range input spans, and unsupported explanation keys. Cross-check extracted claims against the message and deterministic findings; contradictions become additional evidence, not overwritten source values. Render the Citizen explanation and narration from validated fact references and tested language templates. A model-selected explanation plan is distinguishable from a deterministic fallback; prerecorded instructions are not a successful AI response. Do not treat schema validity as proof of factual correctness.

The Assessment `ai` record contains `status` (`SUCCEEDED`, `UNAVAILABLE`, `INVALID_OUTPUT`, or `NOT_AUTHORIZED`), nullable `runId`, nullable model/prompt/schema versions when no run happened, nullable `confidence`, nullable classification/route, and validated explanation references. A real failed attempt records the actual versions attempted and a sanitized failure code. No provider request occurs without AI-processing consent; no success/score is invented when the provider fails. Timeout, malformed output, unsupported assertions, or a low/unknown score yields deterministic explanations and explicit evidence-request/Officer-review guidance. Human case resolution is mandatory regardless of model confidence.

Operational trace metadata records the actual model identifier, prompt/output version, input evidence references, confidence, route, timing, and failure category. Protected AI input/output is separate from the minimal audit log and is readable only with current evidence authorization. Sensitive rendered prompts are never copied into audit logs. Provider calls and late callbacks recheck consent before committing or returning results.

The Officer queue supports explicit priority and confidence sorting, with null confidence grouped as unknown rather than replaced with a numeric zero. Candidate order is priority descending, unknown/low-confidence first, then oldest submission; the API exposes separate sort choices so unknown is never presented as an actual confidence score.

### 11. Versioned REST contract

All paths below are under `/api/v1`, except public OpenAPI documentation. All state-changing authenticated operations require an `Idempotency-Key`; finite request schemas exclude actor/role claims supplied by the caller. `expectedVersion` fields are optimistic concurrency inputs, not permission grants. Secret credentials are never representative sample values.

Candidate authentication uses secure server-verified session cookies for the UI or `Authorization: Bearer` JWTs for human API clients, and `X-API-Key` for service principals. Reject requests supplying conflicting credential schemes rather than guessing which identity applies. Key scopes use operation/action identifiers and are intersected with server-held role and active grants. Secure login/logout is provided through the selected JWT/OAuth provider; it is not replaced by a local role selector.

| Method and path | Candidate request | Success response and authority |
| --- | --- | --- |
| `GET /session` | None. | Principal ID, role membership, available nonprivate contexts; verified session or explicitly scoped service identity. |
| `POST /case-drafts` | Optional initial `noticeToken`, `messageText`, `disputeText`, `relatedCaseId`. | 201: owner-bound Draft with reserved `caseId` and version; Citizen session only. |
| `GET /case-drafts/{caseId}` | None. | 200: permitted Draft fields; owner or explicitly granted reader. |
| `PUT /case-drafts/{caseId}` | `expectedVersion`, `noticeToken`, `messageText`, `disputeText`. | 200: confirmed saved Draft version; owner or granted `WRITE_DRAFT`. |
| `POST /cases` | `caseId`, `expectedDraftVersion`. | 201: Case at the reserved ID, `SUBMITTED` or `PENDING_CONSENT`; Citizen or granted `SUBMIT_CASE`. |
| `GET /cases` | Cursor and allowed status/sort filters. | 200: only authorized Case summaries; Officers receive assigned department-authorized Cases only. |
| `GET /cases/{caseId}` | None. | 200: authorized Case summary/status/version; no embedded unrestricted evidence. |
| `GET /cases/{caseId}/history` | Cursor. | 200: authorized timeline; private history still requires current sharing permission. |
| `POST /cases/{caseId}/evidence` | `expectedVersion`, `kind`, bounded `content`, nullable `supersedesId`. | 201: immutable Evidence item and new evidence/Case versions; owner or granted `ADD_EVIDENCE`. |
| `POST /cases/{caseId}/resubmit` | `expectedVersion`. | 200: `NEEDS_EVIDENCE` to `SUBMITTED` when authorized and department sharing is active. |
| `POST /cases/{caseId}/assessments` | `expectedEvidenceVersion`, `includeAi`. | 201: immutable Assessment; authorized owner/helper/assigned Officer. Also accepts a reserved owner-bound draft target for pre-submission findings. |
| `GET /cases/{caseId}/evidence-passport` | Optional explicit `assessmentId`; omission means latest visible Assessment. | 200: independent findings and protected source references; current evidence permission required. |
| `GET /cases/{caseId}/assessments/{assessmentId}/trace` | None. | 200: protected input references and AI/rule trace; owner or explicit raw-evidence/audit authorization. |
| `POST /cases/{caseId}/assign` | `expectedVersion`, `officerId`, nonempty `reason`. | 200: updated assignment; authorized Admin dispatch within active department sharing, minimal metadata only. |
| `POST /cases/{caseId}/escalate` | `expectedVersion`, `reason`, optional same-department `officerId`. | 200: escalation event and permitted priority/assignment update; currently assigned authorized Officer. |
| `POST /cases/{caseId}/start-review` | `expectedVersion`. | 200: `UNDER_REVIEW`; assigned authorized Officer. |
| `POST /cases/{caseId}/request-evidence` | `expectedVersion`, `reason`. | 200: `NEEDS_EVIDENCE`; assigned authorized Officer. |
| `POST /cases/{caseId}/resolve` | `expectedVersion`, `reviewedAssessmentId`, `reason`. | 200: `RESOLVED`, new final `assessmentId`, and `resolutionId`; assigned authorized Officer and atomic checks. |
| `POST /cases/{caseId}/close` | `expectedVersion`. | 200: `CLOSED`; assigned authorized Officer. |
| `GET /cases/{caseId}/consents` | None. | 200: sharing recipients, purposes, actions, expiry, revocation; Citizen owner only. |
| `POST /cases/{caseId}/consents` | Recipient type/ID, purpose, actions, expiry; Citizen confirmation context. | 201: Grant without raw credentials; Citizen-authenticated confirmation only, including for reserved draft IDs. |
| `POST /consents/{grantId}/revoke` | `expectedVersion`. | 200: revocation and relevant pending-consent transition; Citizen owner only. |
| `GET /rules/current` | Program reference. | 200: sanitized current Rule Version; rules-management or assessment-authorized actor. |
| `POST /rules/publish` | `programRef`, `expectedCurrentVersion`, candidate structured parameters. | 201: immutable Rule Version and updated pointer; Admin. |
| `POST /notices` | `issuerId`, `recipientRef`, `programRef`, `paymentRef`, `amountMinor`, `currency`, `expiresAt`; server generates `noticeId`, `issuedAt`, and `v: 1`. | 201: synthetic compact JWS and notice metadata; issuer Admin only; no private signing key returned. |
| `POST /notices/{noticeId}/revoke` | Nonempty `reason`. | 200: revocation metadata; issuer Admin only. |
| `POST /mocks/identity/lookup` | Identity interface request. | 200: typed lookup union; explicit scoped authorization, not Admin bypass. |
| `POST /mocks/payments/lookup` | Payment interface request. | 200: typed lookup union; explicit scoped authorization. |
| `POST /mocks/program-data/lookup` | Program interface request. | 200: typed lookup union; explicit scoped authorization. |
| `GET /audit` | Cursor and permitted opaque metadata filters. | 200: minimal audit metadata; Auditor role, read-only. |
| `POST /cases/{caseId}/narration` | `assessmentId`, `language`, allowed section identifier. | 200: protected structured audio plan or streamed audio tied to authoritative findings; current evidence permission and processing consent if an external AI processor is used. |

Mock lookup POSTs are read-only operations and need no mutation idempotency claim; all actual writes and assessment/narration generation use the idempotency protocol. `POST /cases/{caseId}/assessments` derives the current draft/case evidence version from its stable target; the client cannot select authoritative findings. Narration generation cannot bypass a missing AI grant by selecting another provider.

Expose a public OpenAPI document at candidate path `/openapi.json`, describing every implemented v1 endpoint, request/response/error schema, credential scheme, role/consent requirement, and synthetic example. A documentation UI is optional. Before parallel work, freeze only the draft/consent/case/assessment/mock/AI contracts that dependent modules need. Admin fixture editors and future endpoints may be specified later through the same contract-change process; their absence from this initial route table does not waive the approved Admin management capability.

Representative synthetic examples for shared schema fixtures:

| Scenario | Request/record values | Expected externally visible result |
| --- | --- | --- |
| Intact notice, pending payment | Issuer `issuer_demo`, notice `notice_demo_001`, recipient `recipient_demo_001`, program `program_demo`, payment `payment_demo_001`, amount `125000`, currency `PKR`; valid test signature and current timestamps; found payment `PENDING`. | Signature `VALID`, expiry `CURRENT`, revocation `ACTIVE`, recipient `MATCH`, payment `PENDING`; no combined verified badge. Eligibility depends on its own complete rule inputs. |
| Missing payment | Same valid synthetic notice; payment lookup `NOT_FOUND`. | Signature remains `VALID`; payment is `UNKNOWN`, not failed or paid. |
| Changed signed amount | Replace signed amount `125000` with `125001` without signing again. | Signature `INVALID`; no AI override; surrounding claims remain untrusted. |
| Department withdrawal | Citizen revokes the department grant while Case is `UNDER_REVIEW`. | Future officer requests fail; active Case becomes `PENDING_CONSENT`; history remains; independent helper grant is unchanged. |
| Repeated submission | Same principal/operation/idempotency key and identical saved-draft submission. | Exactly one Case and the original result after current authorization checks. |
| Changed retry payload | Same principal/operation/key with a different draft version or payload. | 409 `IDEMPOTENCY_CONFLICT`; no second action. |
| Invalid amount | `amountMinor` is fractional or a numeric string. | 422 `VALIDATION_FAILED`; no private value echoed in field errors. |
| Concurrent rule update | Officer reviewed version 1; version 2 publication commits before resolution. | 409 `STALE_ASSESSMENT` or `STALE_VERSION`; no stale resolution. |

These are schema/behavior examples, not real signed fixtures or already executed requests. A real private test key and exact token fixture must be created in the later cryptographic feasibility check; do not label a placeholder signature as valid evidence.

### 12. Retry, version, and cache behavior

Bind an idempotency record to the authenticated principal, named operation and target, supplied key, and canonical validated request digest. The lookup identity excludes the digest so changing content under the same key is detected as a conflict rather than creating another record. Canonical request hashing is separate from JWS signature verification and must never reserialize signed bytes for verification.

Reserve keys and enforce uniqueness atomically. Concurrent identical submissions cannot both create a Case. A completed retry returns the original operation result only after checking current authentication, ownership/delegation, active grants, and key scope; it does not re-execute the side effect or silently return a newer result. A different payload conflicts; an in-progress request returns an explicit retryable response. Persist result references under protected access rather than leaking serialized private evidence from a public cache. Pure validation/authentication failure does not consume a successful mutation key.

Draft save and Case submission are separate operations with separate keys. A response lost after commit leaves the client uncertain, not entitled to label itself `SAVED`; retry/reconciliation confirms the original result under the same operation identity. Client family switching invalidates the previous UI context and any automated retry. A canceled browser request might already have committed, so server idempotency and origin-bound case ownership remain necessary.

Candidate replay retention is the active prototype build/demo period, with no cleanup before the documented judge tests complete; a longer production retention policy is not established. A unique reserved Case ID independently prevents the same draft from becoming multiple Cases after an idempotency record expires. Distinct legitimate disputes are not automatically merged merely because they contain a copied notice or similar text.

### 13. Audit, protected trace, and correction

Every user, AI, service-principal, and automated action emits minimal audit metadata: successful and denied protected reads, writes, consent actions, role/assignment changes, signing/revocation, source lookups, AI attempts/results, reassessments, rule publication, resolution, and closure. These events are append-only and have server time, actor/action, authorization reference, request ID, and necessary opaque target/version references. A mutation and its required audit event commit together; a denied read produces no evidence payload. Protect logs from editing through application roles.

Raw notice text, uploaded evidence, identity fields, audio, rendered AI prompts, API keys, cookies, and tokens do not enter the audit log or operational exception output. Sanitized counters and failure categories support monitoring without copying those inputs. Minimal audit metadata survives withdrawal for accountability; restricted private evidence and decision records remain protected and cannot be retrieved by an Auditor or Admin without current separate authorization.

The full decision view resolves protected input/source references with authorization and shows actual rule/model/prompt versions, findings, confidence when present, recommended route, and Officer reason. A mere input hash is not represented as full input access: without an active raw-evidence grant, the Auditor sees only permitted trace metadata. Withdrawal is an access change, not historical evidence deletion; no private historical snapshot is duplicated into a supposedly harmless audit event. Explicit data-deletion/long-term-retention policy is outside the prototype decision and remains a production question.

Citizen correction appends a new item with `supersedesId`, actor, timestamp, and source context. Earlier content and Assessments retain their original references under the same access controls. A changed source version or evidence revision invalidates resolution freshness and leads to a new Assessment. Administrative changes to synthetic source data do not rewrite prior source snapshots.

### 14. Urdu, connectivity, and Shared-Phone Sessions

The primary journey has small guided steps with large touch targets, labeled icons, Urdu audio replay, clear focus, high contrast, and optional English. Candidate design minimum is 44 by 44 CSS-pixel touch targets and no color-only meaning. Urdu direction and text shaping must be verified on the actual device/browser. Main steps are authenticated Citizen context, notice intake, independent findings, explicit sharing, dispute submission, and status/withdrawal controls. QR decoding is input transport, not proof of authenticity or an AI/computer-vision claim by itself.

Record fixed prompts and finite status/reason phrases as public prerecorded assets with tested Urdu content. Case-specific narration is a deterministic plan over validated authoritative fields; it cannot promote a model claim or unsigned message into payment/eligibility truth. A dynamic TTS adapter is optional only when a tested prerecorded/structured plan covers all required states and values without relying on reading. An audio failure has a spoken fallback on a working alternate asset/path or consensual helper assistance; text-only fallback does not satisfy the no-reading acceptance test. Record an accessibility failure if every tested audible path fails rather than claiming success.

Before sharing, show and narrate the named recipient, purpose, actions, and expiry. All sharing controls start unselected. The Citizen confirms under their own authenticated identity, separate from the helper context. The prototype may use separate seeded Citizen accounts and a deliberate reauthentication step; helper-controlled family selection or a self-asserted PIN without verified server identity is not confirmation. Do not accept a helper/service-principal request as Citizen consent. A step-up/session handoff mechanism must be verified before that workflow is integrated; it remains deferred by the bounded baseline approval.

| Draft UI state | Meaning and permitted claim |
| --- | --- |
| `UNSENT` | Current input is only in memory or differs from the last acknowledged server revision; it may be lost on reload/close. |
| `SAVING` | A save/submission is in flight; no persistence claim yet. |
| `SAVED` | The server acknowledged the displayed revision/operation; a lost response alone cannot establish this state. |
| `FAILED` | Save failed or its outcome is uncertain; preserve active input in memory and offer an authorized idempotent retry. |

Changing input after `SAVED` returns the unsaved revision to `UNSENT`. Draft status and Case status are visibly and audibly distinct. Server-saved drafts resume only after fresh authentication and authorization. Closing/reloading may lose in-memory input; report this clearly. Public shell/audio assets may be cached; private evidence, message text, case-specific audio, grants, and private API responses must not be persisted in local/session storage, IndexedDB, service-worker caches, or framework shared caches. Authentication storage must not turn into an evidence store; prefer a secure server-verified session-cookie flow.

Switching Citizens increments an in-memory UI context generation, aborts pending client operations, clears private views and draft state, stops/clears audio and temporary object URLs, and rejects responses whose originating context no longer matches. Do not present a helper's active Citizen selection as a new authenticated Citizen. Every resumed request repeats server ownership/role/consent checks. Repeatedly switch among the 40 synthetic-family fixture contexts and check that a prior family's evidence, narration, or late response never appears under the new family.

### 15. Contract evolution and readiness

The human owner has approved the existing exported Zod schemas, inferred types and representative synthetic fixtures as the bounded baseline described above. Affected-developer signoff remains pending. Promotion to `v1.0.0` requires their explicit approval followed by the 25 contract tests, typecheck, lint and production build, with actual results recorded. The broader OpenAPI projection, permission/dispatch matrix, full draft/mock/AI interfaces and first direct-API integration tests remain deferred prerequisites for their consumers; bounded baseline approval does not mark them complete. Changes to approved/frozen shared contracts require explicit owner and affected-developer approval, one coordinated contract revision, corresponding fixture/test updates, and applicable integration evidence. Versioned `/api/v1` does not license silent incompatible changes within v1.

Named ownership and dependency order must be established before agents edit shared schemas, migrations, auth, or common dependencies. This spec assigns no person who was not named by the team. It creates no implementation tasks and grants no agent permission to work outside an assigned branch or module. Integration remains one application and one deployed vertical slice; a separate microservice, gateway, or contract registry is unnecessary.

## Testing Decisions

### Test seams, fixtures, and evidence

Test observable behavior through the public/protected API wherever possible: status codes, scoped response content, immutable record references, state transitions, and committed database effects. Do not mirror private function implementations. Use real PostgreSQL transactions for authorization/migration/concurrency tests, controlled synthetic service/provider adapters for failures, and a real asymmetric signature implementation for cryptographic fixtures. Contract examples must validate with the same Zod definitions as requests and responses.

Use browser/device tests for audio completion, Citizen-authenticated consent, small-screen controls, weak connectivity, and shared-session isolation. Concurrency tests coordinate transactions at explicit barriers; sleep-based races alone are inadequate. A mocked provider can test outages and hostile responses, but does not prove that a real AI model works. Separately run and record live-provider evaluations. Existing code has no prior business tests, test harness, database migrations, or configured test/typecheck scripts beyond the starter build/lint setup; selecting the harness is later implementation work, not completed infrastructure.

All tests below are requirements, not executed results. IDs are stable acceptance references for future issues and evidence reports.

### Cryptography and independent findings

| ID | Exercise | Required observation |
| --- | --- | --- |
| CRYPTO-01 | Sign and verify an original version-one synthetic notice with a real test key. | The exact `Ed25519` JOSE identifier works; signature is `VALID`; no private key reaches the client/log. |
| CRYPTO-02 | Independently mutate amount, recipient reference, and payment reference without resigning. | Each signature fails; no AI result can override the finding. |
| CRYPTO-03 | Unknown Issuer, unknown key, untrusted embedded key/URL, unsupported algorithm, or missing protected header. | Rejected or safely not verified; no notice-supplied network key lookup and no false authenticity. |
| CRYPTO-04 | Expired, future-issued, and revoked notices with otherwise valid signatures. | Signature, expiry, and revocation remain independent and correctly explained. |
| CRYPTO-05 | Malformed segments, duplicate header/payload members, duplicated requests, and unsupported payload versions. | No verification bypass; repeated intact verification is allowed without authorizing payment/access. |
| CRYPTO-06 | Simulated trusted-registry outage. | Explicit uncertainty; no cached false current registry/revocation assertion. |
| EVID-01 | Valid signature with `NOT_FOUND` payment and missing eligibility record. | Signature stays valid; payment/eligibility are unknown, not failed/ineligible. |
| EVID-02 | Found payment belonging to mismatched reference/recipient/amount/program. | Scoped contradiction; no claim that this Citizen was paid and no disclosure of unrelated private records. |
| EVID-03 | Append new evidence and close the Case. | Earlier findings, sources, timestamps, and rule/model references remain unchanged. |
| EVID-04 | Inspect UI/API/audio for mixed evidence results. | Six findings remain separate; no combined Verified/Safe badge or approval field. |

### Roles, consent, and trace privacy

| ID | Exercise | Required observation |
| --- | --- | --- |
| SEC-01 | Helper A reads/writes Citizen B's target with no applicable grant through direct HTTP calls. | Denied, with no private body; selected-family state and notice possession do not change authority. |
| SEC-02 | Revoke a Helper grant, then retry read/write/assessment and a completed idempotent response. | All actions under that grant fail immediately, including cached-response retrieval. |
| SEC-03 | Revoke Helper sharing while independent department sharing and assignment remain valid. | Officer review continues; no department grant/state is revoked implicitly. |
| SEC-04 | Officer requests an unassigned Case or an assigned Case without active department sharing. | Access and resolution denied, independently of UI controls. |
| SEC-05 | Department sharing is absent, expires, or is withdrawn during review. | Subsequent requests fail; active Case is pending consent with history preserved; restoration requires fresh review. |
| SEC-06 | Admin/Auditor requests raw evidence without separate permission or tries to mutate as Auditor. | Denied; administrative roles and trace routes do not bypass evidence permission. |
| SEC-07 | Helper or API key attempts to confirm Citizen consent or grant itself more actions. | Denied; only separately authenticated Citizen confirmation can authorize sharing. |
| SEC-08 | Invoke AI without processor consent, then revoke consent during a delayed provider call. | No new unauthorized processing; no late private result is persisted or delivered after authorization loss. |
| SEC-09 | Invalid, expired, revoked, or insufficiently scoped API key; valid key without case delegation. | Rejected; service identity cannot bypass role, assignment, ownership, or consent. |
| SEC-10 | Attempt direct database/client access and cookie-mutation CSRF bypass. | Server/database policies and mutation protections preserve the same boundary. |
| AUD-01 | Perform user, AI, service, rule, assignment, escalation, consent, assessment, and closure actions. | Separate immutable audit metadata exists for every action, with actual actor/time/authorization references. |
| AUD-02 | Withdraw sharing and inspect retained logs/trace routes as Auditor. | Minimal accountability metadata remains; raw evidence, prompts, tokens, and unauthorized inputs do not appear. |
| AUD-03 | Citizen corrects evidence; authorized Auditor follows old/new references. | Prior content is preserved under permissions; the full view requires raw-evidence authorization, not just an input hash. |

### Case transitions, rule changes, and concurrency

| ID | Exercise | Required observation |
| --- | --- | --- |
| CASE-01 | Exercise every approved transition and representative disallowed transitions. | Valid transitions succeed; arbitrary status jumps fail server-side. |
| CASE-02 | Unauthorized user, Helper, Admin, or AI tries to change status or resolve. | Denied; no forged actor/role/assignment field bypass. |
| CASE-03 | Officer resolves without a reason or from a nonreview state. | Rejected with no partial Resolution or status update. |
| CASE-04 | Assign, escalate, request evidence, resubmit, resolve, and close a dispute. | End-to-end workflow and separate audit events; resolved means Case disposition only. |
| CASE-05 | Withdraw department consent before resolution commit. | Transaction rejects; no partial resolution survives. |
| RULE-01 | Publish a changed eligibility parameter without redeploying. | The next Assessment uses the new Rule Version; earlier Assessment remains unchanged. |
| RULE-02 | Review an Assessment, add evidence or change its source version, then resolve. | Stale assessment rejected; fresh current-evidence reassessment is required. |
| RULE-03 | Coordinate concurrent rule publication and resolution, each committing first in separate runs. | Publication-first prevents an old-rule resolution; resolution-first retains a valid historical version. |
| RULE-04 | Reassess with deterministic checks when a previous AI result is sufficient or unavailable. | No unnecessary AI success is invented; authoritative checks remain deterministic. |
| RULE-05 | Use a test-only income of 150 minor units and publish thresholds of 100 then 200. | Complete known inputs produce different eligibility findings under distinct versions; these numbers are fixture parameters, not agreed program thresholds. |
| RULE-06 | Attempt to edit a published Rule Version or use rule editing to disable auth/crypto/human review. | Rejected; immutable history and security invariants remain intact. |

### Contracts, mock services, AI, and retries

| ID | Exercise | Required observation |
| --- | --- | --- |
| API-01 | Validate frontend examples and backend request/response/error payloads with shared Zod definitions. | Same schemas accept/reject them; no divergent manual types. |
| API-02 | Submit malformed JSON, unknown fields, invalid amounts, oversized bodies, and unsupported media. | Consistent documented errors without echoing private input. |
| API-03 | Compare OpenAPI paths, methods, schemas, errors, and security with implemented handlers. | No documented contract drift; representative success/error examples validate. |
| API-04 | Retry and concurrently send identical Case submissions. | Exactly one Case and effect; safe replay after fresh authorization checks. |
| API-05 | Reuse a key with changed payload; lose a response after commit; then retry after withdrawal. | Changed payload conflicts; legitimate retry recovers original result only while authorized; revoked caller receives no stored evidence. |
| MOCK-01 | Exercise all four lookup outcomes in each separate interface. | `FOUND`, `NOT_FOUND`, `AMBIGUOUS`, and `UNAVAILABLE` remain distinct; found payment status is independent. |
| MOCK-02 | Name spelling variants, duplicate recipients, and conflicting records. | No name-only automatic match/merge or unsupported eligibility decision. |
| MOCK-03 | Source outage, missing data, and unauthorized cross-Citizen reference. | Explicit uncertainty or denial, not invented data or another Citizen's record. |
| AI-01 | Real-provider normal extraction/classification/grounded-explanation fixtures. | Validated actual outputs and model/prompt versions; at least three declared AI capabilities have demonstrated behavior. |
| AI-02 | Malformed JSON, invalid fields/enums, invented references/confidence, injection text, and false payment assertions. | Schema/grounding guardrails reject unsupported output; authoritative findings never change. |
| AI-03 | Provider timeout/outage, no consent, low/unknown confidence. | Honest deterministic/manual fallback and review guidance; no fabricated successful run, score, or canned AI result. |
| AI-04 | Inspect queue sorting for high/low/null confidence and priority. | Explicit sorting works; null remains unknown and scores never imply financial safety. |
| AI-05 | Independently grade tampered, legitimate, ambiguous, contradictory, and adversarial fixtures. | Report actual false verification/false alarm/routing counts and failures, not model self-grading or unsupported accuracy. |

### Audio, shared devices, and release

| ID | Exercise | Required observation |
| --- | --- | --- |
| UX-01 | Complete intake, findings, explicit sharing, dispute submission, tracking, and withdrawal with Urdu audio and no reading assistance. | The primary journey completes on a mobile viewport/device; record the actual session conditions. |
| UX-02 | Narrate valid-signature/pending-payment/unknown-eligibility and contradictory cases. | Audio accurately distinguishes findings and contains no invented payment/eligibility claim. |
| UX-03 | Disable dynamic TTS and fail a primary audio asset. | Tested prerecorded/structured or accessible assisted fallback; do not report untested speech or text-only fallback as no-reading success. |
| UX-04 | Drop connection during input/save/submission and after a server commit. | Honest `UNSENT`/`SAVING`/`SAVED`/`FAILED` feedback; authorized retry creates no duplicate. |
| UX-05 | Reload/close an in-memory-only draft. | Loss is within documented limitations; no claim of persisted or offline-first recovery. |
| UX-06 | Switch Citizens while evidence fetch/audio/save is delayed; visit back/forward and repeat across synthetic families. | Private views/drafts/audio are cleared; late responses and old retries cannot populate the new context. |
| UX-07 | Inspect browser storage, service-worker/framework caches, response headers, and logs after private operations. | No persistent private evidence/audio, no cached sensitive API response, and no secret/private logging. |
| UX-08 | Throttle to a documented low-bandwidth profile, introduce interruptions, and finish the primary journey. | Measured completion within stated limitations; document bandwidth/latency/browser and failures rather than assuming offline functionality. |
| RELEASE-01 | Apply migrations to a clean isolated database; verify roles, indexes, constraints, and policies. | Reproducible synthetic setup with no manual hidden state or real personal data. |
| RELEASE-02 | Run relevant behavior tests, typecheck, lint, and production build using actual configured commands. | Record executed commands, exit codes, and limitations; do not claim scripts exist or checks passed before running them. |
| RELEASE-03 | Fresh-browser hosted smoke with real AI and synthetic crypto/source data. | Working deployed vertical slice, server permissions, mobile journey, and error path; verify URL and logs. |
| RELEASE-04 | Review prototype/mock labels, README, repository, public demo-video link, and actual AI claims. | Judges can distinguish real crypto/AI from synthetic services and recorded guidance; all required artifacts are accessible. |

### Evaluation and release policy

For the brief's wrong-approval challenge, document the selected synthetic cost assumptions and show measured false-verification, false-alarm, evidence-request, and human-review counts. No numeric business loss weights, program threshold, or calibrated confidence cutoff has been approved; the handoff's illustrative numbers are not adopted here. The conservative invariant is already settled: the system does not autonomously approve payments or resolve Cases, and unsupported findings abstain. Any proposed numeric cost/threshold experiment must be labeled as a synthetic assumption, reviewed by the owner, and measured rather than advertised as proven safety.

For live AI evaluation, record fixture IDs, expected behavior, actual failures, model/prompt/schema versions, latency, provider errors, and cost if actually measured. Have expected labels independently defined; the same model's self-rating is not proof. For accessibility, record actual Urdu review and task completion, not just the existence of audio files. For resilience, record the network profile and actual recovery behavior. Release requires the relevant acceptance tests and type/build checks to run, no known P0/P1 in the shipped behavior, and a verified hosted vertical slice. These are future gates, not current passes.

## Out of Scope

- Real identities, government/NADRA/BISP/Raast integrations, real payments, or official-service claims.
- Automatic payment approval, model-controlled signing/keys, automatic Case resolution, or identity merging by name similarity.
- A universal scam/fraud verdict or generic document-forgery detector; the demonstrable document-integrity scope is the synthetic signed notice.
- Multiple microservices, an API gateway, complex contract registry, or workflow engine.
- Full offline-first persistence/synchronization, private evidence cached on shared phones, and retroactive recall of already viewed/downloaded data.
- Advanced speech recognition, arbitrary document OCR/uploads, autonomous agent frameworks, RAG, a Digital Twin, a Scam Map, billing, and multi-tenant provisioning before the required slice works.
- Production compliance/certification, a production retention/key-rotation program, empirical ROI, pricing, and customer validation.
- Runtime feature implementation, generated endpoint OpenAPI, database migrations, unrelated task decomposition and deployment during this bounded contract approval-recording task. Existing exported schemas/types/fixtures and their contract-test evidence are already established; remaining integrations retain their gates.

## Further Notes

### Freeze gate and unresolved blockers

The six interview decisions remain settled. The human owner approved all 17 bounded contract decisions and the three clarifications above on 21 November 2026. The following statuses distinguish that approval from affected-developer signoff and operational integration evidence.

| Gate | Required concrete evidence before dependent work | Current status |
| --- | --- | --- |
| G1: named owner and developer signoff | Human accepts shared-schema/migration ownership; affected developers explicitly approve the reviewed baseline. | Requesting human owner explicitly accepted ownership and all 17 decisions. Affected-developer signoff remains pending; no teammate approval is recorded. |
| G2: bounded baseline promotion and deferred interfaces | For the approved current export surface: affected-developer approval, promotion to `v1.0.0` and fresh 25-test/typecheck/lint/build evidence. Broader draft/endpoint/mock/AI contracts, grant/dispatch matrix, bootstrap implementation, OpenAPI projection and direct-API integration evidence remain separate gates. | Existing schemas/types/fixtures at `11de106` are human-owner-approved; 25 tests and typecheck/lint/build passed before this approval record. Revision stays `candidate-v1.0.0`. No unqualified G2 or integration clearance is claimed. |
| G3: exact crypto compatibility | Chosen JOSE library supports protected `alg: Ed25519`; run original/mutation/unknown-key fixtures without substituting `EdDSA`. | Pending Developer 2's feasibility work. Blocks Signed Notice implementation claims. |
| G4: authoritative source | Supply/verify the requested official PDF or confirm the Markdown is its faithful complete extraction. | PDF absent; provisional-source limitation remains. |
| G5: configured services | Verify Supabase/auth/database setup, real AI provider/model/quotas and server credentials, deployment access; document names of required variables without values. | Not established by this session. Blocks dependent integrations and live claims, not contract drafting. |
| G6: demo parameters and narration | Owner reviews operational eligibility/routing values and synthetic cost assumptions; test Urdu scripts, dynamic/fallback coverage, and Citizen-authenticated consent handoff. | Existing fixture values approved as illustrative examples only. Operational policies, providers, recordings, handoff and accessibility evidence remain pending. |

The human owner approved the bounded contract choices for reserved Case IDs, minimal administrative dispatch, scalar limits and terminal consent handling without authorizing their runtime implementation here. These choices project the existing ADRs. Full draft/endpoint contracts, mock interfaces, full AI output contracts, runtime authorization/persistence, OpenAPI, crypto/AI-provider feasibility, accessibility/deployment verification and affected-developer signoff remain explicitly pending. Approval of current exports does not waive those gates or authorize another backend feature. Surface compatibility failures explicitly; never hide them behind algorithm substitution or canned AI.

The source document names in the original engineering source-of-truth list differ from actual available brief filenames. This spec links to the actual files and records the missing-PDF limitation without modifying engineering instructions. The root specification entry links here so agents can find the local-tracker spec without maintaining duplicate contract text.

### Planning completion and evidence status

All six approved architectural decisions remain recorded in the glossary/ADRs. The exported contract baseline and its 25-test/typecheck/lint/build evidence are established, and the human owner's explicit approval is recorded above. Affected developers have not yet approved; `candidate-v1.0.0` has not been promoted. This documentation update adds no schemas, tests, runtime behavior or new test-execution claim. It asserts no live provider success, implemented security enforcement, verified accessibility or deployment. The next promotion step is gated on explicit affected-developer approval, followed by fresh validation; the draft PR must expose that pending status.
