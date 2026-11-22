# B05 verification

Baseline: `d31994f` (B04 PR #11, confirmed merged). Branch: `feat/public-api`.
All data is synthetic. The implemented B05 verification gate passes.
PR: [#17](https://github.com/SyeddTaha/sanad-ai/pull/17).

## Completed checks

| Check | Actual result |
| --- | --- |
| TDD issuance seam | Missing handler failed first; one-time issuance/retry/list then passed. |
| TDD key-authentication seam | Authorized draft read failed with 401 before integration; passed afterward. |
| TDD OpenAPI seam | Missing route failed first; generated document validates with Swagger Parser and exact method/path coverage afterward. |
| Focused API-key tests | 10 passed, no failures/skips; includes role/scope/owner/withdrawal/replay/revocation/expiry/input/audit rollback behavior and expired issuance retries. |
| OpenAPI tests | Document validation, exact route coverage and synthetic request schema examples passed. |
| Contract tests | 25 passed, no failures/skips. Frozen v1 exports unchanged. |
| Full backend suite | Final source: 81 passed, no failures/skips. First run caught the seed test's old migration list; updated to include B05, retaining idempotent migration assertions. |
| Development migration | `20261122001100_scoped_api_keys.sql` applied; repeat reports none, already current. Demo seed succeeded. |
| Production build | Passed after removing unsupported route config exports under Cache Components. Public OpenAPI is static; key operations dynamic. |
| Typecheck / lint | Passed on the final application and API-key test source. |
| Initial B05 production HTTP | 9 passed, no failures/skips before the final verification fixes. Final results are recorded below. |
| Standards review | P2 expired issuance retry reproduced red (422), fixed to replay metadata/key:null, green. P3 SQL-spelling-dependent race observation replaced with PID blocker relationships. Recheck: no actionable findings; optional policy-map consolidation deferred. |
| Spec/security review | No findings in read-only review of scopes, role ceilings, consent/replay, locking, secret handling and OpenAPI. |
| Configured-secret scan | Passed: 9 configured secret values checked against the feature diff and 86 public static assets, no values printed. |
| B01 live regression | 12 passed, no failures/skips on the rebuilt server. First run exposed stale migration-count and pre-B04 Admin membership expectations; assertions now verify required migrations and approved seed membership. |
| B02 live regression | 8 passed, no failures/skips; both consent withdrawal/write orderings observed. |
| B03 live regression | 12 passed, no failures/skips; real draft/submission/evidence/Assessment history, stale writes, consent replay denial, atomic audit rollback and direct-client privacy passed. |
| GitHub CI | Passed on final implementation/runner commit `f1e2212`: [CI run 44973279575](https://github.com/SyeddTaha/sanad-ai/actions/runs/44973279575). Earlier implementation/fix commit `ec18ff9` also passed. |
| B04 first live run | First 11 scenarios passed, including stale evidence/rules, withdrawal, both publication lock orderings, competing resolutions and audit rollback. The last two failed: a concurrent B04 process on localhost:3400 published shared development rules during the happy path (`STALE_ASSESSMENT`), and a repeated fixed department name collided. |
| B04 focused rechecks | Happy resolution/close/withdrawal and reassignment/restored-sharing each passed after diagnosis (3 tests passed, 11 unrelated tests explicitly skipped per selected run). Department names now include their synthetic UUID; application freshness guards are unchanged. |
| B04 final full live regression | 14 passed, zero failures/skips after the other B04 process exited. Both rule-publication orderings, concurrent decisions/source changes, audit rollback, closure, reassignment and restored consent all passed on the unchanged application build. |
| B05 retained-history regression | A subsequent live run exposed a test assumption that its newly assigned Case appeared on the first default queue page. The test now follows bounded authorized cursor pages; no application pagination or permission was changed. Full green rerun below. |
| B05 final full live suite | 9 passed, zero failures/skips. Real Auth/OpenAPI, one-time issuance/hash storage, scoped read/write/submission, missing scope, cross-Citizen denial, withdrawal/replay, officer/admin workflow through closure, malformed/expired credentials, revocation race and secret-free audit all passed. |
| Actual final curl runner | `npm run demo:b05` exited 0. Five real curl requests produced 201 issuance, 200 authorized read, 403 INSUFFICIENT_SCOPE, 200 revocation, 401 INVALID_API_KEY. Shared schemas validate issuance/errors; credentials stay in memory/stdin. Unsupported top-level await and synchronous child execution were corrected before this successful run. |

## B05 gate

Passed: contracts, backend, scoped credentials/security, machine-readable OpenAPI,
real development migrations, production HTTP B01–B05 and the five-step curl demo.
Live counts are 12 / 8 / 12 / 14 / 9 respectively, all with zero final skips/failures.
No merge or subsequent implementation task is included.

## Changed files

| Files | Responsibility |
| --- | --- |
| `src/backend/api-keys/*`, `src/lib/api-key-contract.ts`, `src/app/api/v1/api-keys/*` | One-time issuance, private metadata, revocation, service identity and role-bounded scopes. |
| `src/backend/authorization/{transaction,service}.ts`, `src/backend/officers/http.ts` | Existing transaction/policy integration, credential locks, fresh scope/expiry checks and queue permissions. |
| `src/backend/openapi/*`, `src/app/api/v1/openapi/route.ts`, `src/backend/auth/password.ts` | Generated shared-schema documentation for 37 real operations across 32 paths, 22 accepting keys; reuses the existing login schema. |
| `supabase/migrations/20261122001100_scoped_api_keys.sql` | Private hash-only storage, expiry constraints and immutable credential history. |
| `tests/backend/api-keys.test.ts`, `tests/backend/openapi.test.ts`, `tests/integration/b05.live.test.ts`, existing seed/B01/B04 tests | Approved HTTP seams, security, OpenAPI coverage and compatible retained-fixture verification. |
| `scripts/demo-public-api.ts`, package scripts, `.env.example`, README and B05 docs | Executable real curl handoff, optional test URL and actual evidence. |

Concurrent uncommitted B04 test cleanup edits were observed after the final run;
they are preserved in the working tree and are not part of B05's final commit.

## Standards

The reviewer found an expired-issuance retry defect and a SQL-spelling-dependent
race assertion. Both were corrected and rechecked. The expiry regression failed
before the fix and passes afterwards. Optional consolidation of duplicated
operation/scope metadata remains a judgment call, deferred to preserve task scope.
There are no remaining actionable Standards findings.

## Spec

The separate reviewer found no missing/partial requirement, scope creep or
incorrect behavior in credentials, scope ceilings, consent/replay, locking,
secret handling or OpenAPI. A follow-up review accepted the expiry retry fix
and the B01 fixture/migration assertion updates without finding weakened
authorization. Reviewers performed read-only inspection, not test execution.

Review totals: Standards 0 actionable; Spec 0 findings. No known scoped P0/P1.

## Known dependency and deployment limitations

Developer 2 identity/payment/general program mock adapters are absent from the
merged baseline. No mock REST endpoint is fabricated or documented as live.
The four required lookup outcomes remain a dependency requirement. Separate
crypto/AI adapters exist but are not wired into B03/B04 Assessments by this task.
Public-host deployment/browser/audio acceptance remain outside B05 verification.

See [B05 handoff](b05-public-api.md) for endpoints, scope ceilings, locking,
one-time-secret semantics, repeatable `npm run demo:b05` and example curls.
