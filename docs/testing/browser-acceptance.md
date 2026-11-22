# SANAD browser acceptance report

**Result: FAIL — do not treat the production deployment as a completed end-to-end vertical slice.**

Tested 22 November 2026, approximately 16:30 PKT, in headless Chromium 1.65.1 at desktop 1440×900 and mobile 390×844.

## Deployment and repository

- Production URL tested: <https://sanad-ai-eta.vercel.app>
- The root page returned HTTP 200 and redirected to `/citizen`.
- Vercel edge response trace from a root request: `bom1::zvzgv-1795347016648-74a9fc9c0d02`; `x-vercel-cache: HIT`.
- The alias did not expose an immutable deployment commit or deployment ID. The URL, test time, edge trace, and observed asset names identify this run; they do not identify a source commit.
- Chromium was already installed with the repository's `@playwright/test` dependency. No dependency or application code was changed for this acceptance run.
- Targeted browser automation used inline Playwright scripts with `node --env-file-if-exists=.env --env-file-if-exists=.env.local --input-type=module -`; configured account values were read in memory and never printed.
- One synthetic Citizen dispute submission was attempted and timed out without returning a Case ID. If the server completed an earlier draft mutation before the timeout, that synthetic draft may remain; the browser did not return an identifier that could be used to inspect it.
- Preflight branch: `fix/citizen-live-connection-status`. Preflight `git status` showed existing edits in `package.json`, `package-lock.json`, Citizen component files, and `tests/integration/b04.live.test.ts`, plus untracked `.citizen-browser-check.mjs`. No reset, stash, or checkout was run. Immediately before writing this report, `git status` showed edits in `package.json`, `package-lock.json`, and `tests/integration/b04.live.test.ts`, plus the new `docs/screenshots/` folder. This report is an additional new file. The difference between preflight and final status was not caused by a Git command in this QA run and should be reconciled with the workspace owner.

## Summary

Ten user-facing route views rendered in Chromium: the root redirect, login, six Citizen routes, Officer queue, and Admin dispatch. The dynamic Officer case page was only attempted without a valid case/session; `/staff` was not opened. Therefore the dynamic case page and staff selector are not counted as tested pages.

Of 26 grouped acceptance operations below: **8 PASS, 6 FAIL, and 12 NOT TESTED**. A PASS records only the behavior observed here; it does not inherit backend unit-test results.

### Public and Citizen

| Page or operation | Exact steps | Expected | Actual | Result | Screenshot / API evidence |
|---|---|---|---|---|---|
| Landing and navigation | Open `/`; follow the redirect; open each Citizen route directly; inspect the Citizen navigation and language control. | SANAD home and working navigation. | `/` rendered the Citizen home at `/citizen`; all six Citizen route URLs returned HTTP 200. Navigation and language control rendered. | PASS | [01 landing](../screenshots/01-landing-desktop.png), [03 dashboard](../screenshots/03-citizen-dashboard.png) |
| Login and invalid login | Open `/login`; submit an invalid synthetic email/password pair. | Generic rejection without a session. | Login form rendered; invalid login displayed “Sign-in failed. Check your credentials and active account, or try again later.” | PASS | [02 login](../screenshots/02-login.png); invalid credentials were not captured |
| Valid role login and logout | Sign in with each configured synthetic Citizen, Helper, Officer, Admin, and Auditor account; use the login page or staff sign-out control to sign out. | Correct role session; confirmed logout. | All five role sign-ins and sign-outs displayed success. Auth/session/logout requests observed with HTTP 200. No credentials were written to screenshots or this report. | PASS | API paths: `/api/v1/auth/login`, `/api/v1/session`, `/api/v1/auth/logout` |
| Unauthenticated staff redirects | In a fresh browser context open `/staff/officer`, `/staff/admin`, and a synthetic UUID case URL; wait six seconds. | Redirect to `/login`. | All three redirected to `/login`; `/api/v1/session` returned 401. | PASS | No sensitive route data captured |
| Citizen dashboard and route loading | Open `/citizen`, `/citizen/verify`, `/citizen/dispute`, `/citizen/results`, `/citizen/case`, and `/citizen/consent` at 1440×900. | Expected screen content and primary controls. | All screens rendered. The dashboard, form, static Passport, case loader, and live-consent form were visible. | PASS | [03 dashboard](../screenshots/03-citizen-dashboard.png), [04 verify](../screenshots/04-citizen-verify.png), [05 draft form](../screenshots/05-citizen-draft.png), [06 Passport](../screenshots/06-evidence-passport.png), [07 case](../screenshots/07-citizen-case.png), [08 consent](../screenshots/08-citizen-consent.png) |
| Empty and nonempty notice checks | On `/citizen/verify`, switch to English; submit an empty form, then enter synthetic test text and submit. | Validate empty input; verify the notice or clearly report service unavailability. | Empty input showed “Enter a notice or message first.” Nonempty input showed “Not checked. The service is disconnected, so this text was not sent anywhere.” No verification API call was made. | PASS for validation and honest unavailable state; notice verification itself NOT TESTED | [14 notice unavailable](../screenshots/14-notice-unavailable.png); no verification API endpoint was called |
| Citizen draft, save/reopen, and dispute submission | Sign in as Citizen A; open `/citizen/dispute`; enter synthetic reason and evidence; click “Send dispute”; wait up to 15 seconds for the form status. | Create/save a draft, recover it, and confirm submission. | The click was executed, but no completion/status message or case identifier appeared before timeout. The run could not establish whether a draft was persisted or a case submitted. | FAIL | [05 draft form](../screenshots/05-citizen-draft.png); no successful response was captured |
| Add evidence and request Assessment | Attempt separate evidence addition and an Assessment for a successfully loaded case. | Evidence and Assessment appear in the case Passport. | No confirmed Case ID was available to reach the case-specific actions. | NOT TESTED | — |
| Citizen Passport findings | Open `/citizen/results`; inspect finding rows and their states. | Six independent findings with honest statuses. | Three sample rows appeared — Notice authenticity, Payment status, Eligibility — all `Unknown`. The screen did not show six independent findings and was not populated from a loaded Case. | FAIL | [06 Evidence Passport](../screenshots/06-evidence-passport.png) |
| Live Case status and history | Open `/citizen/case`; enter a valid Case ID; select “Load live case.” | Show server Case status, history, and Passport. | A valid submitted Case ID was not obtained. The sample status remained a preview; live status/history could not be confirmed. | NOT TESTED | [07 case](../screenshots/07-citizen-case.png) |
| Consent grant and server withdrawal | Open `/citizen/consent`; test the live server grant form and preview withdrawal. | Grant/revoke a synthetic consent and observe server access change. | The sample’s “Preview withdrawal” action said “Local preview only; no access changed on a server.” It generated zero API requests. A server grant/revoke was not completed. | FAIL for user-visible withdrawal; grant NOT TESTED | [08 consent](../screenshots/08-citizen-consent.png); zero API calls from preview withdrawal |
| Local session reset | On `/citizen`, select “Switch Citizen / End Session.” | Clear local Citizen state and show ended-session screen. | The ended-session screen appeared. This did not verify cross-account isolation after real Case data was loaded. | PASS for local reset; shared-device isolation NOT TESTED | [15 session reset](../screenshots/15-citizen-session-reset.png) |

### Helper, Officer, Admin, and Auditor

| Page or operation | Exact steps | Expected | Actual | Result | Screenshot / API evidence |
|---|---|---|---|---|---|
| Helper shared-case workflow | Sign in as Helper; look for a helper page and attempt an explicitly shared Case operation. | See only explicitly shared Cases and perform permitted actions. | No Helper-specific UI route was found. No successful consent grant or shared Case was available. | NOT TESTED | No Helper route in the discovered page tree |
| Helper unauthorized/revoked access | Attempt unshared Case access, then revoke consent and replay access. | Deny unshared access and immediately deny revoked access. | No shared Case or grant was available for a meaningful replay. | NOT TESTED | — |
| Officer assigned queue | Sign in as Officer; open `/staff/officer`; wait ten seconds. Repeat at mobile width. | Queue data, empty state, or a visible API error. | The page remained on “Loading assigned cases…” at desktop and mobile. The browser saw `/api/v1/session` return 200, but no `/api/v1/cases` response was observed. The screen was also unstyled: the rendered `main` had zero computed padding and the screenshot shows the unformatted page. | FAIL | [10 Officer queue](../screenshots/10-officer-queue.png), [12 mobile queue](../screenshots/12-officer-queue-mobile.png) |
| Officer Case details and workflow | Open an assigned Case; inspect evidence, Passport, history, and try request evidence, escalate, create fresh Assessment, resolve, and close. | Assigned Case details and permitted transitions. | No queue item became available. | NOT TESTED | — |
| Admin dispatch | Sign in as Admin; open `/staff/admin`; wait seven seconds. Repeat at mobile width. | Dispatch rows or a visible API error; assignment and rule controls. | The page remained on “Loading dispatch queue…” with no dispatch rows. `/api/v1/session` and `/api/v1/rules/current` returned 200; no `/api/v1/admin/dispatch` response was observed. The page was unstyled. | FAIL | [11 Admin dispatch](../screenshots/11-admin-dispatch.png), [13 mobile dispatch](../screenshots/13-admin-dispatch-mobile.png) |
| Assign Officer and restricted evidence | Open a dispatch item, assign an Officer, and check that Admin cannot read evidence. | Confirm a synthetic assignment; keep evidence restricted. | No dispatch record loaded, so these actions could not be exercised. | NOT TESTED | — |
| Rule publishing | Change and publish the synthetic policy from Admin. | Publish a new immutable rule version and confirm it. | Policy controls were present in source/UI, but publishing would persist production data and no dispatch page reached a usable terminal state. No publication was attempted. | NOT TESTED | [11 Admin dispatch](../screenshots/11-admin-dispatch.png) |
| Auditor views and read-only boundary | Sign in as Auditor; open staff views and an audit view; try an unauthorized operation. | Read permitted audit information and deny writes. | Auditor sign-in succeeded. A dedicated Auditor page was not found; staff routing showed only shell content. The audit/read-only endpoints were not exercised to completion. | NOT TESTED | API-only audit route exists at `/api/v1/audit`; no auditor page discovered |

### Trust, AI, responsive behavior, and errors

| Page or operation | Exact steps | Expected | Actual | Result | Screenshot / API evidence |
|---|---|---|---|---|---|
| Signed notice verification | Submit a valid synthetic signed notice, then a tampered notice and an unknown-issuer notice. | Deterministic independent cryptographic findings. | The Citizen notice screen reports that its service is disconnected and does not submit text; no signed-notice UI flow was available. | NOT TESTED | [14 notice unavailable](../screenshots/14-notice-unavailable.png) |
| AI extraction/classification and human fallback | Run configured AI extraction/classification and inspect uncertain-case handoff. | Real provider response when configured; otherwise honest unavailable state. | No AI action was exposed in the tested UI. No live AI response is claimed. The disconnected notice state is honest about not processing input. | NOT TESTED | — |
| Desktop and mobile Citizen layout | Open every Citizen route at 390×844; inspect viewport width and horizontal scroll. | Usable layout without horizontal overflow. | All six Citizen routes plus login loaded at mobile width; no horizontal overflow was observed. | PASS for layout smoke; full control-by-control mobile workflow NOT TESTED | [09 mobile dashboard](../screenshots/09-citizen-mobile.png) |
| Console and failed requests | Inspect browser console/page errors while opening Citizen pages; inspect API responses during auth and staff navigation. | No uncaught browser errors or unexplained failed API calls. | Isolated Citizen route follow-up recorded zero console errors/page errors. A rapid-navigation pass recorded two console-error events that were not reproduced; their text was not retained. Navigation away from in-flight pages caused `net::ERR_ABORTED` on `/api/v1/session` and `/api/v1/auth/logout`; these were browser-aborted requests, not HTTP error responses. No staff queue API response was captured. | FAIL for unresolved staff loading; console events NOT REPRODUCED | API evidence is recorded in this report; no tokens or response bodies retained |

## Operation counts

The grouped operations in the tables above total 26: **8 PASS, 6 FAIL, 12 NOT TESTED**. The nonempty notice response is counted as an honest unavailable-state PASS; cryptographic notice verification remains NOT TESTED. The mobile smoke and auth checks establish browser behavior only for the stated viewport and synthetic roles. No backend test was counted as UI evidence.

## Release blockers and likely owners

### P0 — Hosted vertical slice cannot be demonstrated

Citizen submission did not produce a confirmed Case, and the Officer and Admin queues remained loading without queue API responses. No Case reached an Officer, and no end-to-end Citizen-to-staff workflow was demonstrated. Do not present this deployment as a completed functional service.

Browser-visible source paths that own these flows are [citizen-screen.tsx](../../src/components/citizen/citizen-screen.tsx), [citizen-api.ts](../../src/components/citizen/citizen-api.ts), [officer/page.tsx](../../src/app/staff/officer/page.tsx), [admin/page.tsx](../../src/app/staff/admin/page.tsx), and [staff-api.ts](../../src/lib/staff-api.ts). The acceptance run does not establish whether the staff requests are never issued, remain pending, or fail before a response; production logs and a successful browser replay are needed to isolate the cause.

### P1 — UI does not match required independent findings and server consent

The Passport shows three static sample findings rather than six case-backed findings. Sample withdrawal explicitly changes only local preview state and sends no request. The source paths are [citizen-screen.tsx](../../src/components/citizen/citizen-screen.tsx) and [citizen-view-adapter.ts](../../src/components/citizen/citizen-view-adapter.ts). These require application changes before those requirements can pass in the browser.

### P1 — Staff routes render without their expected styling

The desktop queue and dispatch screenshots are visibly unstyled, and computed main padding was `0px` despite utility classes on the staff view. Relevant build/style paths to inspect are [globals.css](../../src/app/globals.css) and [next.config.ts](../../next.config.ts). This run identifies the rendered defect but does not prove which build step caused it.

The blank shell seen briefly for a Helper or Auditor on an Officer route was not classified as an access-control bypass: the server session endpoint returned a valid role session and the staff shell withheld the page body. However, the auditor's permitted audit view and server-side write denial were not verified.

## Screenshot index

All 15 files are genuine Chromium screenshots from the tested deployment. Test-only text, where shown, is synthetic. Staff account IDs were masked in the staff screenshots.

1. [01 landing desktop](../screenshots/01-landing-desktop.png)
2. [02 login](../screenshots/02-login.png)
3. [03 Citizen dashboard desktop](../screenshots/03-citizen-dashboard.png)
4. [04 notice form desktop](../screenshots/04-citizen-verify.png)
5. [05 draft form desktop](../screenshots/05-citizen-draft.png)
6. [06 Evidence Passport](../screenshots/06-evidence-passport.png)
7. [07 Case status screen](../screenshots/07-citizen-case.png)
8. [08 consent screen](../screenshots/08-citizen-consent.png)
9. [09 Citizen dashboard mobile](../screenshots/09-citizen-mobile.png)
10. [10 Officer queue desktop](../screenshots/10-officer-queue.png)
11. [11 Admin dispatch desktop](../screenshots/11-admin-dispatch.png)
12. [12 Officer queue mobile](../screenshots/12-officer-queue-mobile.png)
13. [13 Admin dispatch mobile](../screenshots/13-admin-dispatch-mobile.png)
14. [14 notice unavailable state](../screenshots/14-notice-unavailable.png)
15. [15 Citizen session reset](../screenshots/15-citizen-session-reset.png)

## Defect reproduction

1. **Citizen submission has no completion:** sign in as the synthetic Citizen A, open `/citizen/dispute`, switch to English, enter synthetic reason/evidence text, select “Send dispute,” and wait 15 seconds. The form did not display a completion message or a usable Case ID.
2. **Officer queue stays loading:** sign in as Officer, open `/staff/officer`, and wait ten seconds. “Loading assigned cases…” remains visible and no queue API response appears in the browser response log.
3. **Admin dispatch stays loading:** sign in as Admin, open `/staff/admin`, and wait seven seconds. “Loading dispatch queue…” remains visible; `/api/v1/rules/current` succeeds but no dispatch API response appears.
4. **Consent withdrawal is only a preview:** open `/citizen/consent`, select “Preview withdrawal” under a sample grant. The page says no server access changed and emits no API request.

**Next action:** restore a confirmed production browser path from Citizen draft through Officer queue, then rerun this acceptance report against the same deployment or its replacement.
