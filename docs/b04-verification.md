# B04 verification evidence

Baseline `6498e71` on `feat/officer-rules`. PR #8 verified merged using GitHub;
the tree was clean and local main fast-forwarded before branch creation.
The backend owner approved the fictitious demo policy on 21 November 2026.
See [integration and permission requirements](b04-officer-rules.md).

## Executed checks so far

| Check | Observed result on 21 November 2026 |
| --- | --- |
| `npm run test:contracts` | 25 passed, zero failed/skipped; frozen exports unchanged. |
| `npm run test:backend` on `ea65949` | 68 passed, zero failed/skipped. Includes 14 officer HTTP and three rule/assessment tests. |
| `npm run typecheck`, `npm run lint` | Exit 0. |
| Initial production build | Passed after removing unsupported `runtime` exports under Cache Components. Final reviewed-source build remains pending. |
| `npm run db:migrate` | All three B04 migrations applied to development Supabase; repeat reports already current. |
| Secret scan | Configured private values absent from changed content and 18 initial-build public assets; no values printed. |
| Documentation/diff | Nine local links resolve; `git diff --check` passes. |

Live verification remains in progress. The first full B04 run completed 11
passing tests and one failed subtest (plus its failed parent): the resolution-first
observer did not reach its barrier within the fixture's 12-second window. The
failure was minimized using `B04_LIVE_SCENARIO=resolution-first`. The observer
window ended before authorization/reassessment reached the injected SQL barrier.
The confirmed blocker appeared after 15.96 seconds. Increasing only the fixture
observation window to 30 seconds produced a passing real resolution-first run,
including a confirmed blocked publication; production lock timeout stays 15 seconds.
The selected diagnostic run passed three tests with ten explicit skips. Its debug
logging was removed; final gate evidence requires an unfiltered run with zero skips. Other live scenarios, including publication-first,
concurrent resolutions, source-change serialization, rollback and the complete
resolution/close/withdrawal-safe retry example, passed in that preliminary run.

## Focused reviews

Standards and Spec/security reviewers independently identified missing per-Case
queue audit provenance and the absence of a permission check after awaited audit.
Both were reproduced with failing HTTP regressions and corrected in `451fd2c`:
returned Case/grant references are audited in a bounded batch, followed by fresh
batch authorization using database time. Both reviewers confirmed the fixes;
no remaining material findings in that correction. Spec reviewer independently
ran 13 officer tests successfully.

Parent review also reproduced an ordering-information leak through an inaccessible
queue cursor. `ea65949` applies the same finite assignment/department/consent
predicate to candidate and cursor rows. The Spec reviewer confirmed the fix and
independently ran all 14 officer tests successfully. Officer confidence additionally
requires `READ_CASE` and `READ_EVIDENCE` under the same department grant.

No public deployment, browser, AI provider or B05 acceptance is implied by these
checks. Final live evidence and the gate outcome will be completed below.

## Changed files

| Files | Purpose |
| --- | --- |
| `src/backend/officers/{http,pagination,reads,resolution,workflow}.ts` | Authorized queues, action-specific workflow, protected evidence/decision/source reads, minimal Auditor metadata and atomic resolution. |
| `src/backend/rules/{http,service,eligibility}.ts` | Validated immutable publication, current-pointer locking, historical reads and bounded synthetic eligibility evaluation. |
| `src/backend/authorization/{policy,service,transaction}.ts` | Exact department dispatch scope, shared batch/single-case authorization, ordered reservation locks and common active department-sharing check. |
| `src/backend/cases/assessments.ts` | New Assessments use current published rules and scoped versioned synthetic program inputs, retaining explicit unavailable sources. |
| `src/lib/{officer-contract,rule-contract}.ts` | Browser-safe endpoint schemas and inferred DTO types outside the frozen v1 boundary. |
| `src/app/api/v1/admin/dispatch/route.ts`, `audit/route.ts`, `rules/{current,publish,[ruleId]}/route.ts` | Dispatch, minimal audit and rule HTTP routes. |
| `src/app/api/v1/cases/route.ts`, `cases/[caseId]/evidence/route.ts` | Add queue/evidence GETs; existing submission/evidence POSTs remain. |
| `src/app/api/v1/cases/[caseId]/{assign,priority,start-review,request-evidence,resubmit,escalate,resolve,close,decisions,program-inputs}/route.ts` | Explicit workflow and protected record routes. |
| `supabase/migrations/20261121000800_published_rules.sql` | Immutable rules, current pointer and known Assessment basis guard. |
| `supabase/migrations/20261121000900_officer_decisions.sql` | Immutable private decisions, same-Case Assessment/rule references and locking. |
| `supabase/migrations/20261121001000_synthetic_program_inputs.sql` | Versioned case-scoped demo source, author validation and atomic evidence invalidation/audit. |
| `scripts/demo-accounts.ts` | Demo Admin department membership for consent-scoped dispatch. |
| `tests/backend/{officers,rules}.test.ts` | Approved HTTP/assessment/lifecycle/authorization/audit seams using real embedded PostgreSQL. |
| `tests/backend/{cases,case-storage,seed}.test.ts`, `tests/support/case-fixture.ts` | Known-basis fixture compatibility, migration inventory and direct database denial for all new private tables. |
| `tests/integration/{b03,b04}.live.test.ts` | B04 actual Auth/PostgreSQL/HTTP scenarios and B03 compatibility with published policies. |
| `package.json`, `.env.example` | Live command and optional origin override, no new secrets/dependencies. |
| `README.md`, `docs/b04-officer-rules.md`, `docs/b04-verification.md` | Staff handoff, approved parameters, endpoint examples and exact verification limits. |
