# SANAD release recovery handoff

Prepared 22 November 2026, approximately 12:15 PKT. Deadline: **18:00 PKT today**. Release gate: **FAIL**. This session adds documentation only; recovery implementation, merging and production changes have not started.

## Resume location and Git state

- Recovery checkout: `../sanad-ai-final-integration`, branch `feat/final-integration`, clean at pushed audit tip `d32183c3b20f913473bfcaca1b7c3f56522fae7b` before this documentation-only commit. Resolve the handoff commit with `git log -1 --oneline`.
- Default checkout `sanad-ai`: `feat/public-api` at `f87acfe`, dirty **only** at `tests/integration/b04.live.test.ts`. Preserve this teammate edit; stay in the recovery worktree.
- Detached `../sanad-ai-release-build` at `0f24cba` is for build evidence. Audit servers 3600/3700 were stopped.
- Fresh `origin/main`: `65b777d`, two commits beyond audit baseline `06bd0c5`; PR #19 adds only the A06 documentation file. It has not been merged into this branch.

## Completed audit and evidence

Read [the checklist](final-release-audit.md), [test/curl evidence](verification/final-release-test-evidence.txt), and [public observations](verification/final-release-public.jsonl). Results below are from the audit, not rerun for this handoff.

- **PASS:** 190 offline tests; real development Auth/PostgreSQL live suites **12 / 8 / 12 / 14 / 9**, zero final failures/skips; typecheck/lint/build, 16 local HTTP probes, current migrations, curl **201 → 200 → 403 → 200 → 401**. Coverage includes rule/concurrency, consent/replay, immutable Passport history and atomic rollback.
- Fixed: root redirect, low-confidence human handoff (validated policy threshold; default 0.8), B01's stale single-membership assertion, and SQL/TLS deployment instructions. Eight configured private values were absent from inspected artifacts.
- [CI passed on `d32183c`](https://github.com/SyeddTaha/sanad-ai/actions/runs/44996245796). Three audit live-AI evaluations **skipped** for missing credentials; no real AI success is claimed.
- Hosted at 11:57 PKT: <https://sanad-ai-eta.vercel.app/> had **12 PASS / 4 FAIL**: starter root and three SQL-backed 503s. Citizen actions sent no API requests; staff showed fixtures. The superseded `sanad-ai-nine` URL returned `DEPLOYMENT_NOT_FOUND`.

## P0 status and release blockers

**No confirmed P0 was recorded by the audit.** Remaining defects were classified P1; hosted SQL is first priority. Production has not been reverified this turn. Suspects below remain unproven.

| Blocker | Confirmed finding / suspected cause | Relevant files and services |
| --- | --- | --- |
| Hosted SQL unavailable | Auth/RPC works; queues/keys 503. Suspect URI, connectivity, CA packaging, schema/migrations; host logs unavailable. | Vercel/Supabase; `scripts/database.ts`, `src/backend/authorization/transaction.ts`, `src/backend/api-keys/auth.ts`; [setup](deployment.md). |
| Frontend integration | Citizen controls disconnected; staff fixtures; live assignment needs a directory. | `src/components/citizen/`, `src/app/(citizen)/`, `src/lib/staff-api.ts`, `src/app/staff/`; [B02](b02-rbac-consent.md), [B03](b03-cases-evidence.md), [B04](b04-officer-rules.md), PR #16. |
| Assessment orchestration/trace | `createAssessment` never calls adapters; registry/persistence orchestration absent. Setting a provider key alone cannot fix it. | `src/backend/cases/{http,assessments}.ts`, `src/backend/adapters/assessment-adapters.ts`, `src/backend/ai/assessment.ts`, `src/backend/notices/`, `src/contracts/v1/ai-metadata.ts`; [A04](ai-integration-adapters.md). |
| Three mock APIs | Identity/payment/general program lookups absent; case-scoped program inputs are insufficient. | `src/backend/rules/eligibility.ts`, `src/backend/openapi/`, `src/app/api/v1/`; [B05](b05-public-api.md), ADR 0005. |
| Accessible completion | No tested Urdu voice/fallback or connected weak-network journey; authenticated switching unverified. | `src/components/citizen/citizen-{audio,narration,session,screen}.*`, `public/`; ADR 0006. |
| Submission/evaluation | Real AI, error/cost measurements, hosted monitoring, public video and deployment of branch fixes remain outstanding. | Audit blocker table, `src/backend/ai/*.live.test.ts`, `docs/verification/`, README, Vercel logs. |

## PR dependencies and ownership

- [PR #18](https://github.com/SyeddTaha/sanad-ai/pull/18): audit/fixes, **OPEN/DRAFT**, head `d32183c` before this handoff. PRs #1–#15/#17 were merged at audit baseline.
- [PR #16](https://github.com/SyeddTaha/sanad-ai/pull/16): Aayan/staff, **OPEN/DRAFT**, head `4e1648d`; coordinate DTO/freshness/directory work without replacing unfinished changes.
- [PR #19](https://github.com/SyeddTaha/sanad-ai/pull/19), merged: [A06 on current main](https://github.com/SyeddTaha/sanad-ai/blob/65b777d/docs/verification/a06-ai-trust-final-integration.md). Its separately configured A01 failure lacks diagnostics; distinguish it from this audit's skipped evaluations. Its component gate does not waive official AI requirements.
- Taha/backend lead (Developer 1): contracts, migrations, backend and Assessment orchestration. Frozen contracts/private-trace changes need explicit approval (ADR 0005).
- Developer 2: AI/crypto/registry components. Confirm mock-service producer ownership. Aayan: staff. Citizen/helper owner was not named in audited material; coordinate that frontend scope. D01: CI/Vercel; confirm deployment operator.

## Environment without secrets

Use ignored `.env`/`.env.local`; print names only. `npm ci` restores locked dependencies, including the Swagger Parser absent in A06's checkout.

- Server: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, **runtime** `SUPABASE_STRING`, optional `SUPABASE_DB_CA_FILE`. Package a host-readable CA when required; retain TLS verification.
- Browser: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; build-time `NEXT_PUBLIC_SANAD_STAFF_MODE=live` for actual staff requests. Private secrets never receive a public prefix.
- Local tests: existing `DEMO_{CITIZEN_A,CITIZEN_B,HELPER,OFFICER,ADMIN,AUDITOR}_PASSWORD` configuration; reuse synthetic accounts.
- AI: server-only `GROQ_API_KEY`; separate A01 spike settings `SANAD_SPIKE_AI_PROVIDER` / `SANAD_SPIKE_AI_API_KEY` (A06). A05's in-memory demo refuses production execution.

## Next authorized implementation and verification steps

1. Read `AGENTS.md`, official brief, `SPEC.md`, relevant ADRs, A04/A06 and installed Next.js guides. Confirm branch/owners, synchronize main deliberately and coordinate PR #16. This handoff approves no merge/deployment.
2. Reproduce hosted failures below; inspect matching Vercel logs, configuration presence, SQL/TLS and migrations. Fix the demonstrated cause. Gate: queues/dispatch 200, unknown well-formed key 401, private responses uncached.
3. Obtain owner approval for mock/registry/trace contracts. Implement **authorized snapshot → release transaction → external work → reauthorize/recheck consent, evidence and rules → immutable persistence**. Pass the current rule threshold; discard late unauthorized output; retain independent findings and human resolution.
4. Integrate approved frontend DTOs with Citizen-confirmed grants and staff review. Gate: real authenticated Citizen/helper-to-Officer completion, withdrawal/replay denial, tested Urdu fallback, safe family reauthentication and interrupted-network recovery.
5. Run checks below and real-provider evaluation; record actual versions/failures. Verify hosted workflow, accessibility, risk counts, monitoring and public video. Update the audit and stop at the release gate.

```powershell
npm run test:contracts
npm run test:backend
node --conditions=react-server --import tsx --test src/backend/adapters/*.test.ts src/backend/ai/assessment.test.ts src/backend/notices/*.test.ts spikes/ai-trust/crypto/*.test.ts spikes/ai-trust/ai/assess-message.test.ts
node --import tsx --test src/components/citizen/*.test.ts src/lib/*.test.ts
npm run typecheck
npm run lint
npm run build
# Separate terminal: npm run start -- --port 3700
'B01','B02','B03','B04','B05' | ForEach-Object { [Environment]::SetEnvironmentVariable("${_}_BASE_URL",'http://localhost:3700','Process') }
Remove-Item Env:B04_LIVE_SCENARIO -ErrorAction SilentlyContinue
foreach ($suite in 'test:backend:live','test:b02:live','test:b03:live','test:b04:live','test:b05:live','demo:b05') { npm run $suite; if ($LASTEXITCODE -ne 0) { throw "$suite failed" } }
node --env-file-if-exists=.env --env-file-if-exists=.env.local --conditions=react-server --import tsx --test src/backend/ai/assessment.live.test.ts src/backend/ai/assessment.urdu.live.test.ts
node --env-file-if-exists=.env --env-file-if-exists=.env.local --import tsx scripts/audit-release-http.ts https://sanad-ai-eta.vercel.app
```

Run live B01–B05 **sequentially against development services**, never against the public host: they change shared demo policy/memberships and install temporary test barriers. Coordinate with teammates first. Suggested recovery skills: `diagnosing-bugs` for a red-capable failure loop; `implement`/`tdd` at agreed seams; `code-review` before the next gate.
