# SANAD: evidence-first notice verification and disputes

Status: ready-for-agent
Contract revision: candidate-v1
Implementation gate: not cleared for parallel development
Updated: 21 November 2026, Asia/Karachi

This is the local-tracker specification, not a report of implemented behavior. The six architectural decisions are accepted; the concrete field names, enum refinements, route shapes, and storage projection below are a candidate translation for contract-owner review. Do not treat newly specified details as additional interview-approved decisions. The initial agent work is contract establishment and validation; feature implementation waits for the freeze gate in Further Notes. No implementation tickets or task assignments are created here.

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

Use one Next.js App Router application with server-only domain services and PostgreSQL transactions. UI requests and public REST routes use the same authorization and case-operation boundary; server components and internal mock consumers must not create alternate permission paths. Supabase supplies PostgreSQL; Supabase Auth is the candidate JWT/OAuth session provider, subject to setup verification. The existing app is a starter page with no feature APIs, auth, migrations, contract schemas, or behavior tests.

Keep notice verification, assessment, consent, case operations, and the three mock interfaces as modules within the monolith. The contract owner owns migrations and shared schemas. Frontend, AI, and administrative views consume those contracts; they do not redefine them. Before implementation, read the locally installed Next.js route-handler, authentication, and data-security guides. Never place signing keys, AI credentials, database administrative credentials, or API secrets in browser bundles or logs.

The primary automated seam is the authenticated v1 HTTP boundary against an isolated test database and controlled provider adapters. Browser tests add the actual Urdu and shared-device journey. Pure cryptographic mutation fixtures and controlled concurrent database operations supplement this boundary where an HTTP-only test cannot isolate the failure. These are the direct API and browser seams explicitly approved in the interview, not new approval requests.

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
| `Confidence` | Number from 0 through 1 from a validated successful model result; otherwise null, never a fabricated default. |
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

Candidate reason codes include `SIGNATURE_VALID`, `SIGNATURE_INVALID`, `TOKEN_MISSING`, `UNKNOWN_ISSUER`, `UNKNOWN_KEY`, `UNSUPPORTED_VERSION`, `REGISTRY_UNAVAILABLE`, `NOTICE_EXPIRED`, `NOTICE_REVOKED`, `RECORD_NOT_FOUND`, `SOURCE_UNAVAILABLE`, `RECIPIENT_AMBIGUOUS`, `RECIPIENT_MISMATCH`, `DETAILS_MISMATCH`, `ELIGIBILITY_INPUT_MISSING`, and `RULE_THRESHOLD_EXCEEDED`. The owner freezes a complete finite list with corresponding Urdu/English explanation keys; arbitrary model-produced strings cannot become authoritative reason codes.

An Evidence Passport response contains `caseId`, `assessmentId`, `assessedAt`, `evidenceVersion`, `ruleVersionId`, the six named findings, `contradictions`, `missingEvidence`, and `ai`. Contradictions contain the affected fields and scoped source references, not an LLM verdict of legal fraud. The response's `caseStatus` is independently nullable before submission; never infer it from a finding. Authorized history returns immutable prior Assessments separately. The UI and audio have no single combined `verified`, `safe`, or `approved` field or badge.

A found mock payment records its own settlement state. If reference, recipient, amount, currency, or program does not match, record the contradiction and do not describe that record as this Citizen's completed payment. An absent record means payment `UNKNOWN`, not `FAILED`. Eligibility is `UNKNOWN` when required inputs are absent or identity is ambiguous; only complete deterministic rule evaluation may produce `ELIGIBLE` or `INELIGIBLE`, and neither authorizes payment.

### 5. Core logical records and ownership

These are logical schemas and constraints for migrations, not SQL implementation instructions or a requirement for one table per record. Unlisted mutable historical data must not be added silently to a shared contract.

| Record | Candidate required fields and invariants |
| --- | --- |
| Principal | `id`, `kind` (`HUMAN` or `SERVICE`), role membership, active status; identity and roles are server-verified. |
| Citizen mapping | Auth principal to opaque synthetic `recipientRef`; user input cannot replace that mapping. |
| Citizen Draft | `caseId`, `citizenId`, `version`, `noticeToken` or null, `messageText`, `disputeText`, `createdAt`, `updatedAt`; owner-scoped, not a Case status. |
| Case | `id`, `citizenId`, `status`, `version`, `evidenceVersion`, nullable `assignedOfficerId`, `priority`, `createdAt`, `submittedAt`, `updatedAt`; `id` is the reserved draft `caseId`. |
| Consent Grant | `id`, `caseId`, `grantorCitizenId`, `recipientType`, `recipientId`, `purpose`, `actions`, `expiresAt`, `revokedAt` or null, `createdAt`, `version`; explicit and default-deny. |
| Evidence item | `id`, `caseId`, `kind`, `sourceRef`, `sourceVersion`, protected content/reference, `observedAt`, `createdBy`, nullable `supersedesId`; append-only corrections. |
| Rule Version | `id`, `version`, `parameters`, `publishedAt`, `publishedBy`, content digest; published content is immutable. |
| Assessment | `id`, `caseId`, `assessedAt`, `evidenceVersion`, `ruleVersionId`, source-version manifest, findings, contradictions, missing evidence, AI run references; immutable. |
| Resolution | `id`, `caseId`, `assessmentId`, `officerId`, `reason`, `resolvedAt`; creation is part of the atomic resolution transaction. |
| Audit event | `id`, `caseId` or null, `actorId`, `actorKind`, `action`, `occurredAt`, `authorizationRefs`, `requestId`, relevant opaque event/version references; no raw evidence or sensitive prompts. |
| API key | `id`, `principalId`, secret hash, `scopes`, `expiresAt`, nullable `revokedAt`, `createdAt`; never store or log plaintext keys. |
| Idempotency record | Principal, operation, key, canonical validated request digest, completion state, result reference, and creation time; unique per principal/operation/key. |

Candidate consent `recipientType` values are `PRINCIPAL`, `DEPARTMENT`, and `AI_PROCESSOR`; a helper or service principal uses `PRINCIPAL`. Candidate action values are `READ_CASE`, `READ_EVIDENCE`, `WRITE_DRAFT`, `ADD_EVIDENCE`, `SUBMIT_CASE`, `REQUEST_ASSESSMENT`, `REVIEW_CASE`, `RESOLVE_CASE`, `CLOSE_CASE`, and `PROCESS_AI`. The authorization module intersects grant actions with the recipient's role and case assignment; a Citizen cannot grant a Helper resolution powers simply by inserting an action value. Consent purposes are explicit disclosed identifiers with audio/visual explanations, not arbitrary hidden text. The owner freezes exact purpose identifiers and demo expiry values before implementation.

The draft reserve is a candidate bootstrap for case-specific consent: an authenticated Citizen reserves an owner-bound `caseId` before helper sharing, so a helper never needs blanket access to create their own authorization. Server saving is optional until connectivity returns; an in-memory draft has no persisted-success claim. The reserved owner record survives submission, while its mutable draft content is promoted to protected evidence and cleared or referenced rather than becoming a second historical evidence store. Submission atomically creates the Case at the same `caseId`; no `DRAFT` value is added to the approved Case enum. This bootstrap and its migration representation require explicit owner review at the freeze gate.

Source-record corrections and new evidence increment `evidenceVersion` or change the source-version manifest, invalidating resolution freshness. A correction never silently edits authoritative identity/payment records; Citizen-supplied corrections are evidence until the responsible synthetic service publishes a new source version. Signed Notices, prior Assessments, published rules, and audit events cannot be edited in place.
