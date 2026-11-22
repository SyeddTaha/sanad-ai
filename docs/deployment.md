# Deployment and CI

D01 owns GitHub Actions verification and the Vercel production path. Production
deploys come from integrated `main` after merge. This document does not record a
public URL, and it does not contain secret values.

## Continuous integration

Workflow: `.github/workflows/ci.yml`.

It runs on pull requests targeting `main` and on pushes to `main`:

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test:contracts`
5. `npm run test:backend` (embedded PGlite; no Supabase network)
6. `npm run build`, which is `next build --webpack`

Live suites stay out of CI: `test:backend:live`, `test:b02:live`, `test:b03:live`,
and `test:ai-trust`. They need a running app and external services.

Node.js on the runner is 22. Next.js 16.4.6 requires Node.js 20.9 or newer.
Local verification for this task used Node.js 24.11.1.

Next.js 16 uses Turbopack for `next build` unless `--webpack` is set
([upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16),
[CLI reference](https://nextjs.org/docs/app/api-reference/cli/next)).
The production script opts into Webpack so GitHub Actions and Vercel compile
the same bundle. `next dev` stays on the default Turbopack dev server.

## Vercel

Connect the GitHub repository `SyeddTaha/sanad-ai` in the Vercel project
settings. Set the production branch to `main`. Leave preview deployments on
other branches if the project owner wants them; they are not production.

| Setting | Value |
| --- | --- |
| Framework | Next.js |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output | Next.js default (no `output: "export"`) |

`vercel.json` records the install and build commands. Vercel reads environment
variables from the project settings, not from git. Do not put values in this
repository. Names below match `.env.example` and
[the backend foundation guide](backend-foundation.md).

### Runtime names for the hosted app

Set these in Vercel for Production (and Preview, if sign-in should work there).
Mark every secret and database value as sensitive. `NEXT_PUBLIC_*` values are
exposed to the browser; use only the project URL, publishable key and public
staff-mode flag below.

| Name | Scope |
| --- | --- |
| `SUPABASE_URL` | Server. Supabase API URL. |
| `SUPABASE_PUBLISHABLE_KEY` | Server. Publishable key. |
| `SUPABASE_SECRET_KEY` | Server only. Never prefix with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser. Same project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser. Publishable key only. |
| `SUPABASE_STRING` | Server only. PostgreSQL URI used by B02–B05 authorization transactions, Cases, rules, audit reads and API keys. Configure a host-reachable endpoint. |
| `SUPABASE_DB_CA_FILE` | Server only, if required by the database certificate chain. A path readable in the deployed filesystem to the trusted CA certificate; a workstation path will not work on Vercel. |
| `SUPABASE_DB_CA_PEM` | Server only. Trusted CA PEM contents for hosted SQL; takes precedence over `SUPABASE_DB_CA_FILE`. Store as a Vercel secret, without disabling certificate verification. |

The citizen prototype routes and `/login` render without these variables. Sign-in
and server session routes fail closed until their Supabase configuration is set.
`SUPABASE_SECRET_KEY` must not appear in client bundles.

B01 login/session uses the Supabase SDK and RPC; successful login does **not**
prove the B02–B05 PostgreSQL connection works. Those routes call
`scripts/database.ts` at runtime and require `SUPABASE_STRING`. Remote SQL uses
certificate and hostname verification; configure a trusted CA file if the host
does not trust the chain. Never disable TLS verification. After configuring the
host, verify an authenticated Officer queue and Admin dispatch request, plus
API-key rejection and a full synthetic Case workflow. Apply migrations through
the trusted development/setup connection before serving the application.

### Not required on Vercel

| Name | Why it stays off the hosted app |
| --- | --- |
| `DEMO_CITIZEN_A_PASSWORD` | Synthetic password for setup and live tests. |
| `DEMO_CITIZEN_B_PASSWORD` | Synthetic password for setup and live tests. |
| `DEMO_HELPER_PASSWORD` | Synthetic password for setup and live tests. |
| `DEMO_OFFICER_PASSWORD` | Synthetic password for setup and live tests. |
| `DEMO_ADMIN_PASSWORD` | Synthetic password for setup and live tests. |
| `DEMO_AUDITOR_PASSWORD` | Synthetic password for setup and live tests. |
| `B01_BASE_URL` | Live-test origin. Default `http://localhost:3100`. |
| `B03_BASE_URL` | Live-test origin. Default `http://localhost:3300`. |

Demo passwords are created with `npm run db:seed` against the database, not by
copying them into `NEXT_PUBLIC_` variables.

## Routes checked for a production smoke

| Path | Expected heading |
| --- | --- |
| `/` | Redirects to the SANAD citizen entry at `/citizen` (final-integration change; requires deployment). |
| `/login` | SANAD sign in |
| `/citizen` | کیا یہ امدادی پیغام واقعی درست ہے؟ |
| `/citizen/verify` | نوٹس یا پیغام یہاں چسپاں کریں |
| `/citizen/results` | شواہد کی الگ الگ کیفیت |
| `/citizen/dispute` | اپنا اختلاف بتائیں |
| `/citizen/case` | کیس کی پیش رفت |
| `/citizen/consent` | آپ کی معلومات کس کے ساتھ ہیں؟ |

Citizen screens default to Urdu. A smoke check confirms those headings in a
browser against `next start` or the public production URL. A successful
`vercel deploy` command is not that check.

## Current deployment gate

As of 21 November 2026, this environment had no `VERCEL_TOKEN`,
`VERCEL_ORG_ID`, or `VERCEL_PROJECT_ID`. The Vercel CLI was not previously
installed; a temporary CLI invocation confirmed that no Vercel account session
is available (`Logged out`). No `.vercel` project link exists in this checkout.
No production project was created or updated, and no temporary deployment was
created.

PR [#12](https://github.com/SyeddTaha/sanad-ai/pull/12) triggered GitHub Actions
run [44915723917](https://github.com/SyeddTaha/sanad-ai/actions/runs/44915723917).
The run completed successfully on 21 November 2026, with every CI step passing:
install, lint, typecheck, contract tests, offline backend tests, and the
Webpack production build.

Verified locally from `next start` on port 3100:

- `/` returned 200 in the browser.
- `/login` and all six `/citizen` routes returned 200.
- `/login` exposed the SANAD sign-in UI.
- The citizen routes exposed the expected Urdu headings.

There is no public deployment URL for this task. Production deployment requires
an authorized repository owner or project member to connect Vercel to the
`SyeddTaha/sanad-ai` repository and sign into the approved Vercel account.
For automated deployment or CLI deployment, the authorized account must provide
a Vercel account token plus the approved organization and project identifiers:
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`. Secrets must be
configured in the deployment host or CI environment; they must not be placed in
this document or committed to the repository.
