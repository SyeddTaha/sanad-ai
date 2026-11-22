# SANAD final UI acceptance report

**Result: FAIL — the hosted build is not ready for a complete demo.**

Tested on 22 November 2026, approximately 17:40–17:58 PKT, using headless Chromium 1.65.1 at desktop 1440×900 and mobile 390×844. Target: https://sanad-ai-eta.vercel.app.

The root response redirected to /citizen (HTTP 307). Vercel trace: bom1::fttg5-1795351239705-226194388ac5 at approximately 17:40 PKT. The alias does not identify an immutable source commit, so this report cannot prove which repository revision is deployed.

## Summary

- **Routes discovered:** 12 page routes, including /, /staff, and dynamic Officer detail /staff/officer/cases/{caseId}.
- **Routes actually opened:** 12/12. Citizen, Officer, Admin, Helper, and Auditor synthetic accounts were used for role checks. The Officer detail route was opened with a synthetic draft UUID.
- **Grouped acceptance operations:** **8 PASS, 12 FAIL, 8 NOT TESTED**.
- **Responsive layout:** No horizontal overflow measured on the 12 routes at either requested viewport. Citizen styling rendered; Officer/Admin pages fit the viewport but are visibly unstyled.
- **P0 release blocker:** Citizen submission does not progress beyond draft creation, and neither staff queue sends its queue request. The Citizen → Admin → Officer journey cannot be demonstrated.
- **Final demo readiness:** Not ready for an end-to-end workflow. A limited Citizen UI and synthetic login demo can be shown with sample data and prototype caveats.

## Route-by-route inventory

Screenshot paths are relative to docs. All images under screenshots/final/ are actual Chromium captures from this run.

| URL | Role | Controls exercised / observed | API requests observed | Result | Screenshots |
|---|---|---|---|---|---|
| / | Public → Citizen | Opened root and followed redirect; home links, language toggle, audio play/stop, session reset. Language switched Urdu → English → Urdu. Audio reported that no Urdu voice is available. Session reset cleared local form/preview state but emitted no logout request. | GET /api/v1/session 200 after login; no logout request observed. | **PASS** for redirect/render and language toggle; server logout **FAIL**. Home shows only three sample findings. | [Desktop](../screenshots/final/root-desktop.png), [mobile](../screenshots/final/root-mobile.png), [English desktop](../screenshots/final/citizen-home-english-desktop.png), [English mobile](../screenshots/final/citizen-home-english-mobile.png), [reset](../screenshots/final/citizen-session-reset-desktop.png) |
| /login | Public; all five configured synthetic roles | Valid login as Citizen, Helper, Officer, Admin, Auditor; invalid synthetic login; Check session; Sign out while unauthenticated. | POST /api/v1/auth/login 200 for configured roles; invalid pair 401; unauthenticated GET /api/v1/session 401. | **PASS** for login, invalid-login feedback, and logged-out session check. Staff sign-out completion is recorded separately. | [Desktop](../screenshots/final/login-desktop.png), [mobile](../screenshots/final/login-mobile.png), [invalid login](../screenshots/final/login-invalid-desktop.png) |
| /citizen | Citizen | Home content, available navigation, language, audio, session reset. English and Urdu document directions were ltr and rtl respectively. | GET /api/v1/session 200. | **FAIL** for complete Passport presentation: home has three fixture findings. Audio playback **NOT TESTED** because Chromium had no Urdu speech voice; the UI reported that limitation. | [Desktop](../screenshots/final/citizen-home-english-desktop.png), [mobile](../screenshots/final/citizen-home-english-mobile.png) |
| /citizen/verify | Citizen | Empty submit validation and nonempty synthetic input; QR-scan future-feature panel observed. | No notice verification request observed. | **FAIL**: empty validation appeared, but nonempty submit remained at SAVING and made no verification request. Valid/tampered signed JWS verification was not available to test. | [Desktop](../screenshots/final/citizen_verify-desktop.png), [mobile](../screenshots/final/citizen_verify-mobile.png), [input state](../screenshots/final/citizen-verify-unavailable-desktop.png) |
| /citizen/results | Citizen | Sample Passport rows and dispute link observed. | GET /api/v1/session 200; no case-backed Passport request. | **FAIL**: only three rows appear—notice authenticity, payment, eligibility—all unknown. The six independent findings are absent. | [Desktop](../screenshots/final/citizen_results-desktop.png), [mobile](../screenshots/final/citizen_results-mobile.png) |
| /citizen/dispute | Citizen | Filled reason and synthetic evidence, then selected Send dispute once. | POST /api/v1/case-drafts 201; GET /api/v1/case-drafts/7f7753d4-c3fd-4cae-9431-ceb59d58b9d5 200. No draft PATCH, evidence POST, or case POST followed. | **FAIL**: remained at SAVING after 18 seconds; no Case ID or completion appeared. A synthetic draft was created and may remain. | [Desktop](../screenshots/final/citizen_dispute-desktop.png), [mobile](../screenshots/final/citizen_dispute-mobile.png), [after submit](../screenshots/final/citizen-dispute-after-submit-desktop.png) |
| /citizen/case | Citizen | Entered the synthetic draft UUID and selected Load live case. | Session checks only; no Case/history/Passport request observed. | **FAIL**: live Case status/history/Passport did not load; sample Case remains visible. | [Desktop](../screenshots/final/citizen_case-desktop.png), [mobile](../screenshots/final/citizen_case-mobile.png), [live attempt](../screenshots/final/citizen-case-live-error-desktop.png) |
| /citizen/consent | Citizen | Loaded grants for the synthetic draft; set department purpose, synthetic department recipient, and future expiry; attempted Grant consent; selected sample withdrawal. | GET /api/v1/cases/{draftId}/consents 200. No grant or revoke request observed. | **FAIL** for live consent controls: grant did not complete. Sample withdrawal explicitly reported that it was local only and changed no server access. Server withdrawal and post-revocation denial are **NOT TESTED**. | [Desktop](../screenshots/final/citizen_consent-desktop.png), [mobile](../screenshots/final/citizen_consent-mobile.png), [live form](../screenshots/final/citizen-consent-live-desktop.png), [sample withdrawal](../screenshots/final/citizen-consent-preview-withdrawal-desktop.png) |
| /staff | Officer, Admin, Helper, Auditor | Opened with staff roles. Officer routing selected the Officer area. Helper and Auditor were redirected to /login; neither has a dedicated page. | Role logins and GET /api/v1/session 200; unauthorized/unauthenticated checks returned 401 where applicable. | **PASS** for observed role routing. Helper workspace and Auditor dashboard are absent; their supported work is not a UI journey. | [Anonymous desktop](../screenshots/final/staff-desktop.png), [anonymous mobile](../screenshots/final/staff-mobile.png), [Officer redirect](../screenshots/final/staff-redirect-officer-desktop.png), [Helper](../screenshots/final/helper-desktop.png), [Auditor](../screenshots/final/auditor-desktop.png) |
| /staff/officer | Officer | Changed status and sort selects; clicked Sign out. | Login/session 200. No GET /api/v1/cases queue request. No logout request observed after clicking Sign out. | **FAIL**: remains at “Loading assigned cases…” with no empty/error state; sign-out did not visibly complete during the wait. | [Desktop](../screenshots/final/officer-desktop.png), [mobile](../screenshots/final/officer-mobile.png), [controls](../screenshots/final/officer-controls-desktop.png) |
| /staff/officer/cases/{caseId} | Officer | Opened using the created synthetic draft UUID. | Session checks only; no Case detail request observed. | **FAIL**: remains at “Loading case…”. Review/evidence/history/actions could not be reached. | [Desktop](../screenshots/final/officer-case-detail-desktop.png), [mobile](../screenshots/final/officer-case-detail-mobile.png) |
| /staff/admin | Admin | Admin dispatch page and Sign out control observed. Assignment/rule controls never rendered. | Login/session 200. No /api/v1/admin/dispatch, officer directory, or rule request observed. | **FAIL**: remains at “Loading dispatch queue…”. Assignment and policy controls could not be exercised. | [Desktop](../screenshots/final/admin-desktop.png), [mobile](../screenshots/final/admin-mobile.png) |

## Acceptance operation matrix

A PASS applies only to the behavior stated.

| Operation | Result | Observed outcome |
|---|---|---|
| Root redirect and Citizen render | PASS | / redirected to /citizen. |
| Synthetic role login | PASS | All five configured roles accepted by the current deployment. |
| Invalid login and no-session check | PASS | Invalid login returned 401 with generic feedback; no-session check returned 401 and “No active session.” |
| Helper/Auditor staff route restriction | PASS | Both redirected to /login; no dedicated workspace was found. |
| Citizen English/Urdu toggle | PASS | Document lang/dir changed between en/ltr and ur/rtl; English screenshot captured. |
| Citizen layout at 1440×900 and 390×844 | PASS | All 12 route patterns measured with no horizontal overflow. |
| Local Citizen session reset | PASS | Form, preview, and audio state cleared; the server logout result is tracked separately as a failure. |
| Empty notice validation | PASS | Empty input showed the required notice prompt. |
| Nonempty notice response | FAIL | Button remained SAVING; no verification API request was observed. |
| Home summary findings | FAIL | Dashboard also shows only three sample findings rather than six independent findings. |
| Six-finding Evidence Passport | FAIL | UI showed three fixture findings, not six independent case-backed findings. |
| Dispute draft save and submit | FAIL | Draft reservation/read succeeded, then UI stalled before save/evidence/submit. |
| Live Case status/history/Passport | FAIL | No live Case request or server-backed result appeared. |
| Live consent listing/grant | FAIL | Listing returned 200, but grant did not complete and emitted no grant request. |
| Consent withdrawal | FAIL | Preview changed only local text/state; no server revoke request. |
| Denial after consent withdrawal | NOT TESTED | No server grant/revoke pair completed, so denial could not be replayed. |
| Officer/Admin cross-role access denial | NOT TESTED | Correct-role pages and Helper/Auditor redirects were checked; cross-access between Officer and Admin was not replayed. |
| Cross-account isolation after session reset | NOT TESTED | Reset cleared local state, but a second Citizen session was not loaded to verify isolation. |
| Officer queue and filters | FAIL | Selects changed, but queue remained loading and no queue API request was sent. |
| Officer case review/actions | NOT TESTED | Case detail stayed loading; no review controls became available. |
| Admin dispatch/assignment/rule publication | FAIL | Dispatch stayed loading; dispatch/officer/rule requests and controls were absent. |
| Staff styling | FAIL | Officer/Admin screenshots show plain unstyled content despite fitting the viewport. |
| Staff sign-out completion | FAIL | Sign out was clicked; no logout request or redirect was observed. Citizen session reset likewise sent no logout request. |
| Citizen → Admin → Officer handoff | FAIL | No Case reached Admin dispatch or an Officer. |
| Valid/tampered signed-notice verification | NOT TESTED | No valid synthetic signed JWS was available; the UI did not issue a verification request for test text. |
| Audio narration playback | NOT TESTED | Play control reported “No Urdu voice is available on this device”; instructions were not played. |
| Helper shared-case operation and revoked access | NOT TESTED | No Helper UI/workflow or live consent was available. |
| Auditor audit view and read-only write denial | NOT TESTED | No Auditor page; API audit/write boundary was not exercised. |
| AI extraction/classification and human fallback | NOT TESTED | No reachable UI action was presented. |

**Counts:** 8 PASS, 12 FAIL, 8 NOT TESTED.

## Console, network, and layout

No uncaught pageerror was recorded in the stable logged-in Citizen, Officer, and Admin samples. Unauthenticated session checks produced expected HTTP 401 console resource errors. The queue routes did not issue queue API requests, so there was no queue response to classify as an HTTP failure. A dedicated request-failure instrumentation replay timed out while waiting for login response; requestfailed events therefore remain **NOT TESTED**. HTTP statuses that were observed are listed above.

At both requested sizes, measured document scroll width equaled viewport width on all 12 route patterns. Citizen pages retained their styles. Officer/Admin screenshots show missing styling, not clipping.

## Exact release failures and missing functionality

### P0 — End-to-end workflow is blocked

1. Citizen dispute submit created draft UUID 7f7753d4-c3fd-4cae-9431-ceb59d58b9d5, then stayed at SAVING. The browser saw reservation 201 and draft read 200, but no draft save, evidence add, or case submit request.
2. Officer remains at “Loading assigned cases…” without a queue request.
3. Admin remains at “Loading dispatch queue…” without dispatch/officer/rule requests.
4. No Case reached Admin dispatch or an Officer. The requested Citizen → Admin → Officer demo does not work on this deployment.

### P1 — Requirements missing or incomplete

- Passport pages show three fixture findings instead of six independent results.
- Consent withdrawal is a local preview; no server access change or access-denial replay was verified.
- Staff content is visibly unstyled on desktop and mobile.
- Helper and Auditor have no dedicated UI routes. Auditor operations are API-only.
- Current alias does not expose a deployment commit; its match to the latest repository UI changes remains unverified.

## Screenshots and limitations

All captures are under [docs/screenshots/final/](../screenshots/final/). Earlier evidence in docs/screenshots/ and the prior [browser-acceptance.md](browser-acceptance.md) was left intact.

Only synthetic demo accounts and synthetic text were used. No real identity or payment data was entered. The submitted draft may remain in the hosted synthetic environment; the UI did not return a submitted Case ID for confirmation or cleanup.

No application code was changed. This run added this report and captured screenshots in docs/screenshots/final/. Existing workspace edits were preserved. The deployment response identifies the tested edge run but not its source commit.

## Final release replay — 22 November 2026, 18:28–18:46 PKT

The replay used the configured synthetic Citizen A, Admin, and Officer accounts against `https://sanad-ai-eta.vercel.app`, desktop Chromium at 1440×900. It used one synthetic Case, `c9fefbe5-cba0-4d72-bf74-eadd527691c3`.

### Observed journey

- Citizen submission ran through the UI. Draft reservation returned **201**, draft retrieval **200**, save **200**, and case submission **201**. The sequential requests took longer than the earlier 18–20 second browser waits; the UI remained at “SAVING” during that time, then completed. The earlier short timeout did not establish a failed submission.
- Citizen loaded the submitted Case and its history. The first Passport read returned **404 NOT_FOUND**; requesting a real assessment returned **201**, and the follow-up Passport read returned **200** with all six independent findings.
- Citizen’s server consent grant returned **201**. Admin dispatch then returned **200** and displayed the Case; the authorized Officer directory returned **200** with one Officer.
- Admin assignment returned **200** and changed the Case to `SUBMITTED`. The dispatch row and Officer directory were loaded in the UI; the assignment mutation itself was sent with Playwright’s same-origin API request because the browser run did not complete selection in the assignment dialog. No fixture result was used.
- Officer opened the assigned Case in the UI. Case detail, evidence, decisions, history, and program-input reads returned **200**. Starting review returned **200**, creating a current Assessment returned **201**, resolving returned **200**, and closing returned **200**.
- Citizen reopened the same Case in the UI. The Case showed **CLOSED**, history included assignment, review, resolution, and closure, and the Passport showed six findings. The replay exposed that the lifecycle graphic still marked the sample `UNDER_REVIEW` status; the release branch now derives the active step from the loaded Case. The fix was verified in a local production build against the same Case.

### Root, navigation, and checks

- On the release branch’s local production build, unauthenticated `/` routed to `/login`; Citizen, Helper, Officer, and Admin sessions routed to `/citizen`, `/helper`, `/staff/officer`, and `/staff/admin`. Citizen sign-out returned **200** and the next `/` visit returned to Login.
- The hosted deployment still returns a cached **307** from `/` to `/citizen`; it predates this release branch’s root fix and was not changed because merge/deploy approval is reserved to the project owner.
- Production queue requests now returned **200**. Admin showed the submitted Case after consent; Officer showed it after assignment. Earlier loading-state captures were taken before those slower requests had settled.
- Fresh mobile replay, consent revocation/replay denial, and Helper shared-case access were not included. Staff styling remains visibly unstyled in the hosted build.

Screenshots from this replay: [Citizen submission](../screenshots/final/current-citizen-dispute.png), [server consent](../screenshots/final/current-citizen-consent.png), [Officer queue](../screenshots/final/current-officer-queue.png), [Officer assessment](../screenshots/final/current-officer-assessment.png), [closed Case with six findings](../screenshots/final/current-citizen-passport.png), and [Citizen sign-out](../screenshots/final/local-citizen-signout.png).

The updated release-branch code passed `npm run test` (25 tests), targeted Citizen/staff tests (39 tests), typecheck, lint, and `npm run build`. No production merge or deployment was performed.
