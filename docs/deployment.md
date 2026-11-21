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
exposed to the browser; they may only be the project URL and publishable key.

| Name | Scope |
| --- | --- |
| `SUPABASE_URL` | Server. Supabase API URL. |
| `SUPABASE_PUBLISHABLE_KEY` | Server. Publishable key. |
| `SUPABASE_SECRET_KEY` | Server only. Never prefix with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser. Same project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser. Publishable key only. |

The citizen prototype routes and `/login` render without these variables. Sign-in
and server session routes fail closed until the five names above are set.
`SUPABASE_SECRET_KEY` must not appear in client bundles.

### Not required on Vercel

| Name | Why it stays off the hosted app |
| --- | --- |
| `SUPABASE_STRING` | PostgreSQL URI for local migrate/seed/tests. |
| `SUPABASE_DB_CA_FILE` | Path to a local CA file. |
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
| `/` | Create Next App home (`page.tsx`) |
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
`VERCEL_ORG_ID`, or `VERCEL_PROJECT_ID`, and the Vercel CLI was not installed.
No production project was created or updated from this task.

Verified locally from `next start` on port 3100:

- `/` returned 200 in the browser.
- `/login` and all six `/citizen` routes returned 200.
- `/login` exposed the SANAD sign-in UI.
- The citizen routes exposed the expected Urdu headings.

There is no public deployment URL for this task. After merge, the repository
owner connects Vercel to `main` and re-checks the eight routes on the resulting
public URL.
