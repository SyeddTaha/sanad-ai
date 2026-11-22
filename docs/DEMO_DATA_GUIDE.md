# SANAD Demo Data Guide

Use synthetic data in a local or explicitly designated development environment. SANAD's official challenge forbids real personal data, and this guide does not authorize production writes. **Do not run migration, seed, live integration, or demo scripts unless you have independently confirmed that their environment points to a disposable/development Supabase project and PostgreSQL database.** The scripts accept environment connection settings and do not all contain production-host guards.

## Prerequisites

- Node.js 22 or newer and dependencies installed with `npm ci`.
- Development-only Supabase Auth URL, publishable key and server secret configured in ignored `.env`/`.env.local`.
- Development-only PostgreSQL URI in `SUPABASE_STRING`; if remote TLS needs a CA, use `SUPABASE_DB_CA_FILE` or `SUPABASE_DB_CA_PEM`. TLS verification is enabled. Do not turn it off.
- Six private synthetic passwords supplied as `DEMO_CITIZEN_A_PASSWORD`, `DEMO_CITIZEN_B_PASSWORD`, `DEMO_HELPER_PASSWORD`, `DEMO_OFFICER_PASSWORD`, `DEMO_ADMIN_PASSWORD`, `DEMO_AUDITOR_PASSWORD`. Each must be 16–128 characters. Do not print, commit, share, or place them in `NEXT_PUBLIC_*` variables.
- A local app server for API demos; `B05_BASE_URL` can select it. Keep that value on `http://localhost:<port>` or an explicitly isolated development host.

`SUPABASE_SECRET_KEY`, `SUPABASE_STRING`, CA data, and demo passwords are secrets. Only the public Supabase URL/publishable key may be browser-visible. See [deployment configuration](deployment.md) and [`.env.example`](../.env.example) for variable names only.

## Supported setup commands

### Apply migrations

```powershell
npm run db:migrate
```

This applies the ordered SQL files under [`supabase/migrations/`](../supabase/migrations/) through `scripts/migrate.ts`. It changes the configured database. Run only against development. It does not seed demo accounts, publish a rule, or create notice fixtures.

### Create/reuse synthetic accounts

```powershell
npm run db:seed
```

[`scripts/seed-demo.ts`](../scripts/seed-demo.ts) provisions two synthetic Citizens and one each Helper, Officer, Admin and Auditor. It requires the six private passwords, marks new Auth users as demo accounts, creates active profiles/roles, creates one synthetic department, and assigns Admin/Officer department membership. Repeat use is additive/idempotent for account/profile/role/membership identity; it refuses to adopt a matching email not marked `sanad_demo`. Existing passwords are not reset. It does not create Cases, publish a rule, populate program inputs, or register issuer keys.

Expected output is synthetic account labels, email IDs and role names, with passwords omitted. The account emails are in [`scripts/demo-accounts.ts`](../scripts/demo-accounts.ts); no password is supplied in this guide.

### Generate signed-notice scenarios locally

```powershell
node --conditions=react-server --import tsx scripts/synthetic-notice-demo.ts
```

This creates an ephemeral synthetic Ed25519 keypair and in-memory registry and emits seven JSON scenario results: valid, tampered signature, expired, revoked, unknown issuer, unknown key, and registry unavailable. It does not write to the database or use real issuer credentials. It intentionally refuses to run with `NODE_ENV=production`. The key changes each execution; do not interpret the sample as production trust or payment evidence.

### Scoped public API demo

With an isolated local production/development app running and synthetic accounts already provisioned:

```powershell
npm run demo:b05
```

[`scripts/demo-public-api.ts`](../scripts/demo-public-api.ts) defaults to `http://localhost:3500` or uses `B05_BASE_URL`. It logs in a synthetic Citizen and Helper, creates a Case draft and synthetic dispute text, grants the Helper a named read grant, submits the Case, issues a short-lived scoped key, then performs a case read, insufficient-scope read, revocation, and post-revocation denial. Expected sequence is HTTP `201 → 200 → 403 INSUFFICIENT_SCOPE → 200 → 401 INVALID_API_KEY`. The script hides the secret, attempts to revoke its generated key, and logs out; it does not delete the synthetic Case or immutable history. A failed run may leave partial synthetic records, so inspect development data before retrying.

Do not point `B05_BASE_URL` at a public/prod hostname. This command is not a production smoke or a complete Citizen browser demonstration.

## Safe example input values

Use obviously fictitious text and values, for example:

- Message: `Synthetic Relief Demo notice: payment reference DEMO-PAY-77821; please contact the mock department.`
- Dispute statement: `Synthetic test only: this example payment reference is not visible in the demo ledger.`
- Issuer identifier: `demo_issuer_01`; notice identifier: `demo_notice_01`.
- Currency and amounts: use the strict v1 shape with integer minor units; e.g., PKR 25000 rupees is represented as `2500000` minor units.
- No CNIC, phone, bank account, real address, real payment reference, uploaded real document, real person's name, or production notice.

The sample input is not itself signed. The CLI scenario runner creates and signs its own internally generated fixture. Notice input from a Citizen cannot add a trusted key or issuer record.

## Cases and rule setup boundaries

Cases and consent can be created through authenticated API workflow. There is no general Case seeding script. `db:seed` creates accounts only; `demo:b05` creates one synthetic Case but does not clear it. There is no supported delete/reset command for append-only evidence, Assessments, Case events, decisions, audit events, trusted registry data, API-key history, or rules.

Published rules are created by the Admin rule publication UI or `POST /api/v1/rules/publish` after login, with `programRef: "program_demo"`, an expected current version, and validated synthetic parameters. Example starting values in the source are `maxMonthlyIncomeMinor: 800000`, `minRoutingConfidence: 0.8`, and `integrityFailurePriority: "HIGH"`. These are demo assumptions, not government criteria. `db:seed` does not publish them; if no rule is current, Assessment eligibility is unknown and Officer resolution cannot complete.

`synthetic_program_inputs` can only be appended through trusted setup/database access in current source; no user-facing write route or supported fixture provisioning command exists. `trusted_registry_records` is also server-owned, append-only setup data; no seed/demo script currently populates the persistent registry. Do not invent rows or key relationships for production. Use the isolated seven-case in-memory notice demo to show cryptographic branches, and label it as isolated component demonstration.

## Reuse and reset

- Re-run `npm run db:seed` to reuse/add the same marked synthetic accounts and memberships; it will not reset existing passwords or clear history.
- Re-run the synthetic notice CLI any time; its keys and in-memory registry disappear at process exit.
- The B05 script creates fresh synthetic Case/history and a temporary key per run. Its key cleanup is best effort in `finally`; confirm the credential metadata is revoked after any interrupted run.
- There is no supported database wipe/reset script. Do not manually delete immutable history to “reset” a demo. Use a fresh, isolated development database when a clean slate is needed.
- Never execute live B01–B05 integration suites against a public host. They mutate shared development roles, memberships, policy/consents and use temporary test barriers. The final release audit warns to run the suites sequentially and coordinate development data use.

## NOT VERIFIED

- Current public deployment health and end-to-end Citizen browser workflow.
- A public-data import or government-system fixture process.
- Persistent issuer/key/revocation registry setup automation.
- General identity/payment mock service setup; those adapters are absent.
- Any safe automated production reset procedure; none is provided.

See [`SANAD_COMPLETE_GUIDE.md`](SANAD_COMPLETE_GUIDE.md), [`scripts/`](../scripts/), [`docs/deployment.md`](deployment.md), and [`docs/final-release-audit.md`](final-release-audit.md).
