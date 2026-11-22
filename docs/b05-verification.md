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
| Focused API-key tests | 9 passed, no failures/skips; includes role/scope/owner/withdrawal/replay/revocation/expiry/input/audit rollback behavior. |
| OpenAPI tests | Document validation, exact route coverage and synthetic request schema examples passed. |
| Contract tests | 25 passed, no failures/skips. Frozen v1 exports unchanged. |
| First full backend run | 77 passed, 1 failed: seed test expected migration list lacked B05 migration. Updated expected list; focused seed/OpenAPI rerun: 3 passed. Final full run pending. |
| Development migration | `20261122001100_scoped_api_keys.sql` applied; repeat reports none, already current. Demo seed succeeded. |
| Production build | Passed after removing unsupported route config exports under Cache Components. Public OpenAPI is static; key operations dynamic. |
| Typecheck / lint | Passed before final test additions; fresh final checks pending. |
| Initial B05 production HTTP | Real Auth/OpenAPI, one-time issuance/hash storage, scoped read/write/submission, missing scope, cross-Citizen denial and consent-withdrawal/replay subtests passed. Full run pending. |

## Pending before B05 gate

- Finish B05 live suite and actual curl demonstration.
- Run B01–B04 production HTTP regressions sequentially.
- Final full backend suite, lint and typecheck.
- Standards and Spec/security reviews, secret scan, commit/push/PR.

## Known dependency and deployment limitations

Developer 2 identity/payment/general program mock adapters are absent from the
merged baseline. No mock REST endpoint is fabricated or documented as live.
The four required lookup outcomes remain a dependency requirement. Separate
crypto/AI adapters exist but are not wired into B03/B04 Assessments by this task.
Public-host deployment/browser/audio acceptance remain outside B05 verification.

See [B05 handoff](b05-public-api.md) for endpoints, scope ceilings, locking,
one-time-secret semantics, repeatable `npm run demo:b05` and example curls.
