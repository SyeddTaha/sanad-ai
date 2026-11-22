# B05 verification

Baseline: `d31994f` (B04 PR #11, confirmed merged). Branch: `feat/public-api`.
All data is synthetic. This record is being completed during verification;
pending checks below are not passing claims.

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
| Initial B05 production HTTP | 9 passed, no failures/skips: real Auth/OpenAPI, one-time issuance/hash storage, scoped read/write/submission, missing scope, cross-Citizen denial, withdrawal/replay, officer/admin workflow, malformed/expired credentials, revocation race and minimal audit. Rechecking final retry fix separately. |
| Standards review | P2 expired issuance retry reproduced red (422), fixed to replay metadata/key:null, green. P3 SQL-spelling-dependent race observation replaced with PID blocker relationships. Recheck: no actionable findings; optional policy-map consolidation deferred. |
| Spec/security review | No findings in read-only review of scopes, role ceilings, consent/replay, locking, secret handling and OpenAPI. |
| Configured-secret scan | Passed: 9 configured secret values checked against the feature diff and 86 public static assets, no values printed. |
| B01 live regression | 12 passed, no failures/skips on the rebuilt server. First run exposed stale migration-count and pre-B04 Admin membership expectations; assertions now verify required migrations and approved seed membership. |
| B02 live regression | 8 passed, no failures/skips; both consent withdrawal/write orderings observed. |
| B03 live regression | 12 passed, no failures/skips; real draft/submission/evidence/Assessment history, stale writes, consent replay denial, atomic audit rollback and direct-client privacy passed. |

## Pending before B05 gate

- Finish B05 live suite and actual curl demonstration.
- Run B01–B04 production HTTP regressions sequentially.
- Final documentation checks, commit/push/PR.

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
