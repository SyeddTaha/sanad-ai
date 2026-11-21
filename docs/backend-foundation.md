# B01: database and authentication foundation

Owner: Developer 1 (backend/contracts/migrations). Scope ends at B01; case-level
RBAC, consent, assignment and workflow policies remain B02/B03/B04 work.
Frozen `src/contracts/v1` is unchanged. Baseline is main commit `570335c` (PR #2).

## Team integration

- Backend owns `/login`, `/api/v1/auth/login`, `/api/v1/auth/logout` and
  `/api/v1/session`. The existing home screen and frontend application screens
  are untouched. Frontend can replace the small login view while retaining the
  endpoint behavior below.
- Browser consumers import `login`, `session`, `logout` from
  `@/lib/auth/browser`. These use same-origin fetch and HttpOnly cookies, with
  no token returned to application JavaScript or browser storage.
- Server routes import `requirePrincipal` from `@/backend/auth/principal`.
  It returns `{ principal, departmentIds }` only after verified Auth and database
  lookup. `AuthFailure.code` maps through the frozen `ErrorHttpStatus` catalog.
  `auditedAuth` in `@/backend/auth/session` currently wraps the three B01 actions.
  Future handlers must emit their own minimal audit metadata and apply B02
  authorization before accessing any resource.
- The request-local public/privileged SDK pair is `authClients()` from
  `@/backend/auth/supabase` (server-only). Never pass either SDK client or its
  configuration to a Client Component. The optional public browser SDK factory
  is `browserSupabase()` from `@/lib/supabase/browser`; it persists no session.
  Its direct database reads/writes are deliberately denied. Use the HTTP auth
  helpers for SANAD sign-in, rather than a separate browser SDK login.
- Frontend and AI developers can integrate verified identity, five database-held
  roles, officer department IDs, login/logout and denial responses now. Roles
  and department membership alone do not authorize case/evidence/AI processing.
  Do not invent authorization context, accept a principal from a request, use
  a UI role selector as identity, or bypass the boundary with the database secret.
- On logout, expiry, or Citizen switching, clear private views, drafts/audio,
  cancel pending requests and ignore late responses. The B01 login page keeps
  only the current identity in memory. Full shared-phone workflow is deferred.

## Endpoint behavior

All application responses use frozen v1 success/error envelopes and
`Cache-Control: private, no-store`, `Vary: Cookie, Authorization`.

| Endpoint | Input | Success |
| --- | --- | --- |
| `POST /api/v1/auth/login` | Strict JSON `{email,password}`; same-origin `Origin` required; body max 4 KiB | 200 `{data:{principal,departmentIds},requestId}` and session cookie |
| `GET /api/v1/session` | Session cookie **or** `Authorization: Bearer <Supabase access token>` | 200 same identity shape |
| `POST /api/v1/auth/logout` | Same-origin `Origin`; current cookie or bearer token | 200 `{data:null,requestId}`; local provider session revoked and cookie expired |

Runtime composition: `SessionResponseSchema` / `SessionContextSchema` from
`@/lib/auth/session-contract`, composed from existing `ApiSuccessSchema`,
`PrincipalSchema` and `IdSchema`. This adds no frozen shared schema.
`principal` is `{id,kind:"HUMAN",roles,active:true}`. Departments are UUIDs.

Missing/invalid/expired/revoked authentication returns 401 `UNAUTHENTICATED`;
inactive or roleless profiles return 403 `FORBIDDEN`; conflicting credential
schemes return 400 `MALFORMED_REQUEST`. `X-API-Key` is unsupported in B01 and
returns `INVALID_API_KEY` (or conflicting-credential 400). Malformed JSON is
400; unknown credential fields are 422; non-JSON login is 415; oversized input
is 413. Provider/configuration/database/audit failures are sanitized 503;
provider throttling is 429 with `Retry-After`. No provider detail is returned.
Logout without a valid local session clears the cookie; a provider outage
returns failure, so the UI must not claim sign-out succeeded.

## Session and database security

Login is real Supabase email/password authentication. Every protected request
calls Auth `getUser(token)` and then the service-only `sanad_session_context`
RPC. The RPC binds the verified user ID to the JWT's `session_id` in
`auth.sessions`, checks `not_after`, and reads the current profile, roles and
department memberships. Mutable user metadata, query/body fields, and identity
headers never supply authorization. Missing profiles are inactive; new profiles
default inactive and have no role. No automatic public signup provisioning exists.

The host-only `sanad-session` cookie is HttpOnly, SameSite Strict, Path `/`,
Secure in production, with a maximum one-hour lifetime bounded by the issued
access-token lifetime. B01 stores no refresh token: sign in again at expiry.
Logout revokes the current Auth session, and the database session check blocks
replay even while its signed access token would otherwise remain unexpired.
Separate per-request SDK instances keep login from changing the privileged
client's identity. Provider fetches disable caching.

All eight application tables have RLS enabled and all PUBLIC/anon/authenticated
table privileges revoked. There are no permissive policies, including for an
account's own data. The service role has only the foundation select/insert
grants, audit insertion, and session lookup; it cannot query private case/consent
tables, update roles, or edit audit history. The server-only secret still has
Auth administrative power and must never be exposed. PostgreSQL administrative
connections are confined to scripts and opt-in integration tests. B02 must add
reviewed operations/policies rather than a generic query endpoint.

Audit rows contain request ID, opaque actor/target/authorization references,
action, outcome and server time, with no credentials, raw evidence or input.
B01 login/logout/session operations fail closed if audit insertion fails.
Supabase Auth and PostgreSQL cannot share an atomic transaction: an Auth session
may have been created/revoked before a later audit failure returns 503. No
successful application response is released without its audit insert. Seed Auth
creation has the same external-service boundary; retries recover marked orphan
demo users if the SQL transaction previously rolled back.

## Configuration and demo setup

Use Node with `--env-file-if-exists` support (verified with Node 26.13.1) and
`npm ci`. Copy `.env.example` to an ignored `.env.local` or
configure the same environment names in the deployment. Existing ignored `.env`
also works. Scripts load `.env` then `.env.local`; externally set variables take
precedence. Values are never committed.

| Variable | Source / purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project's API URL |
| `SUPABASE_PUBLISHABLE_KEY` | Project's public publishable key |
| `SUPABASE_SECRET_KEY` | Project secret key, server/scripts only |
| `SUPABASE_STRING` | Development database PostgreSQL URI, scripts/tests only; use session pooler if direct IPv6 is unavailable |
| `SUPABASE_DB_CA_FILE` | Local path to trusted Supabase root CA if the system store does not trust the chain |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Optional browser SDK config, same project; publishable key only, never secret/service-role |
| `DEMO_CITIZEN_A_PASSWORD`, `DEMO_CITIZEN_B_PASSWORD`, `DEMO_HELPER_PASSWORD`, `DEMO_OFFICER_PASSWORD`, `DEMO_ADMIN_PASSWORD`, `DEMO_AUDITOR_PASSWORD` | Distinct synthetic demo passwords, 16–128 characters; setup/tests only |
| `B01_BASE_URL` | Live suite's running Next.js origin, default `http://localhost:3100` |

The preexisting `SUPABASE_JWKS_URL` is not needed: this implementation validates
with Auth rather than maintaining a separate JWT-verification cache. Server
configuration rejects invalid URLs and a privileged key in the public-key slot.
Use HTTPS for the deployed application. Enable Supabase Email/password in the
dashboard. Public signups need no application access; unprovisioned users are
denied. The checked-in local config disables public signups. Hosted Auth settings
are not changed by this file.

For trusted PostgreSQL TLS, download the root certificate from Supabase Dashboard
→ Database settings → SSL configuration and set `SUPABASE_DB_CA_FILE` to its
local path. During this task, the public Supabase Root 2021 CA was retrieved from
`https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`
into ignored `.supabase-ca.crt`. Remote connections enforce certificate and
hostname verification; SSL parameters in the URI cannot disable that policy.
Localhost connections support the local Supabase database without TLS.

```sh
npm run db:migrate
npm run db:seed
```

Seeding uses Auth Admin and one PostgreSQL transaction, checks a server-held
`app_metadata.sanad_demo` marker, and refuses to adopt unrelated existing users.
It provisions these synthetic accounts, active profiles, roles, and one synthetic
officer department/membership:

| Email | Role | Password variable |
| --- | --- | --- |
| `citizen-a@demo.sanad.test` | CITIZEN | `DEMO_CITIZEN_A_PASSWORD` |
| `citizen-b@demo.sanad.test` | CITIZEN | `DEMO_CITIZEN_B_PASSWORD` |
| `helper@demo.sanad.test` | HELPER | `DEMO_HELPER_PASSWORD` |
| `officer@demo.sanad.test` | OFFICER | `DEMO_OFFICER_PASSWORD` |
| `admin@demo.sanad.test` | ADMIN | `DEMO_ADMIN_PASSWORD` |
| `auditor@demo.sanad.test` | AUDITOR | `DEMO_AUDITOR_PASSWORD` |

Generate passwords with a password manager or cryptographically secure generator,
store/share them via the team's secure credential channel, and enter them at
`/login`. This workspace has generated passwords in ignored `.env`; values were
not printed. Repeat seed runs do not duplicate profiles, users, roles, departments
or memberships. Each run appends a setup audit event. Existing passwords and
inactive profiles are not reset. To rotate a demo password, deliberately update
the same Auth user through Supabase Admin/dashboard and its secure local variable.

## Migrations

Run `npm run db:migrate` against the designated development database. It applies
ordered SQL files in one transaction under an advisory lock, records SHA-256
checksums (with normalized line endings) in the inaccessible `sanad_private.migrations` ledger and rejects edits
to already-applied files. Add a new migration for changes. Do not also apply these
files through a second migration runner: local CLI automatic migrations/seeding
are disabled to avoid competing ledgers. The optional local CLI/Docker stack has
not been exercised in this task; hosted PostgreSQL is the verified target.

| Migration | Objects |
| --- | --- |
| `20261121000100_backend_foundation.sql` | `profiles`, `role_assignments`, `departments`, `department_memberships`, `case_reservations`, `cases`, `consent_grants`, `audit_events`; role/action enums, constraints, indexes, version/timestamp triggers, restrictive privileges/RLS and service-only principal lookup |
| `20261121000200_session_expiry.sql` | Enforces Auth session `not_after` on principal lookup |

Case and consent ownership use composite foreign keys to the same reserved
`(id,citizen_id)` pair. Related Cases must belong to that citizen. Consent can
reference a reservation before submission. Recipient profiles/departments have
foreign keys; AI processor identifiers have no registry in B01. Consent action
sets reject emptiness, duplicates and nulls. Purpose syntax is stored only;
operational allowlisting and authority remain B02. Cases have explicit status,
priority and independent row/evidence revisions. Row updates bump row version
and update time; no workflow or evidence-version transition engine is introduced.
No future evidence, assessment, rule, payment, or AI tables are added.

## Verification

```sh
npm run test:contracts
npm run test:backend
npm run typecheck
npm run lint
npm run build
npm run start -- --port 3100
# In another terminal, with real development credentials and demo passwords:
npm run test:backend:live
```

`test:backend` uses real embedded PostgreSQL (PGlite) for SQL migrations,
constraints, privileges, expiry and seed persistence; Auth and HTTP-provider
responses are mocked at the external fetch boundary. These are not hosted
Supabase integration results. The opt-in live suite uses real hosted Auth,
PostgreSQL, direct PostgREST requests and the production Next.js HTTP server.
It provisions/reuses the synthetic users, temporarily changes only a demo
profile's activity and a demo session's expiry (restored in `finally`), tests
private rows in a rolled-back transaction, and revokes its test login sessions.
Run it on the development project, never against unrelated real users.

Final check counts, review findings and exact file inventory are recorded in
[B01 verification evidence](./b01-verification.md).

## Remaining boundaries

The official source PDF and handoff file referenced by AGENTS.md are absent;
the canonical spec, frozen contracts and six accepted ADRs supplied the available
authority. No source-PDF fidelity claim is made. Browser/device UX, Urdu audio,
Vercel deployment, OAuth, password-reset UI, refresh-token rotation, case-level
policy enforcement and AI behavior are not demonstrated by B01. B02 can build on
verified identity and persistence, but must implement the operational consent
purpose allowlist and scoped authorization before exposing case/evidence access.

Official references used for implementation:
[Auth getUser](https://supabase.com/docs/reference/javascript/auth-getuser),
[Auth sessions](https://supabase.com/docs/guides/auth/sessions),
[local sign-out](https://supabase.com/docs/reference/javascript/auth-signout),
[PostgreSQL TLS](https://supabase.com/docs/guides/platform/ssl-enforcement).
The installed Next.js 16.4.6 authentication, route-handler, cookie and environment
guides were read before implementation.
