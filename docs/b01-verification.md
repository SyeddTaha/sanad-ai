# B01 verification evidence — 21 November 2026

Branch: `feat/backend-foundation`. Baseline: `570335cff918cea165da012890b8ddc6d282afb7`
(main's merged shared contracts v1.0.0, PR #2). Preflight found this branch already
at that baseline with incomplete B01 files. Those files were completed in place;
no unrelated branch or application screen was changed. `git fetch origin` confirmed
main and origin/main at the same commit. No frozen contract source was modified.

## Executed verification

| Check | Actual evidence |
| --- | --- |
| TDD: login | Existing public login test failed because the password handler module was missing; implemented login/logout, then it passed. |
| TDD: seed | New seed test failed because the setup module was missing; implemented the setup boundary, then it passed with embedded PostgreSQL and mocked external Auth. |
| TDD: session expiry | Embedded PostgreSQL test returned a principal for a past-`not_after` session (red). Added migration 002; the same test then returned null (green). |
| `npm run test:contracts` | 25 passed, 0 failed, 0 skipped. |
| `npm run test:backend` | 20 passed, 0 failed, 0 skipped. Embedded PostgreSQL is real; external Auth responses are mocked. |
| `npm run typecheck` | Exit 0. |
| `npm run lint` | Exit 0. |
| `npm run build` | Exit 0; `/login` generated and all three auth/session routes dynamic. Existing ignored parent-directory lockfile warning remains. |
| Supabase Auth health | HTTP 200 against the configured real project. |
| PostgreSQL connectivity | Actual authenticated PostgreSQL connection with certificate/hostname validation using Supabase's public CA. The first attempt failed CA trust; no TLS bypass was used. |
| Migration application | Both `20261121000100_backend_foundation.sql` and `20261121000200_session_expiry.sql` applied to the configured development database. Repeated application skipped unchanged migrations. |
| Demo provisioning | Six distinct synthetic Auth users, active profiles, all five roles, one officer department/membership. Repeat setup reused the users without duplicates. Passwords generated into ignored `.env`, never printed or committed. |
| Live HTTP | Final post-review production-server run: 12 passed, 0 failed, 0 skipped (parent suite and eleven subtests), including real server-side session expiry and session cleanup. |
| Ignored secrets | `.env`, `.env.local` and `.supabase-ca.crt` ignored; `.env.example` contains names with blank values only. |
| Secret scans | Staged implementation diff and all 24 generated browser assets contained none of the configured secret-key, database-URI or demo-password values. |
| Login interface smoke check | Real `/login` HTTP 200 with email/password form and session controls present; this is not a browser-interaction test. |
| Final repository checks | `git diff --check` passed; all local handoff links resolved; the inventory below matched all 33 changed files; frozen contract diff empty. |

Post-review gate: contract suite 25/25, backend suite 20/20, live suite 12/12,
typecheck, lint and production build all passed. Both hosted migrations remain
current on repeat execution. The build was restarted as a production server
before the final live run. No integration test was skipped or substituted with
a provider mock in that live suite.

The live suite calls real Supabase Auth, PostgreSQL, Supabase PostgREST and a
running production Next.js server at localhost:3100. It checks all synthetic role
logins and principal/department resolution, anonymous and malformed/expired-token
denial, database session expiry, inactive-profile denial, hostile role/identity
headers, role-write denial, another citizen's existing private Case, CSRF
protection and logout-token replay. Setup idempotence and migration history are
checked against the real services. SQL permission probes use rolled-back private
test rows; activity and expiry probes restore their original demo values.

These results do not claim browser/device testing, a freshly signed expired JWT
(the invalid-token probe mutates expiry without resigning), local CLI/Docker
testing, Vercel deployment or B02 consent enforcement. Real session expiry is
independently exercised using `auth.sessions.not_after` with a valid access token.

## Focused review

Review target: the complete B01 diff from baseline `570335c` to implementation
commit `c67bf71`. Two separate reviewers inspected this diff using the installed
code-review skill. Neither accessed credentials or mutated the live database.

## Standards

No confirmed P0/P1 security defects or documented-standard violations. Reviewed
principal verification, database-held roles, session ownership/expiry/revocation,
CSRF, no-store responses, secrets, SQL privileges/RLS, audit sanitization and seed
ownership markers. No significant baseline smells. This reviewer performed a
source review, not a separate test run.

## Spec

No blocking missing B01 requirements, unwanted scope, or reproducible P0/P1
defects. Frozen contracts are unchanged. The reviewer independently ran the
backend suite (20 passed) and contract suite (25 passed), inspecting rather than
rerunning hosted integration evidence. Browser/device/deployment and B02 work
remain accurately identified as deferred.

Review totals: Standards 0 remaining; Spec 0 remaining. No P0/P1 remains in the
reviewed B01 behavior. Subsequent changes only finalize this evidence record.

## Exact changed files

- `.env.example`
- `.gitignore`
- `README.md`
- `package.json`
- `package-lock.json`
- `docs/backend-foundation.md`
- `docs/b01-verification.md`
- `scripts/database.ts`
- `scripts/demo-accounts.ts`
- `scripts/migrate.ts`
- `scripts/migrations.ts`
- `scripts/seed-demo.ts`
- `src/app/api/v1/auth/login/route.ts`
- `src/app/api/v1/auth/logout/route.ts`
- `src/app/api/v1/session/route.ts`
- `src/app/login/page.tsx`
- `src/backend/auth/environment.ts`
- `src/backend/auth/password.ts`
- `src/backend/auth/principal.ts`
- `src/backend/auth/session.ts`
- `src/backend/auth/supabase.ts`
- `src/lib/auth/browser.ts`
- `src/lib/auth/session-contract.ts`
- `src/lib/supabase/browser.ts`
- `supabase/.gitignore`
- `supabase/config.toml`
- `supabase/migrations/20261121000100_backend_foundation.sql`
- `supabase/migrations/20261121000200_session_expiry.sql`
- `tests/backend/database.test.ts`
- `tests/backend/login.test.ts`
- `tests/backend/seed.test.ts`
- `tests/backend/session.test.ts`
- `tests/integration/b01.live.test.ts`

## Limitations and B02 readiness

B01 establishes real persistence and verified principal resolution. It does not
authorize delegated Case access, AI processing, assignment or any workflow.
Direct browser database access remains denied for every role. B02 can now build
on the principal boundary, reservations, Cases, grants and restrictive database
defaults. Add reviewed policies/operations; never open permissive RLS to integrate.

No credentials or service blockers remain in this workspace. Teammates must set
their own ignored environment values and deploy-time secrets; passwords are
available only in the configured local credential file. For B02 the owner confirmed
[the Markdown challenge brief](brief/AI_Hackathon_Problem_Statement.md) as official
requirements and [the master handoff](brief/SANAD_Hackathon_Master_Handoff.md) as context.
Authentication audit writes fail closed but cannot share a transaction with
external Supabase Auth effects. Session refresh and browser/device/deployment
verification remain outside the demonstrated B01 behavior.
