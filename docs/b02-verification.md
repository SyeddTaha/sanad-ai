# B02 verification evidence — 21 November 2026

Baseline: `4b3cd42` (B01 merged into main). Branch: `feat/rbac-consent`.
The task is bounded to B02; B03 has not started.

## Executed checks

| Check | Evidence |
| --- | --- |
| TDD public authorization | Owner test failed on missing boundary, then passed; helper, officer and independent AI consent slices each failed on missing permission before implementation, then passed. |
| TDD HTTP/database | Reservation failed on missing HTTP boundary, then passed; scoped grant operation failed before service implementation, then passed. Department restoration returned PENDING_CONSENT in red, SUBMITTED after implementation. |
| Embedded PostgreSQL | Consent workflow, failed audit rollback, lazy expiry, client privileges, hostile request input, CSRF and database role/activity reload exercised through public seams. |
| `npm run test:contracts` | 25 passed, 0 failed, 0 skipped; frozen exports unchanged. |
| `npm run test:backend` | Final suite: 35 passed, 0 failed, 0 skipped. Includes 5 policy tests, 10 B02 HTTP/database tests and all 20 existing backend tests. |
| `npm run typecheck` | Exit 0 after review fixes. |
| `npm run lint` | Exit 0 after review fixes. |
| `npm run build` | Exit 0; all B02 routes dynamic. Initial runtime-export compatibility failure corrected according to installed Next.js Cache Components guide. Existing parent lockfile warning remains. |
| Development migration | `20261121000300_rbac_consent.sql` applied to actual hosted PostgreSQL with verified TLS. Repeat migration: none, already current. |
| B01 live regression | 12 passed, 0 failed, 0 skipped against production localhost:3200 and actual Supabase Auth/PostgreSQL/PostgREST. |
| B02 live | Final run: 8 passed, 0 failed, 0 skipped, including seven subtests and their parent suite. All four consent HTTP operations, real authorization-service calls, both concurrent lock orderings and rollback exercised against actual Supabase and the rebuilt production server. |
| Secrets | Configured secret values absent from the complete implementation diff and all 24 browser assets. No credential values were printed or committed. |
| Repository checks | `git diff 4b3cd42 --check` passes; frozen `src/contracts/v1` diff empty; all 24 checked local documentation links resolve. |

The embedded suite uses real PGlite/PostgreSQL; only external Auth transport is
mocked. Live tests use actual Supabase Auth/PostgreSQL and production Next.js.
The four consent HTTP operations are real application routes. Private evidence
storage/HTTP endpoints do not exist in B02: READ_EVIDENCE tests exercise the real
exported authorization service over synthetic Case rows, not a fabricated
evidence endpoint. No evidence endpoint verification is claimed.

## Focused review

The implement skill required independent Standards and Spec review agents.
Both inspected `git diff 4b3cd42...HEAD` at initial implementation `50dcbda` and
rechecked the review fixes committed in `2509edc`. Reviews were read-only;
reviewers did not access credentials, mutate the database or run live tests.

### Standards

One P1 found and fixed: client body streaming previously occurred under global
authorization locks. Authenticated preparation now bounds and validates the body
before database connection/BEGIN/locks. The public regression failed with 503
before the fix and passed with 201 after completing the body. A deterministic
deadline test then exposed unfinished valid JSON being accepted at timeout (red
201 instead of 400); rejecting the deadline before cancelling the reader fixed it
(green 400). Reviewer recheck: no outstanding P0/P1 findings.

### Spec

No P0/P1 found. Two P2 findings fixed: completed consent-operation replays now
emit `CONSENT_RETRY`, and tests now retrieve a completed protected result under
authorization then deny that same retrieval after withdrawal. Reviewer recheck
confirmed both fixes, no new P0/P1. No B03/B04/B05 scope creep or frozen-export
changes found. The final live gate subsequently passed 8/8.

## Revocation and transaction evidence

The final live run verified owner isolation, helper scope, no helper resolution,
Admin/Auditor private-access restrictions, unassigned officer denial, officer
consent requirements, helper/department grant independence, withdrawal/restoration
status changes, grant listing/history and protected-result retrieval denial after
withdrawal. The live protected callback reads actual synthetic Case rows; it
does not implement an evidence endpoint. Creation/submission of full Cases remains B03.

Both concurrency orderings use observed PostgreSQL blocking PIDs, not guessed
sleeps. A write holding the reservation lock commits before the waiting HTTP
withdrawal; subsequent writes deny. When revocation holds the reservation first,
the writer waits, then reloads the committed revoked grant and returns
`CONSENT_REQUIRED`, without running its protected write. The live failed-write
probe rolls back a synthetic priority change and its ALLOWED audit. Embedded
PostgreSQL additionally injects failure at consent-restoration audit persistence
and verifies that no grant or Case-status change survives.

Earlier live runs failed the revocation-first test: initially a bounded lock
timeout produced safe `SERVICE_UNAVAILABLE` denial, and a later run could not
observe its barrier. A direct hosted PostgreSQL diagnostic reproduced cached
statistics: the transaction saw zero rows for a newly connected backend, then one
after `pg_stat_clear_snapshot()`. The test now uses a separate autocommit observer
and drains its writer promise even on barrier failure. The final complete suite
passes with no asynchronous errors. No authorization bypass was observed.

## Exact changed files

The diff from the merged B01 baseline contains 22 files:

- `.scratch/sanad-verification/spec.md`
- `AGENTS.md`
- `README.md`
- `docs/b01-verification.md`
- `docs/b02-rbac-consent.md`
- `docs/b02-verification.md`
- `docs/backend-foundation.md`
- `package.json`
- `src/app/api/v1/case-drafts/route.ts`
- `src/app/api/v1/cases/[caseId]/consents/route.ts`
- `src/app/api/v1/consents/[grantId]/revoke/route.ts`
- `src/backend/authorization/policy.ts`
- `src/backend/authorization/service.ts`
- `src/backend/authorization/transaction.ts`
- `src/backend/consent/http.ts`
- `src/lib/consent-contract.ts`
- `supabase/migrations/20261121000300_rbac_consent.sql`
- `tests/backend/authorization.test.ts`
- `tests/backend/consent.test.ts`
- `tests/backend/seed.test.ts`
- `tests/integration/b01.live.test.ts`
- `tests/integration/b02.live.test.ts`

## Limitations

B02 has no hosted deployment verification, browser/audio tests, evidence storage,
full draft submission, full staff workflow, AI provider processing or API-key
authentication. Existing public deployment is not asserted to contain this branch.
The AI processor identifier only reserves a consent target for the configured
future adapter. Previously delivered information cannot be recalled.

See [the integration handoff](b02-rbac-consent.md) for endpoint DTOs, purposes,
permission matrix, lock order and B03 requirements. B02's backend verification
gate is complete: no known P0/P1 remains, the development migration is current,
all required local checks and representative real-service integration tests pass.
B03 can use the owner-bound reservation and transaction boundary now. Public
deployment and end-to-end draft/evidence workflows retain their separate gates.
