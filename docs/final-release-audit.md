# SANAD final integration and release audit

**Release gate: FAIL. Do not present the deployed application as a completed AI-powered vertical slice.**

Audit date: 22 November 2026, PKT. Submission deadline: 18:00 PKT.
Public application: <https://sanad-ai-nine.vercel.app/>.
Repository: <https://github.com/SyeddTaha/sanad-ai>.
Baseline: `06bd0c5` (updated `origin/main`, merged B05). Branch: `feat/final-integration`.

PASS means observed behavior within the stated environment. FAIL means an observed failure or a required implementation is absent. NOT TESTED means execution evidence is unavailable. Module tests, local production HTTP, and public-host behavior are distinguished below.

## Integration and work preservation

GitHub metadata and `git merge-base --is-ancestor <PR head> 06bd0c5` agree that PRs **#1–#15 and #17** are merged and their heads are ancestors of the audited baseline. This includes B01–B05, both Citizen slices, the staff foundation, A01–A05, and deployment/CI configuration.

**PR #16, staff live integration, remains OPEN/DRAFT**, head `2b8472bdca01ef8c255b350175e347f294c0211c`. It was not merged or overwritten. Completed PRs being merged does not establish that their deferred integrations exist.

The original checkout remains on `feat/public-api` with its preexisting uncommitted `tests/integration/b04.live.test.ts` edit. Audit work uses the separate sibling worktree `sanad-ai-final-integration`; no stash, reset, or edit of the original checkout was performed. Frozen v1 contracts, Case/authorization HTTP implementation, and applied migrations are unchanged. The standalone AI routing guardrail has the narrow correction documented below.

Read sources: `AGENTS.md`, `SPEC.md` and its canonical `.scratch/sanad-verification/spec.md`, all six ADRs, `GLOSSARY.md`, all three files in `docs/brief/`, B01–B05 handoffs and verification records. `TASKS.md` is absent. The official Markdown brief governs requirement coverage; prior handoff results are not counted as fresh execution evidence.

## Mandatory official requirements

| Requirement | Status | Evidence and practical limit |
| --- | --- | --- |
| One multi-user platform for the Citizen, shopkeeper and helper | FAIL | One Next.js app and five authenticated roles exist. Citizen notice/dispute/sharing screens do not call the backend; no complete browser journey exists. |
| Secure JWT/OAuth login and server RBAC, at least three roles | PASS | Real public login/session/logout for Citizen, Helper, Officer, Admin and Auditor; 81 offline backend tests cover default-deny ownership, role, assignment and consent checks. Local live results below qualify further behavior. |
| Dashboard with progress, status and history | FAIL | Real Case/history/queue APIs exist, but Citizen progress is a sample and public Officer dashboard uses fixtures. |
| Create, assign, escalate and close Cases | NOT TESTED | Offline lifecycle tests pass. Full fresh local authenticated workflow results are pending below; public queues return 503 and Citizen submission sends no request. Hosted end-to-end behavior fails. |
| Public REST API with API keys and Swagger/OpenAPI | FAIL | Public OpenAPI 3.1 returns 200, documenting 37 operations across 32 paths; offline schema/route coverage passes. Public keyed request returns 503 instead of 401 for an unknown well-formed credential. |
| Audit every user, AI and automated action | FAIL | Immutable backend action/audit behavior is tested; there is no integrated AI invocation or persisted full AI trace to audit. Fixture clicks do not constitute persisted actions. |
| Consent: see, share, withdraw and correct | FAIL | Real scoped grants, revocation and append-only correction APIs exist and have offline coverage. Public Citizen controls only modify a local preview. |
| Mock identity, payment and data services behind clean APIs | FAIL | No identity/payment/general program lookup adapters or REST routes exist in integrated `src/backend`/`src/app/api`. B04 case-scoped `synthetic_program_inputs` is not the three required service APIs. |
| At least three additional platform features | FAIL | Backend immutable rule publication and priority/confidence-sorted officer queues exist. A usable low-bandwidth Citizen task is absent; UI save-state labels alone do not implement it. No third completed feature is established. |
| At least three working AI capabilities | FAIL | Structured extraction, classification/routing and guardrails exist as modules. They are not invoked by the Case HTTP path; real-provider evaluations all skipped for missing credentials. |
| Database and migrations | PASS | Eleven migrations are present; `npm run db:migrate` connected to real development PostgreSQL with trusted TLS and reported already current. Offline PGlite tests exercise migrated storage/constraints and repeat setup. |
| Deployed link | PASS | Supplied public URL responds; seven SANAD pages, login/session and OpenAPI are reachable. This does not establish a working deployed vertical slice. |
| Monitoring, logs and basic tests | PASS | Database audit metadata, sanitized API errors and automated tests exist. Host operational log access/alerting was NOT TESTED. |
| Prototype, synthetic data and honest capability labels | PASS | Citizen and staff screens disclose prototype/disconnected/fixture behavior. All audit input and existing test records are synthetic; no real identity/payment integration is claimed. |
| Build during event, originality, team size | NOT TESTED | Cannot certify eligibility or provenance of all team work from runtime checks. |
| Functional AI-powered prototype and live demo | FAIL | Required UI/backend/AI/mock integration and hosted SQL behavior are incomplete. |
| Code repository and README | PASS | Repository and README exist. README now links this audit so its limitations are explicit. Public unauthenticated repository accessibility was NOT TESTED. |
| Public Google Drive demonstration video | NOT TESTED | No video link was supplied or found in tracked project documentation. Slides are optional. |

## Eight technical challenges

| Challenge | Status | Evidence |
| --- | --- | --- |
| Cost of being wrong | FAIL | No automatic payment approval exists; human Case resolution is separate from findings. No measured cost/threshold experiment with false-verification/false-alarm counts is provided by this audit. |
| Saying “I am not sure” | FAIL | Modules have schema failure/outage/manual-review behavior and Case findings stay unknown. No integrated AI-to-human handoff with actual AI notes runs. |
| Missing, duplicated or wrongly spelled data | FAIL | Validation and ambiguous synthetic-program inputs are tested. Required mock lookup outcomes and name-variant/no-wrong-match integration cannot run because those services are absent. |
| Rules change without code or redeploy; old versions remain | PASS | Offline rules/assessment tests exercise immutable publication and changed thresholds with preserved history. Live concurrency results are recorded below. Public rule management remains blocked by runtime SQL. |
| User explanation and full Auditor AI trace | FAIL | Adapter returns internal trace transiently; Case Assessments store unavailable AI metadata. No persisted real AI input/model/confidence/result trace is available. See `docs/ai-integration-adapters.md`. |
| Consent take-back truly stops access | FAIL | Backend unit/integration seam tests enforce revocation and replay checks. Citizen browser withdrawal emits zero API requests, so user-visible take-back is not integrated. |
| Person who cannot read finishes on weak internet | FAIL | Mobile Chrome had no Urdu voices and reported audio unavailable. No prerecorded audio assets are present. Notice/dispute submissions are disconnected, so a no-reading/weak-network completion cannot succeed. |
| Scams and edited notices with honest false alarms | FAIL | Real Ed25519 mutation/unknown-key/outage module tests pass. HTTP Assessments do not invoke verification; no live integrated false-alarm evaluation is established. |

## AI, cryptography, evidence and versioning

| Check | Status | Evidence |
| --- | --- | --- |
| Exact Ed25519, original signing input, key/issuer binding, tampering | PASS | Executed signed-notice and spike crypto tests reject modified amount/recipient/payment, unsupported `EdDSA`, duplicate JSON, embedded trust sources and malformed input. |
| Separate signature, expiry, revocation, identity, payment, eligibility | PASS | Shared schemas and module tests preserve independent findings; unknown remains distinct from failed/ineligible. |
| Trusted server registry integrated into HTTP Assessment | FAIL | Only the in-memory synthetic demo registry exists; `cases/assessments.ts` does not call `verifyNoticeForCase`. Production demo runner intentionally refuses execution. |
| Real AI invoked by authenticated Case request | FAIL | `createAssessment` returns `UNAVAILABLE/provider_not_configured` when processing is authorized. It never invokes `assessForCase`, regardless of configured provider credentials. |
| Real-provider English and Urdu evaluation | NOT TESTED | Three existing evaluations were invoked and all skipped: `GROQ_API_KEY` and spike-provider credentials absent in this audit environment. Exit 0 is not a live-AI pass. |
| AI response validation and no financial authority | PASS | Offline injected-provider tests reject invalid schemas, unsupported assertions and timeouts, and project advisory metadata without payment/eligibility authority. No live AI behavior is asserted. |
| Low-confidence human handoff | PASS | Audit reproduced `confidence:0.01 → INFORMATION_ONLY` in the standalone service. Regression now returns `OFFICER_REVIEW`; supplied threshold/boundary and invalid-threshold tests also pass. Integration must pass the current published `minRoutingConfidence`; default 0.8 is the already approved synthetic policy, not calibrated probability. |
| AI consent revocation during actual provider work | NOT TESTED | Policy/offline no-processing and replay tests exist, but the two-transaction snapshot/provider/recheck/persist orchestrator is absent. |
| Evidence Passport immutable assessment/source history | PASS | Contract and offline backend tests exercise prior Assessments, corrections, current access and distinct findings. Fresh local live evidence below. |
| Rule-version/evidence freshness and atomic human resolution | PASS | Offline tests verify unavailable/stale basis rejection, changed evidence/rules, human reason, consent and rollback. No shared backend code was changed by this audit. |
| Four lookup outcomes for each mock service | FAIL | `FOUND`, `NOT_FOUND`, `AMBIGUOUS`, `UNAVAILABLE` cannot be exercised through absent APIs. A permanently unknown finding is not a tested lookup. |

## Public deployment observations

Probes ran against the supplied URL on 22 November 2026 around 10:59–11:04 PKT, using real synthetic account passwords kept in ignored environment files. No password, cookie, bearer token or API credential is printed in captured evidence.

| Request or browser action | Status | Actual observation |
| --- | --- | --- |
| `GET /` | FAIL | HTTP 200, heading `To get started, edit the page.tsx file.`; no SANAD entry. Fixed in this branch, not deployed. |
| `/login` and six Citizen routes | PASS | HTTP 200; Citizen route content is an interface prototype. |
| Public OpenAPI | PASS | HTTP 200, OpenAPI 3.1, 32 paths. |
| Anonymous `GET /api/v1/session` | PASS | 401 `UNAUTHENTICATED`, `no-store`. |
| Login/session/logout for five roles | PASS | Each returned 200 with its database-held role and protected session headers. |
| Unknown well-formed API key on `GET /api/v1/cases` | FAIL | 503; local production with configured PostgreSQL returns 401 `INVALID_API_KEY`. |
| Authenticated Officer `GET /api/v1/cases?limit=1` | FAIL | 503 `SERVICE_UNAVAILABLE`. |
| Authenticated Admin `GET /api/v1/admin/dispatch?limit=1` | FAIL | 503 `SERVICE_UNAVAILABLE`. |
| Mobile notice submission | FAIL | “Not checked. The service is disconnected…”; zero `/api/` requests. |
| Mobile dispute submission | FAIL | “Dispute not submitted…no case was created.”; zero `/api/` requests. |
| Mobile sharing withdrawal | FAIL | “Local preview only; no access changed on a server.”; zero `/api/` requests. |
| Mobile Officer dashboard after actual form login | FAIL | Shows “Fixture demo mode…”; login/session requests occur, no real queue request. |
| Urdu instruction button | FAIL | Chrome speech voice list empty; unavailable message displayed. No prerecorded alternative. This does not certify behavior on all devices. |
| Local Citizen session reset | PASS | Entered synthetic notice was empty after End Session → Start New Session → Verify. This is not authenticated family switching. |
| Browser private persistence | PASS | In the tested disconnected journey, localStorage/sessionStorage/CacheStorage/IndexedDB inventories were empty. Actual private-data caching under a completed workflow was NOT TESTED. |
| Browser console | PASS | No `pageerror` events in the completed mobile smoke. |
| Slow/dropping-network completed workflow and 40-family switching | NOT TESTED | No usable Citizen workflow to complete. Unit late-response isolation is not that browser acceptance. |

The combination of working Auth/RPC sessions and failing SQL-backed queues/keys narrows the hosted failure to the shared runtime SQL path. Missing `SUPABASE_STRING`, unreachable SQL endpoint, TLS/CA configuration, or another deployment-specific connection failure remain hypotheses: deployment environment/logs were unavailable. It is not established which one caused the 503. The deployment guide incorrectly said SQL variables were unnecessary on Vercel; this branch corrects that instruction.

## Executed release checks

| Command | Result |
| --- | --- |
| `npm ci` | PASS; 405 packages installed, audit reported 0 vulnerabilities. |
| `npm run test:contracts` | PASS; 25 passed, 0 failed/skipped. |
| `npm run test:backend` | PASS; 81 passed, 0 failed/skipped. |
| `node --conditions=react-server --import tsx --test src/backend/adapters/*.test.ts src/backend/ai/assessment.test.ts src/backend/notices/*.test.ts spikes/ai-trust/crypto/*.test.ts spikes/ai-trust/ai/assess-message.test.ts` | PASS; final source 58 passed, 0 failed/skipped (initial baseline 55, plus three AI guardrail regressions). |
| `node --import tsx --test src/components/citizen/*.test.ts src/lib/*.test.ts` | PASS; 26 passed, 0 failed/skipped. |
| Live AI evaluation command (below) | NOT TESTED; 0 passed, 3 skipped for missing credentials. |
| `npm run typecheck` | PASS; exit 0, including audit script and B01 regression correction. |
| `npm run lint` | PASS; exit 0 on final source. |
| `npm run build` | PASS; Webpack production build on baseline and corrected runtime source `d9ac0f2`. Final build ran in detached sibling `sanad-ai-release-build` to avoid replacing files used by ongoing live suites. |
| `npm run db:migrate` | PASS; real TLS PostgreSQL connection, none pending. |
| `scripts/audit-release-http.ts` on public URL | FAIL; 12 probes pass and four fail: entry, API-key rejection, Officer queue, Admin dispatch. |
| Same smoke on baseline local production | FAIL only for starter entry; all authentication and SQL-backed queue/key probes pass. |
| Corrected entry on final local production, port 3700 | PASS; same `--entry-only` probe changed from FAIL to HTTP 200 with final path `/citizen`. |
| Full corrected local HTTP smoke on port 3700 | PASS; all 16 probes, zero failures, including queues/key denial and five real role sessions. |
| Configured-secret scan | PASS; 8 private configured values absent from feature diff and 85 public static files in final build (86 inspected inputs including diff). No values printed. |
| Mobile Chrome browser smoke | Executed against public host; failures detailed above. Harness exit 0 means observations completed, not release readiness. |
| B01–B05 local live suites | In progress; final results must replace this row before closing the audit. |

Live AI invocation:

```sh
node --env-file-if-exists=.env --env-file-if-exists=.env.local --conditions=react-server --import tsx --test src/backend/ai/assessment.live.test.ts src/backend/ai/assessment.urdu.live.test.ts spikes/ai-trust/ai/live-inference.test.ts
```

HTTP smoke reproduction (reads existing records, plus synthetic login/logout):

```sh
node --env-file-if-exists=.env --env-file-if-exists=.env.local --import tsx scripts/audit-release-http.ts https://sanad-ai-nine.vercel.app
node --import tsx scripts/audit-release-http.ts http://localhost:3600 --entry-only
```

Existing live suites run sequentially on development services with all `B01_BASE_URL` through `B05_BASE_URL` set to `http://localhost:3600` and `B04_LIVE_SCENARIO` unset. They preserve immutable synthetic history, temporarily change shared demo roles/rules/consents and install test barriers. Do not run those suites against the public host or concurrently with teammates' live fixtures.

## Narrow release fixes

1. `src/app/page.tsx`: `/` redirects to existing `/citizen` instead of the Next.js starter. The HTTP entry probe failed before the change and passed against the rebuilt production app on port 3700. No new Citizen functionality is implied.
2. `docs/deployment.md`: documents runtime PostgreSQL/TLS requirements and build-time staff live-mode switch. No deployment environment was changed.
3. `tests/integration/b01.live.test.ts`: compares returned department IDs with actual stored memberships and requires the approved seed department, instead of assuming a staff account has exactly one department. The first live run failed at `2 !== 1`; two memberships exist for both staff roles. Seed is additive and correctly retains them. Session cookies are retained for cleanup before subsequent assertions.
4. `scripts/audit-release-http.ts`: repeatable red-capable smoke with credential-free output, including explicit public queue/key assertions.
5. `src/backend/ai/assessment.ts` and its existing service tests: confidence previously never participated in deterministic routing. The minimized synthetic-provider repro and new regression failed with `0.01/INFORMATION_ONLY`; the fix requires human review below the supplied rule threshold, validates that threshold before processing, and preserves the actual advisory score. Three regressions pass, with no real provider claim. No HTTP/frozen contract changes; the optional server-only option allows future orchestration to supply the current immutable rule's threshold.

No missing mock service, approved shared contract, AI orchestration, staff draft work, migration, role, or permission policy was invented or replaced to make checks green. These missing implementations are material work with ownership/contract dependencies, not a safe final-audit patch.

## Focused review

Review target: `git diff 06bd0c5...d9ac0f2`. Independent read-only Standards and Spec reviews were required by the implement/code-review skills; neither reviewer accessed credentials, changed data or reran live tests.

**Standards:** zero documented violations. One optional P3 duplication heuristic: the smoke repeats synthetic actor/email definitions already present in the server-only seed module. Values match; consolidating fixtures is deferred outside release-blocker scope.

**Spec:** zero introduced functional mismatches or scope creep. The reviewer required pending live evidence to be finalized before closure and confirmed that inherited product gaps must keep the release gate at FAIL. These review results do not approve the incomplete product for release.

## Exact remaining submission blockers

| Priority | Blocker | Required concrete closure evidence |
| --- | --- | --- |
| P1 | Public runtime SQL requests fail | Correct host PostgreSQL/TLS configuration using deployment logs; actual authenticated queues, keys and complete synthetic workflow on the public URL. |
| P1 | Citizen/helper application is disconnected | Authenticated intake/save/Assessment/Passport/sharing/dispute/status/correction/withdrawal browser flow calling existing APIs; no fixture substitution. |
| P1 | AI and crypto are not integrated into Assessments | Snapshot → external work outside locks → reauthorize/recheck versions → append immutable Assessment; trusted server registry and actual provider configured. Demonstrate tampering and independent payment/eligibility. |
| P1 | Mandatory three mock services absent | Owner-approved interfaces/fixtures and protected endpoints; four lookup outcomes, ambiguity, missing/mismatched records and outages tested. |
| P1 | At least three AI capabilities and complete Auditor trace not demonstrated | Real-provider scenarios with actual versions/output and protected persisted trace; malformed/outage/low-confidence handoff without financial authority. |
| P1 | Accessible weak-network journey absent | Tested Urdu audio/fallback and a person completing the actual mobile task under recorded weak/interrupted connectivity; safe authenticated switching. |
| P1 | Staff workflow not integrated for release | Resolve/review PR #16 with normal checks; select and test live build mode. Current Admin assignment requires a staff-directory dependency and is disabled in live mode. Browser resolution freshness must be verified. |
| Submission | Public demo video unavailable | Supply and verify the required publicly accessible Google Drive recording link. |
| Deployment | Entry fix not on supplied URL | Review and deploy the feature change through normal protected merge/release; rerun entry smoke. |

The release gate remains **FAIL** even if all local backend suites pass. Stop at this verification gate: no merge to main, production deployment, submission, or assertion of release approval is performed by this audit.
