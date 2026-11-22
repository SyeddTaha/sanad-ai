# SANAD Operating Guide

This guide describes routes and actions found in the current source. The ~16:30 PKT browser report does not identify an immutable application commit: it recorded a Citizen dispute timeout and staff pages that remained loading. The earlier 11:58 PKT public API smoke recorded SQL-backed 503s. Treat current hosted end-to-end behavior as **NOT VERIFIED**. SANAD is a synthetic prototype, not an official service.

## Before operating

- Use a development deployment and synthetic data only. Do not use real identity or payment data.
- The login page takes an email and password. Six synthetic email identifiers are in [`scripts/demo-accounts.ts`](../scripts/demo-accounts.ts); passwords come from the operator's private environment. This guide does not publish or guess passwords.
- A valid human login is not enough to prove the SQL-backed Case or queue routes work. If running the hosted site, the latest smoke recorded API-key validation and both staff queues returning 503.
- No exact click sequence is asserted from screenshots. Pages and visible controls below come from source; live click behavior is **NOT VERIFIED** unless the browser evidence says otherwise.

## CITIZEN

**Implemented page routes:** `/login`, `/citizen`, `/citizen/verify`, `/citizen/results`, `/citizen/dispute`, `/citizen/case`, `/citizen/consent`. The root `/` is intended to redirect to `/citizen`; deployment verification was inconsistent in the audit and must be retested.

**Login:** Use `/login` with a configured synthetic CITIZEN account. Login calls `POST /api/v1/auth/login`; `Check session` calls `GET /api/v1/session`; `Sign out` calls `POST /api/v1/auth/logout`.

**Backend-supported actions:** reserve a draft, save/read draft, submit a Case, read own Case/history, add evidence/correction, request Assessment, read Passport/trace, list/grant/revoke consent. Endpoints: `/api/v1/case-drafts`, `/api/v1/case-drafts/{caseId}`, `/api/v1/cases`, `/api/v1/cases/{caseId}`, and nested `/evidence`, `/assessments`, `/evidence-passport`, `/history`, `/consents`; revoke at `/api/v1/consents/{grantId}/revoke`.

**Current UI controls:** `/citizen/dispute` creates/resumes a draft, saves reason/evidence and submits; `/citizen/case` accepts a Case ID and loads Case/history/Passport; `/citizen/consent` loads, grants and revokes live grants. `/citizen/verify` is only a local text form that reports disconnected and sends no notice. `/citizen/results` and home summary are fixture-backed, showing only three unknown sample findings, not a live six-finding Passport.

**Expected server results:** server derives the owner; drafts and evidence are revisioned; submission creates a `PENDING_CONSENT` or `SUBMITTED` Case depending on department sharing; revocation stops later access; stale revisions and missing consent are rejected. Assessment values may be unknown and payment is not confirmed.

**Role handoff:** Citizen can grant a Helper principal limited `synthetic_helper_assistance` access, grant the synthetic department `synthetic_department_review`, and separately authorize the AI processor. Officer workflow requires department consent and assignment. Citizen may later revoke grants.

**UI limitation / verification:** Live dispute, Case and consent controls are present in current source, alongside fixture previews. The existing browser acceptance report (about 16:30 PKT) recorded a dispute timeout without a Case ID; it did not capture a successful live grant/revoke and does not identify an immutable application commit. Therefore current-source operations are **NOT VERIFIED** end to end. Urdu narration/audio behavior and weak-network completion are also **NOT VERIFIED**.

## HELPER

**Implemented pages:** No dedicated Helper route/page is present. A Helper may sign in at `/login`, but `/staff` only routes ADMIN to `/staff/admin` and OFFICER to `/staff/officer`; HELPER is sent back to `/login` from that staff redirect. Citizen pages render but are not a verified Helper workspace.

**Supported actions:** through authorized API only, a Helper can read/save a specifically shared draft, add evidence, submit/resubmit a Case, request/read Assessments and evidence when permitted. The permission must be a Citizen-issued named principal grant with matching purpose, actions and nonexpired status. A Helper cannot self-select or enumerate families. API-key capabilities have a role ceiling but still require each named grant.

**Expected results / handoff:** A submitted Case becomes visible to department dispatch only after the Citizen has granted department review; Admin assigns it; assigned Officer can review it. Helper access ends on revocation or expiry.

**UI limitation:** No integrated Helper UI or 40-family switching flow is implemented/verified. Do not demonstrate a Helper task as a supported click journey.

## OFFICER

**Implemented pages:** `/staff` redirect and `/staff/officer`; Case detail route `/staff/officer/cases/{caseId}`. The source page exposes an assigned Case queue, status filter, priority/confidence/oldest sort, and pagination. Case detail implementation is available in source; an end-to-end live browser flow is **NOT VERIFIED**.

**Login:** Use configured synthetic OFFICER credentials at `/login`. `/staff` routes an Officer to `/staff/officer` after its session check. Do not publish or guess a password.

**Supported server actions:** list assigned Cases; read authorized Case/evidence/decisions/history/Passport/Assessment; start review; request evidence; escalate priority with reason; resolve using a current reviewed Assessment and human reason; close a resolved Case; resubmit workflow is Citizen/Helper action. API routes include `/api/v1/cases` queue and `/api/v1/cases/{caseId}/{start-review,request-evidence,escalate,resolve,close}`.

**Important checks:** current assignment and department, department membership, grant actions/expiry/revocation, expected Case/evidence versions, valid status transition, current published rule, and fresh deterministic Assessment basis. Resolution does not authorize payment. Unknown sources remain unknown.

**Expected role handoff:** Officer requests evidence → Citizen/Helper adds evidence and resubmits → assigned Officer reviews again. Resolution writes a Decision and Case event; closing changes status to `CLOSED`.

**UI limitation:** Latest public Officer queue probe failed with HTTP 503. The local production smoke and development integration suite passed, but public queue operation and a complete browser review journey are **NOT VERIFIED**.

## ADMIN

**Implemented pages:** `/staff` redirect and `/staff/admin`. Source shows Admin dispatch table, assignment dialog and synthetic policy editor. The page loads dispatch, current rule, and officer directory via the staff API.

**Login:** Use configured synthetic ADMIN credentials at `/login`. `/staff` routes Admin to `/staff/admin` after session check.

**Supported actions:** view minimal department dispatch metadata; assign/reassign a Case to active department Officer with reason and expected Case version; change priority through API; read/publish the synthetic `program_demo` policy. Routes: `/api/v1/admin/dispatch`, `/api/v1/admin/officers`, `/api/v1/cases/{caseId}/assign`, `/priority`, `/api/v1/rules/current`, `/rules/{ruleId}`, `/rules/publish`.

**Permission limits:** Admin dispatch/assignment does not provide evidence access. Admin cannot read private evidence just by being Admin. Department membership and Citizen department-sharing consent remain necessary; assignment cannot override them. Only Admin publishes the bounded synthetic rule.

**Expected handoff:** assigning a Case makes it eligible for the selected Officer only if matching current department sharing exists. If Citizen consent is absent, workflow remains `PENDING_CONSENT` until sharing is granted.

**UI limitation / verification:** The latest public Admin dispatch probe returned 503. The source page exists, but public route availability and an assignment/publication browser run are **NOT VERIFIED**. Program input editor and trusted issuer-registry editor are not provided.

## AUDITOR

**Implemented pages:** No dedicated Auditor page. `/login` is available; `/staff` does not route Auditor to a dashboard. Audit access is through API.

**Login:** Use configured synthetic AUDITOR credentials with `/login`. API requires a verified human session; an API key cannot read the audit metadata endpoint.

**Supported actions:** `GET /api/v1/audit?caseId={uuid}` lists paginated audit metadata for that Case. To read Case evidence/Passport/Assessment trace, Auditor needs an explicit Citizen `synthetic_audit_review` grant with the needed actions. Audit metadata does not contain raw evidence, provider prompts, or API-key plaintext.

**Expected results:** metadata includes actor, action, outcome, request ID, opaque target and authorization reference. Access to a Case trace is separately authorized and appears in audit trail.

**UI limitation:** No Auditor dashboard or verified browser route. API operation has source implementation; hosted/runtime behavior is **NOT VERIFIED** by a role-specific public test.

## SERVICE/API-key operator

There is no service account role. A human HELPER/OFFICER/ADMIN/AUDITOR may issue a short-lived scoped API key subject to their role ceiling at `/api/v1/api-keys`; the key acts as a `SERVICE` principal bound to the issuer and does not impersonate a Citizen. The secret is shown only in the issuance response. Store it in an approved client secret store; never paste it into screenshots, tickets, URLs, shell history, or this guide. List own metadata with GET; revoke own key with POST. Human consent, assignment and scope checks still apply.

## Verification status summary

| Workflow | Source support | Browser/hosted status |
|---|---|---|
| Login/session for all five roles | Implemented | Local production HTTP login/session probes PASS. Public login earlier passed, but current public deployment was not reverified for every role after latest changes. |
| Citizen dispute draft/submit; Case/history/Passport; live consent | Backend and current UI calls implemented | Dispute timed out in browser; current hosted end-to-end **NOT VERIFIED**. |
| Citizen notice verification / six live findings | Notice page disconnected; Passport page fixture-backed | Browser report found no notice API call and only three sample finding rows. |
| Helper family workspace | No dedicated page | **NOT VERIFIED / no workspace**. |
| Officer queue/review | Backend and page implemented | Public queue 503; complete public browser flow **NOT VERIFIED**. |
| Admin dispatch/rule publication | Backend and page implemented | Public dispatch 503; complete public browser flow **NOT VERIFIED**. |
| Auditor dashboard | API only | No dashboard; API browser operation **NOT VERIFIED**. |
| Urdu/audio/weak connectivity | Audio and session helpers exist | Completion acceptance **NOT VERIFIED**. |

For exact backend and authorization behavior see [`SANAD_COMPLETE_GUIDE.md`](SANAD_COMPLETE_GUIDE.md), [`src/backend/openapi/operations.ts`](../src/backend/openapi/operations.ts), and [`docs/final-release-audit.md`](final-release-audit.md).
