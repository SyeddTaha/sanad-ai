# B04 verification evidence

Branch `feat/officer-rules`; [PR #11](https://github.com/SyeddTaha/sanad-ai/pull/11).
Baseline `6498e71`: PR #8 verified merged using GitHub, clean working tree,
local main fast-forwarded before branch creation. The backend owner explicitly
approved the fictitious demo policy on 21 November 2026. See the
[staff endpoint/DTO/permission handoff](b04-officer-rules.md).

## Executed checks

Results were captured across 21?22 November 2026. Embedded tests use real PGlite
PostgreSQL and mock only the external Auth boundary. Live tests use real
Supabase Auth/PostgreSQL and production Next.js HTTP, with synthetic data only.

| Check | Actual result |
| --- | --- |
| `npm run test:contracts` | 25 passed, zero failed/skipped; frozen v1 exports unchanged. |
| `npm run test:backend` | 69 passed, zero failed/skipped, including 15 officer HTTP and three rule/assessment tests. Rerun after current-main integration. |
| Upstream client/staff offline tests | 26 passed, zero failed/skipped. |
| Upstream adapter/AI/notice offline tests | 40 passed, zero failed/skipped; no real AI-provider invocation claimed. |
| `npm run typecheck`, `npm run lint` | Exit 0 after current-main integration. |
| `npm run build` | Exit 0 using current main's Webpack production command; includes all B04 operations and upstream Citizen/staff pages. |
| `npm run db:migrate` | All three B04 migrations applied to development Supabase; repeat reports already current. |
| Main B04 production HTTP acceptance | 13 passed, zero failed/skipped, including both publication/resolution orderings, competing resolutions, concurrent source changes, stale evidence/rules, withdrawal, history and atomic rollback. |
| Final reassignment HTTP check | 3 passed, zero failed; 11 unrelated scenarios explicitly skipped using `B04_LIVE_SCENARIO=dispatch-only`. Real setup plus transfer/restoration/review/resolution/closure passed on final merged build. |
| B03 live regression | 12 passed, zero failed/skipped, on the final merged production build; fresh run completed after the interrupted connection-reset attempt. |
| B02 live regression | 8 passed, zero failed/skipped, including both withdrawal/write orderings, rollback, scoped helper access and direct database denial. |
| GitHub CI | [Run #15](https://github.com/SyeddTaha/sanad-ai/actions/runs/44951365421) passed on merged source `42eeb52`. |
| Secret scan | Configured private values absent from changed content and 72 merged-build public assets; values never printed. |
| Documentation/diff | Local links resolve; `git diff --check` passes. |

The unfiltered B04 run above used the reviewed resolution/rule/authorization
implementation before the final one-line post-assignment consent reconciliation.
All main integration merges preserved B04's API, consent, assessment and database
source. The final targeted HTTP scenario validates that assignment delta on the
current merged build, including restoration, fresh review, resolution and closure;
the complete 69-test backend run also includes that correction.

## Main integration

Main advanced during verification. Merge `6acbca2` incorporated PR #9's Citizen
accessibility work. Merge `42eeb52` incorporated main `800013f`, including staff
screens, CI/deployment configuration, AI/assessment adapters and trusted issuer
registry work. Both merges were clean. B04's authentication, authorization,
Cases, officer/rule services, endpoint compositions, HTTP routes and database
source were checked by Git tree hashes and remained unchanged across those
merges. No frontend, AI, cryptographic or B05 feature was implemented by B04.

Fresh contracts/backend/compatibility tests, typecheck, lint and the production
build passed after integration. One extra-test invocation incorrectly applied
server React conditions to client tests; splitting client/server commands
produced the 26/40 passing results recorded above, without application changes.

## TDD and focused review

Red preceded green at the approved queue, publication, freshness, transactional
resolution, lifecycle, authorization and audit seams. Regression tests cover
unassigned/cross-department denial, dispatch projection, rule immutability,
unavailable/stale rules, evidence changes, withdrawal/replay denial, valid human
dispositions, transitions, immutable history and rollback. Live barriers inspect
actual PostgreSQL blocking relationships instead of guessing transaction order.

### Standards

The independent Standards reviewer found two P2 queue issues: missing Case/grant
references in queue disclosure audit, and no fresh permission check after awaited
audit. Both failed HTTP regressions before correction in `451fd2c`, and both
reviewer rechecks confirmed their fixes. Remaining material Standards findings: 0.

### Spec and security

The independent Spec/security reviewer confirmed those same two queue issues
and their corrections. Parent review additionally reproduced a foreign-cursor
ordering-information leak; `ea65949` applies identical visibility predicates to
candidate and cursor rows. The Spec reviewer confirmed this fix and independently
ran 14 officer tests successfully. Queue confidence requires both `READ_CASE`
and `READ_EVIDENCE` under the same department grant.

A final focused check found a P2 state gap when reassignment changed the assigned
department to one with dispatch-only sharing. The HTTP regression failed with
`UNDER_REVIEW`; `a792abd` reconciles sharing after changing assignment, before
recording the immutable decision and returning its final version. The regression
now returns `PENDING_CONSENT` and version +2. Spec recheck confirmed the correction.
Remaining material Spec/security findings: 0. No known P0/P1 remains in B04.

## Live verification history and limits

The first B04 run exposed an observation-window problem in its resolution-first
fixture: its 12-second wait ended before verified Auth and deterministic
reassessment reached the injected SQL barrier. A minimized run observed the
blocker at 15.96 seconds. Only the fixture observation window increased to 30
seconds; production SQL lock timeout remains 15 seconds. The focused rerun
passed, and the subsequent unfiltered 13-test B04 run passed with zero skips.
Temporary diagnostic logging was removed.

A B03 regression attempt was interrupted by `ECONNRESET` after a long connection
stall; its five passing subtests and cancelled remainder were not counted as a
successful run. Before retrying, PostgreSQL was reachable with no active
transactions or leftover test triggers. Fresh regression results are recorded
in the table above. Live tests retain immutable synthetic history and log out
their own sessions; narrow temporary failure/locking triggers are removed.

## Working resolution example

The unfiltered production run resolved and closed Case
`b46d8788-0c39-4437-ad25-eb2510177f96` with final Assessment
`9ee5199d-8591-4f53-a586-fc704ed5ecf4` and Resolution
`23767ab2-fac3-4219-ba40-878eb404c049`. Its exact retry returned the original
outcome, and subsequent consent withdrawal blocked Officer retry while retaining
Citizen-visible `CLOSED` history. These are observed development records, not
credentials or preauthorized reusable demo Cases. Use the handoff requests to
create a fresh Case with explicit sharing.

The final merged build also completed the dispatch-only transfer, consent
restoration, fresh review, resolution and close scenario for Case
`565bbf7c-e6df-4b67-a0a7-a6a641a31991`, final Assessment
`99add0ba-dbbf-4f1b-ab17-813868b872df`, and Resolution
`347b36f9-c548-4c42-ad71-f3da7c6404d0`. Its assignment returned
`PENDING_CONSENT` immediately; restored sharing required `SUBMITTED` and a new
Officer review before resolution.

## Gate and remaining boundaries

The B04 backend verification gate passes for the assigned scope. All required
security, lifecycle, freshness, concurrency, immutable-history and atomic-audit
behaviors have passing evidence. The final reassignment correction has both a
red/green HTTP-boundary regression and a successful real production HTTP scenario.
No scoped implementation blocker or known P0/P1 remains. Changes are committed
on `feat/officer-rules`; PR #11 is the review target. No direct push or merge to
main was performed. Work stops at B04.

Public deployment/browser/audio acceptance and full mock REST/API-key/OpenAPI
work retain their separate gates. Upstream AI/crypto adapters are preserved;
this B04 Case Assessment path does not wire those adapters into B03. Missing
source findings remain explicitly unknown/unverified. Only typed, labeled
case-scoped synthetic program inputs demonstrate the approved income rule.
Case Resolution never authorizes payment or rewrites evidence. B05 is not started.

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
