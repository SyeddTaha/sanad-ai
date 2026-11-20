# SANAD v1 contracts

Revision: `candidate-v1.0.0`. Validation gate: **awaiting review; not frozen**.
Transport namespace: `/api/v1`. This module has no routes or server services.

Authority: [canonical spec](../../../../.scratch/sanad-verification/spec.md),
[glossary](../../../../GLOSSARY.md), and [ADRs 0001–0006](../../../../docs/adr/).
The requested backend-lead work authorizes this initial executable projection;
it does not record a named human owner or affected-developer approval.

Import runtime schemas and inferred types from `@/contracts/v1`. Synthetic
examples have a separate `@/contracts/v1/fixtures` entry so importing contracts
does not include demo evidence. Object schemas reject unknown keys, perform no
coercion, and require explicit nulls where the spec calls for nullable fields.
Parsing data never establishes identity, consent, source truth, or authorization.

## Consumer imports

| Consumer | Exported contracts |
| --- | --- |
| Citizen/helper and review UI | `CaseSchema`, `CaseStatusSchema`, `CaseTransitionSchema`, `EvidencePassportSchema`, `ConsentGrantSchema`, `ConsentActionSchema`, `ApiSuccessSchema`, `ApiCollectionSchema`, `ApiErrorEnvelopeSchema` |
| Developer 2's crypto spike | `SignedNoticeHeaderSchema`, `SignedNoticePayloadSchema`, `CompactJwsSchema`, six individual finding/result schemas, `SourceReferenceSchema` |
| AI and rules consumers | `RuleParametersSchema`, `RuleVersionSchema`, `AssessmentSchema`, `AiAssessmentMetadataSchema`, advisory classification/route enums and explanation references |
| Future backend policy evaluator | `RoleSchema`, `PrincipalSchema`, `AuthorizationContextSchema`, consent schemas, `ResolveCaseRequestSchema` |

Every concrete schema exports its corresponding inferred TypeScript type without
the `Schema` suffix. Envelope/collection factories also expose generic
`ApiSuccess<T>` and `ApiCollection<T>` types. `CONTRACT_REVISION` and
`API_BASE_PATH` identify this candidate boundary. Scalars are shared exports.

```ts
import { EvidencePassportSchema, ApiSuccessSchema } from "@/contracts/v1";
import type { EvidencePassport, ApiSuccess } from "@/contracts/v1";
import { evidencePassportSuccessFixture } from "@/contracts/v1/fixtures";

const response: ApiSuccess<EvidencePassport> =
  ApiSuccessSchema(EvidencePassportSchema).parse(evidencePassportSuccessFixture);
```

The fixtures include a pending-payment Passport, missing-payment Passport,
independent helper/department grants, server-context shape, Case, Assessment,
Rule Version and success/validation-error envelopes. `satisfies` checks their
inferred types at compile time; tests validate them at runtime. All examples are
synthetic, including simulated `VALID` findings and illustrative rule parameters.

Zod behavior was checked against its [official API reference](https://zod.dev/api).

## Approval ledger

Accepted invariants are the independent findings, six Case states, scoped
independent sharing, exact `Ed25519` algorithm, integer minor units, immutable
assessment/rule history, and human resolution with freshness checks. The
following executable details remain candidates, not new accepted decisions.

| Item | Candidate / open decision | Source |
| --- | --- | --- |
| Ownership and freeze | Name the human schema/migration owner and collect affected-developer approval. No parallel feature integration is cleared by passing schema tests. | G1/G2, ADR 0005 |
| Scalars and limits | UUID IDs, 1–64 ASCII references, UTC `Z` timestamps, `PKR`, positive revisions; exact limits, reason/message key catalogs and explanation translations need review. | Spec §2–5 |
| Notice wire format | `v: 1`, camelCase payload fields, `typ: sanad-notice+jws`, three nonempty base64url segments and 8,192-character transport limit. Parsing an object or token shape does not verify bytes or reject duplicate JSON members already discarded by a parser. | Spec §3; G3 |
| Grants and scopes | Role/action codes and `PRINCIPAL`/`DEPARTMENT`/`AI_PROCESSOR` recipient codes follow the candidate spec. Purpose uses an opaque Reference until disclosed purpose IDs and Urdu/English/audio copy are approved. Nonempty unique action arrays, expiry after creation and withdrawal no earlier than creation are candidate shape checks. No default purpose, expiry or consent is supplied. | Spec §5–6 |
| Authorization context | Server-only *use* of the shared data shape: principal, target ownership/assignment, department IDs, grants, nullable API-key scopes and evaluation time. These context field names are a new projection for review; clients must never supply them as authority. No role/action policy evaluator is implemented. | ADR 0002; spec §6 |
| Dispatch and bootstrap | `ASSIGN_CASE`/`ESCALATE_CASE`, admin dispatch projection, reserved draft Case ID and Citizen confirmation/handoff remain unresolved. No draft or dispatch service is implemented. | Spec §5–6; G2 |
| Transition shape | `{from, to}`, null `from` for initial submission, plus expected version and reviewed Assessment/reason in resolution input. Open states interrupt to `PENDING_CONSENT`; terminal states do not. Terminal withdrawal semantics require approval. Schema validity does not check actor, grants, time, or transaction freshness. | ADR 0004; spec §7 |
| Findings and sources | Candidate result/reason enums follow §4. Source service is an opaque Reference pending a finite service catalog. Null record/version denotes a service attempt; both are present for record sources. Contradictions use `{fields, sourceRefs}` and missing evidence uses opaque identifiers; these nested shapes need approval. Reason applicability and record ownership require trusted producers. | Spec §4 |
| Rules | `maxMonthlyIncomeMinor`, `minRoutingConfidence`, `integrityFailurePriority`, plus `contentDigest` as a lowercase SHA-256 hex string, are candidate field/encoding choices. No live policy threshold or business loss weight is selected. | Spec §5, §8; G6 |
| Assessment and AI metadata | `sourceVersions` uses the source-reference schema; `evidenceRefs` and `aiRunIds` hold opaque UUIDs. AI metadata uses `modelVersion`, `promptVersion`, `outputSchemaVersion`, `explanationRefs` and nullable `failureCode` (opaque sanitized identifier). Nonempty version labels can include model identifier punctuation. Explanation refs are `{factId, explanationKey}` with Reference grammar; failure/unauthorized records have no advisory output. Successful metadata requires run ID, versions, score/classification/route; unavailable-without-run has null versions. These names and nullability refinements require AI developer review; no AI provider/output grounding is implemented. | Spec §4–5, §10 |
| Envelopes | `{data, requestId}` / `{requestId, error}`, field paths as strings, message keys matching ASCII letters/digits/underscore/dot/hyphen, listed error codes/status mapping, and `{items, nextCursor}` collections are candidates. Non-null cursors are nonempty strings. Error payloads reject raw input/exception fields; producers still must sanitize string values. Pagination limits and transport/body-size enforcement belong to later endpoints. | Spec §2 |
| OpenAPI and remaining interfaces | Endpoint/security OpenAPI, draft, mock lookup and full AI output contracts remain freeze prerequisites for their consumers. Zod exports are the source for later documentation generation; no generated OpenAPI artifact or endpoint is claimed here. | ADR 0005; G2 |

## Scope and validation

Contract tests cover parsing/rejection, independent findings, transition shapes,
and synthetic examples/envelopes. They do not establish runtime RBAC, consent
withdrawal enforcement, idempotency, transactional freshness, source truth,
cryptographic validity, live AI or deployment. Developer 2 owns the exact-JOSE
feasibility spike, duplicate-member handling, original-byte verification, trusted
registry checks and signed mutation fixtures. No signing keys or signed tokens
are provided here. `VALID` examples are simulated finding data only.

The official PDF is absent; the available Markdown brief is provisional (G4).
G5/G6 services and narration are outside this task. Stop here at the contract
validation gate; record approval before dependent feature work.

Commands: `npm run test:contracts`, `npm run typecheck`, `npm run lint`,
`npm run build`.

Executed on 21 November 2026:

| Check | Actual result |
| --- | --- |
| Focused `npx tsx --test src/contracts/v1/<area>.test.ts` runs | Red observed before each new slice; subsequent green runs passed. |
| `npm test` (initial seven-file suite) | Exit 0; 24 passed, 0 failed, 0 skipped before review regression was added. |
| `npm run test:contracts` (final seven-file suite) | Exit 0; 25 passed, 0 failed, 0 skipped, including the timestamp-precision regression. |
| `npm run typecheck` | Exit 0, including another run after the build. |
| `npm run lint` | Exit 0; no diagnostics. |
| `npm run build` | Exit 0; starter `/` and `/_not-found` generated. Next.js warned about an ignored lockfile in the parent Projects directory. |
| `git diff --check` | Exit 0. |

The successful build verifies compatibility with the starter application. No
contract HTTP route, hosted feature, runtime authorization check or crypto/AI
acceptance test is claimed by these results.

## Standards review

Reviewed from task-start commit `be43c7c2d9862b4ff53c4791b2694d3c297ff149`.
The separate Standards reviewer found one tautological catalog assertion. It
was replaced with an independent expected error/status mapping from spec §2.
Recheck: no remaining documented-standard violations or baseline smells.

## Spec review

The separate Spec reviewer confirmed the bounded scope and found a timestamp
precision defect also reproduced during parent review: `Date.parse` truncated
valid RFC3339 fractions beyond milliseconds. Consent chronology now compares
validated UTC seconds and full fractional precision. A public-schema regression
failed before the fix and passed afterward. Recheck: no remaining Spec findings.

Review totals: Standards 0 remaining; Spec 0 remaining. Contract-owner and
affected-developer approval remain pending; code review is not contract freeze.

## Changed files

All paths below are relative to `src/contracts/v1/` except the package files.

| Files | Purpose |
| --- | --- |
| `index.ts` | Public versioned import boundary and revision/path constants |
| `scalars.ts` | Reused validated scalars and inferred types |
| `authorization.ts`, `consent.ts` | Role, principal, context, grant and action shapes |
| `notice.ts` | Notice header/payload and transport syntax shapes |
| `evidence.ts` | Six independent findings and source references |
| `case.ts` | Case states, metadata, transitions and resolution request |
| `assessment.ts`, `ai-metadata.ts` | Rule/assessment provenance and advisory AI metadata |
| `fixtures.ts` | Shared synthetic examples with inferred-type checks |
| `api.test.ts`, `assessment.test.ts`, `case.test.ts`, `consent.test.ts`, `evidence.test.ts`, `exports.test.ts`, `notice.test.ts` | 25 public-boundary behavior tests |
| `README.md` | Approval ledger, import guide, limitations and validation/review evidence |
| Root `package.json`, `package-lock.json` | Pinned Zod and test runner; test and typecheck scripts |
