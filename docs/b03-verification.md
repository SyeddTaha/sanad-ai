# B03 verification gate

Baseline `5587ab6`: PR #4 verified merged using GitHub, clean tree, main pulled
with fast-forward only, feature branch `feat/cases-evidence` created from main.

On 21 November 2026 the human owner approved draft GET/PATCH compositions and
the explicit unavailable rule basis. Frozen v1 exports remain unchanged. See
[integration instructions](b03-cases-evidence.md).

## Executed checks

| Check | Actual result on 21 November 2026 |
| --- | --- |
| `npm run test:contracts` | 25 passed, 0 failed/skipped; frozen exports unchanged. |
| `npm run test:backend` | 51 passed, 0 failed/skipped, including 13 B03 HTTP and 3 B03 database tests. |
| `npm run typecheck` | Exit 0. |
| `npm run lint` | Exit 0. |
| `npm run build` | Exit 0, including all eight new route files / nine HTTP operations. |
| `npm run db:migrate` | All four B03 migrations applied to development Supabase; repeat reports already current. |
| Diff/public assets secret check | Passed against configured private values, changed content and 11 browser build assets; values never printed. |
| Documentation/diff checks | Eight local links resolved; `git diff --check` passed; frozen contracts unchanged. |

Final live B03/B02 suites are running against the production build containing
the authorization review fix. Their final results will be recorded before push.

The backend suite initially found an outdated seed-test expectation of three
migrations. It now checks the explicit seven-file inventory and repeat seeding
still passes. A final build attempt encountered OneDrive's Windows `EPERM` while
clearing generated `.next` content. Moving only the verified generated cache to
ignored `build/b03-previous-cache` allowed a fresh successful production build.
The existing ignored parent-directory lockfile warning remains nonfatal.

## TDD and review evidence

Observed red before green at the approved HTTP/storage seams: missing private
tables, absent Case/Passport workflow, draft/submission, independent unknown
Assessment generation, evidence addition, history, and submitted-input guards.
Later regression tests protect malformed/stale input, original draft and Case
outcome replay, foreign ownership, scoped helper submission, withdrawal denial,
independent AI consent, immutable evidence/source/timestamp/contradiction history,
terminal write rejection and atomic rollback.

**Standards:** separate fresh-context reviewer found a P2: B03's authorization
checked an expired officer grant before committing lazy consent interruption.
The HTTP regression failed with the later Citizen read credited as actor.
B03 now uses the shared B02 `withAuthorizedCase` wrapper, and the regression
passes with the officer credited before their denied request returns. The
associated duplicate-authorization heuristic was resolved by that consolidation.
Reviewer recheck of `afc54c7`: both findings resolved, no new material findings.

**Spec/security:** separate fresh-context reviewer found no confirmed P0–P2
findings; recheck of the authorization consolidation found no confirmed
authorization/idempotency/rollback regressions. Reviews were static inspections;
the executed tests above and live evidence are separate verification.

## Changed files

| Files | Purpose |
| --- | --- |
| `src/lib/case-contract.ts` | Owner-approved browser-safe endpoint compositions. |
| `src/backend/cases/{http,drafts,submission,evidence,assessments,history,idempotency}.ts` | Authorized HTTP workflow and transactional persistence. |
| `src/backend/authorization/service.ts` | Extend the existing boundary for prepared requests, complete purpose paths, compound permissions and final AI-consent check; retain denial reconciliation. |
| `src/backend/consent/http.ts` | Reuse the bounded body reader with its original B02 default and B03's 64 KiB limit. |
| `src/app/api/v1/case-drafts/[caseId]/route.ts` | Draft GET/PATCH. |
| `src/app/api/v1/cases/route.ts`, `cases/[caseId]/route.ts` | Submission and Case detail. |
| `src/app/api/v1/cases/[caseId]/{history,evidence,evidence-passport,assessments}/route.ts` | History, evidence addition, Passport retrieval and Assessment creation. |
| `src/app/api/v1/cases/[caseId]/assessments/[assessmentId]/trace/route.ts` | Protected historical Assessment trace. |
| `supabase/migrations/20261121000400_case_evidence.sql` through `20261121000700_case_input_guards.sql` | Four additive migrations; previously applied files unchanged. |
| `tests/backend/{cases,case-storage}.test.ts`, `tests/support/case-fixture.ts` | HTTP and database-seam TDD with real PGlite and external Auth boundary fixtures. |
| `tests/backend/seed.test.ts` | Explicit updated migration inventory; repeat-seed regression retained. |
| `tests/integration/b03.live.test.ts` | Real development Supabase/Auth/PostgreSQL and production HTTP acceptance. |
| `package.json`, `.env.example` | Live-test command and optional origin override; no new dependencies/secrets. |
| `README.md`, `docs/b03-cases-evidence.md`, `docs/b03-verification.md` | Integration instructions, approvals, limitations and verification evidence. |

## Limitations and gate

No crypto, mock-service, published-rule or AI adapter is implemented. The approved
unavailable rule basis is not a published eligibility policy and cannot support
resolution. Six independent findings remain unknown/not verified, and missing
checks remain explicit. Assessment trace supplies protected input references;
a standalone raw-evidence read API is a future integration, not a claimed B03
endpoint. No officer resolution, API-key auth, audio/UI redesign, public
deployment or browser acceptance is claimed. Live tests retain synthetic
immutable history and end their Auth sessions. No B04 work is started.
