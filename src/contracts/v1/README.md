# SANAD v1 contracts

Revision: `v1.0.0`.
Status: **frozen bounded contract baseline under delegated human-owner authority**.
Transport namespace: `/api/v1`. This module has no routes or server services.

Authority: [canonical spec](../../../.scratch/sanad-verification/spec.md),
[glossary](../../../GLOSSARY.md), and [ADRs 0001–0006](../../../docs/adr/).
On 21 November 2026, the requesting human SANAD project owner explicitly accepted
ownership of shared contracts and database migrations and approved all 17
consolidated contract decisions, the bounded baseline and its explicit deferrals.
The owner subsequently stated that the team delegates shared-contract approval
to them and explicitly authorized this bounded freeze. Individual teammate
signoff is no longer blocking under the [ADR 0005 governance amendment](../../../docs/adr/0005-shared-contracts-and-central-mock-services.md#governance-amendment--21-november-2026).
No individual developer reviews or approvals are asserted.

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
`API_BASE_PATH` identify this frozen bounded baseline. Scalars are shared exports.

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

Approval source: the human owner's explicit approval in the project conversation
on 21 November 2026. Owner declaration: "I am the named human owner of shared
contracts and database migrations." Approved baseline: the exported schemas,
inferred types and synthetic fixtures at commit
`11de106cd1e4ef8ac153c8c54aed07a40bee4156`. The three clarifications below constrain
their future use without changing the schema shapes. The six ADRs remain in force,
including ADR 0005's explicit delegated-approval amendment. The same human owner
authorized promotion from `candidate-v1.0.0` to `v1.0.0` on 21 November 2026.

| Decision | Owner-approved bounded decision | Source |
| --- | --- | --- |
| 1. Freeze boundary | Only current exports/types/fixtures are frozen as `v1.0.0`; `/api/v1` is retained. The delegated owner explicitly authorized promotion; individual teammate signoff is no longer blocking. Fresh contract tests/typecheck/lint/build and normal GitHub protections remain merge criteria. This bounded freeze does not clear the broader G2 integration gate. | G1/G2; ADR 0005 amendment |
| 2. Scalars and validation | Strict objects, no coercion, explicit nulls, UUID IDs, 1–64 ASCII references, UTC `Z` timestamps with full fractional precision, nonnegative safe integer money/epoch seconds, positive safe revisions, `PKR`, confidence 0–1. | Spec §2–5 |
| 3. Limits | JWS limit 8,192 characters and meaningful resolution reason limit 2,000. JSON 64 KiB, message 16,384, dispute 2,000 and pagination 20/100 remain future endpoint requirements. Signed-fixture size verification remains pending. | Spec §2–3 |
| 4. Roles and context | Current `CITIZEN`/`HELPER`/`OFFICER`/`ADMIN`/`AUDITOR`, principal and server-derived authorization context shapes, including nullable assignment/key scopes. Parsing grants no authority. | ADR 0002; spec §6 |
| 5. Grants | Current grant fields, `PRINCIPAL`/`DEPARTMENT`/`AI_PROCESSOR`, nonempty unique actions, expiry after creation, nullable withdrawal no earlier than creation; independent grant lifecycles and no defaults. | ADR 0002/0006; spec §5–6 |
| 6. Actions and dispatch | Existing 12 actions, including `ASSIGN_CASE`/`ESCALATE_CASE`. Admin dispatch uses minimal metadata under department sharing; assigned Officers escalate within their department. Exact dispatch DTO/matrix and enforcement remain deferred. | ADR 0002/0004; spec §6 |
| 7. Purposes and expiry | `purpose: Reference` is structural only. Existing `synthetic_helper_assistance`, `synthetic_department_review` and `2026-11-22T13:00:00Z` are fixture examples only. No AI/audit purpose or default lifetime is invented; operational authorization requires the allowlist below. | Spec §5–6; clarification 1 |
| 8. Signed Notice | Current exact `Ed25519`/`kid`/`sanad-notice+jws` header, `v: 1` payload fields and three-segment transport syntax. Original-byte verification, duplicate JSON rejection, trusted key binding and JOSE feasibility remain Developer 2's gate. No `EdDSA` alias. | ADR 0003; G3 |
| 9. Case and lifecycle | Current Case metadata, nullable related Case/assignment, `NORMAL`/`HIGH`, six states, permitted `{from,to}` transitions, null initial `from` and resolution `{expectedVersion,reviewedAssessmentId,reason}`. Assignment/status changes do not invent evidence changes. | ADR 0001/0004; spec §7 |
| 10. Bootstrap and terminal consent | Citizen reserves an owner-bound Case ID retained at submission; no `DRAFT` Case state. Sharing needs Citizen confirmation. Open states interrupt to `PENDING_CONSENT`; restoration goes to `SUBMITTED`. Withdrawal preserves `RESOLVED`/`CLOSED` history but stops delegated access; closing still requires authorization. Handoff/bootstrap implementation remains deferred. | ADR 0002/0004/0006 |
| 11. Independent findings | Current six result enums and `{result,reasonCodes,sourceRefs,observedAt}` shape. No combined verdict; missing payment stays unknown. | ADR 0001/0003; clarification 2 |
| 12. Reasons and sources | Existing 16 reason codes; record/version pair both present or both null; contradictions `{fields,sourceRefs}`; opaque missing-evidence IDs. Operational service/explanation catalogs remain pending. Missing and contradictory payment evidence use distinct reasons below. | Spec §4; clarification 2 |
| 13. Rules | Current Rule Version fields and three parameters; digest encoding is 64 lowercase SHA-256 hex characters. Fixture values `1000000`, `0.75`, `HIGH` and zero digest are illustrative, not live policy/calibration or a computed digest. | ADR 0004; spec §8; G6 |
| 14. Assessment and Passport | Current evidence/source/rule/AI provenance shapes; UUID evidence/run refs; six top-level Passport findings and independently nullable Case status. Immutability/freshness enforcement remains deferred. | ADR 0001/0004 |
| 15. AI metadata | Current statuses, classification/route enums, version labels, explanation refs and nullable failure code. Success needs run/version/advisory values; failures have no invented advisory values; no-run records have null versions. Grounding/catalog/provider work remains deferred. | ADR 0001/0004/0005; clarification 3 |
| 16. API envelopes | Current success/error/collection shapes, HTTP error mapping, string field paths, `[A-Za-z0-9_.-]+` message keys and null/nonempty cursors. Raw input/exception fields are excluded; producers must sanitize values. | ADR 0002/0005/0006; spec §2 |
| 17. Deferred gates and source authority | Deferred work listed below remains pending. The official PDF remains absent and Markdown fidelity unverified; this approval does not supply source verification or operational evidence. | G2–G6 |

### Binding owner clarifications

1. **Consent purpose allowlist:** `ConsentPurposeSchema` validates identifier
   syntax only. The future server authorization boundary must validate each
   purpose against a server-controlled operational allowlist for its disclosed
   use. Arbitrary purpose strings cannot authorize access. The allowlist and
   runtime enforcement are not implemented by this baseline.
2. **Payment evidence reasons:** missing payment records use `RECORD_NOT_FOUND`;
   contradictory payment details use `DETAILS_MISMATCH` (and
   `RECIPIENT_MISMATCH` when specifically applicable). These reasons remain
   distinguishable. Neither automatically establishes `FAILED`; missing payment
   remains `UNKNOWN`, and a mismatched record is not this Citizen's payment proof.
3. **Advisory AI confidence:** confidence is advisory and is not assumed to be a
   calibrated probability. It cannot establish authoritative findings, authorize
   financial decisions, override deterministic evidence or resolve a Case.

### Explicitly pending

- Full draft and endpoint contracts.
- Mock service interfaces.
- Full AI output contracts.
- Runtime authorization and persistence.
- OpenAPI projection.
- Crypto feasibility (Developer 2).
- AI provider feasibility.
- Accessibility and deployment verification.

Operational catalogs, source-PDF verification and live demo parameters remain
subject to their recorded gates; fixture examples are not operational approvals.

### Freeze governance and merge criteria

The designated human backend lead and shared-contract/database-migration owner
stated that the team delegates shared-contract approval to them and authorized
the bounded `v1.0.0` freeze. This supersedes the previous individual-signoff gate;
it does not fabricate teammate reviews. The revision and export assertion are
promoted together. No schema shape, synthetic fixture or runtime feature changes.

Merge PR #2 only after `npm run test:contracts` (25 existing tests),
`npm run typecheck`, `npm run lint` and `npm run build` pass on the promoted
source. Record actual evidence in this ledger and the PR, mark the PR ready for
review, and use GitHub's normal merge path without bypassing branch protection.
Future shared-contract changes require the delegated owner's explicit approval
and coordinated contract/fixture/test updates. Deferred interfaces and
integrations retain their own gates. B01 is not authorized by this freeze.

## Scope and validation

Contract tests cover parsing/rejection, independent findings, transition shapes,
and synthetic examples/envelopes. They do not establish runtime RBAC, consent
withdrawal enforcement, idempotency, transactional freshness, source truth,
cryptographic validity, live AI or deployment. Developer 2 owns the exact-JOSE
feasibility spike, duplicate-member handling, original-byte verification, trusted
registry checks and signed mutation fixtures. No signing keys or signed tokens
are provided here. `VALID` examples are simulated finding data only.

The official PDF is absent; the available Markdown brief is provisional (G4).
G5/G6 services and narration remain outside this task. The human-owner approval
above freezes the bounded contract baseline; dependent work still requires
its applicable deferred integration gates.

Commands: `npm run test:contracts`, `npm run typecheck`, `npm run lint`,
`npm run build`.

Executed on 21 November 2026 for baseline commit `11de106` (before this
documentation-only approval record; these are not post-promotion results):

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

Approval-record verification on 21 November 2026: `git diff --check` passed;
all 17 local links/anchors in the three changed Markdown files resolved; all 17
approval entries and three clarifications were present; schema/type/fixture/test
sources and package files were unchanged. Contract tests, typecheck, lint and
build were not rerun for that documentation-only record. Fresh promoted-source
validation is recorded separately below; that historical record is not its evidence.

### Frozen v1.0.0 verification — 21 November 2026

The following checks were rerun on the promoted `v1.0.0` source under the
delegated owner's freeze authorization, before committing and pushing the freeze:

| Check | Actual result |
| --- | --- |
| `npm run test:contracts` | Exit 0; 25 passed, 0 failed, 0 skipped, including the `v1.0.0` export assertion. |
| `npm run typecheck` | Exit 0; no diagnostics. |
| `npm run lint` | Exit 0; no diagnostics. |
| `npm run build` | Exit 0; production compilation/typecheck/static generation completed. Same ignored parent-directory lockfile warning; no build failure. |
| Freeze consistency | Exit 0; 20 local links/anchors and all 17 approval entries checked; 25 existing tests retained; schema logic, fixtures and dependencies preserved. |
| `git diff --check` | Exit 0. |

This evidence establishes contract validation and starter-application build
compatibility only. Runtime authorization, persistence, crypto, AI, accessibility
and deployment are not verified. All explicit deferred gates remain in force.
GitHub review/check/protection status must still permit the normal PR merge;
no individual developer reviews or approvals are fabricated. B01 is not started.

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

Historical implementation review totals: Standards 0 remaining; Spec 0 remaining.
Delegated human-owner approval and the bounded freeze are recorded above.
Individual reviews are not asserted or required by that delegation. Code review
and schema checks do not establish runtime integration verification.

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
| Root `SPEC.md`, `.scratch/sanad-verification/spec.md`, `docs/adr/0005-shared-contracts-and-central-mock-services.md` | Canonical approval/freeze status and delegated contract-approval governance |
