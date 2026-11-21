# B04: Officer workflow, published rules and Case Resolution

Branch `feat/officer-rules`; baseline `6498e71` (PR #8 verified merged, clean
working tree, main fast-forwarded before branch creation). Backend lead owns
this work. The official Markdown brief, SPEC, glossary and six ADRs govern it.
Frozen `src/contracts/v1` exports remain unchanged; endpoint compositions live
in `src/lib/officer-contract.ts` and `src/lib/rule-contract.ts`.

## Synthetic policy approval

On 21 November 2026 the requesting human backend owner explicitly approved
**SANAD Synthetic Relief Demo**, program `program_demo`, with these parameters:

| Parameter | Approved initial value | Meaning |
| --- | --- | --- |
| `maxMonthlyIncomeMinor` | `800000` (PKR 8,000) | Income ceiling for the fictitious program. |
| `minRoutingConfidence` | `0.8` | Advisory routing threshold; no claim of calibrated probability. |
| `integrityFailurePriority` | `HIGH` | Priority for a deterministic integrity failure when that adapter is integrated. |

These are synthetic demo assumptions. They are not government rules, real
eligibility policy, financial authorization or calibrated safety thresholds.
An Admin can publish another validated parameter set without redeployment.
Security checks and mandatory human resolution cannot be edited as parameters.
`contentDigest` is lowercase SHA-256 of the UTF-8 `JSON.stringify` encoding of
`{programRef,policyLabel,parameters}`, in that order; parameter keys use the
frozen schema order shown in the table above. Author, time, ID and version are
separate immutable publication metadata.

The bounded eligibility rule requires an unambiguous scoped synthetic recipient,
known enrollment and known monthly income. Missing/ambiguous inputs yield
`UNKNOWN`; known income above the ceiling or inactive enrollment yields
`INELIGIBLE`; active enrollment and income at/below the ceiling yields
`ELIGIBLE`. Eligibility findings never authorize payment.

`synthetic_program_inputs` is an append-only, **case-scoped demo source**, not
uploaded Citizen evidence or a real service integration. Trusted setup scripts
may append typed synthetic inputs attributed to an active Admin. There is no
HTTP write endpoint. Each source revision takes the reservation lock and
advances Case/evidence versions, preserving all previous source records.
No input means unknown; input text and AI cannot supply authoritative fields.
The general identity/payment/program mock APIs remain outside this change.

## HTTP handoff for Aayan

All paths below are relative to `/api/v1`. Reuse B01 login/session/logout and
B02 consent APIs. Use the verified HttpOnly session cookie or human Bearer JWT.
Every mutation requires JSON and `Idempotency-Key: [A-Za-z0-9_-]{1,128}`; cookie
mutations also require same-origin `Origin`. Keep one key for retries of one
logical action. Responses use `{data,requestId}` or the frozen error envelope,
`Cache-Control: private, no-store`, and `Vary: Cookie, Authorization`.

| Method/path | Strict request | Response `data` / authority |
| --- | --- | --- |
| `GET /cases` | Optional `cursor`, `limit`, `status`, `sort` | `{items:OfficerQueueItem[],nextCursor}`; OFFICER, assignment, department membership and active `READ_CASE` + `READ_EVIDENCE` under the same department grant. |
| `GET /admin/dispatch` | Same pagination/status; sort `priority` or `oldest` | `{items:DispatchItem[],nextCursor}`; ADMIN with department membership and active `ASSIGN_CASE` grant. |
| `POST /cases/{id}/assign` | `{expectedVersion,departmentId,officerId,reason}` | `DispatchItem`; ADMIN, matching department sharing with `ASSIGN_CASE`; target active OFFICER must belong to that department. Used for initial assignment and reassignment. |
| `POST /cases/{id}/priority` | `{expectedVersion,departmentId,priority,reason}` | `DispatchItem`; ADMIN, same dispatch authority; assigned department must match. `priority` is `NORMAL` or `HIGH`. |
| `POST /cases/{id}/start-review` | `{expectedVersion}` | `{case:Case}`; assigned authorized OFFICER, `REVIEW_CASE`, `SUBMITTED` to `UNDER_REVIEW`. |
| `POST /cases/{id}/request-evidence` | `{expectedVersion,reason}` | `{case:Case}`; assigned authorized OFFICER, `REVIEW_CASE`, `UNDER_REVIEW` to `NEEDS_EVIDENCE`. |
| `POST /cases/{id}/resubmit` | `{expectedVersion}` | `{case:Case}`; owner CITIZEN or scoped HELPER with `SUBMIT_CASE`; additional evidence since the request and active department sharing; `NEEDS_EVIDENCE` to `SUBMITTED`. |
| `POST /cases/{id}/escalate` | `{expectedVersion,reason}` | `{case:Case}`; assigned authorized OFFICER with `ESCALATE_CASE`. Raises priority to `HIGH`; preserves assignment and open status. Admin uses `/assign` for reassignment. |
| `POST /cases/{id}/resolve` | Frozen `ResolveCaseRequest`: `{expectedVersion,reviewedAssessmentId,reason}` | `{case:Case,assessmentId,resolutionId}`; assigned authorized OFFICER with `RESOLVE_CASE`, `READ_EVIDENCE`, `REQUEST_ASSESSMENT`, active department review sharing, fresh assessment and atomic checks. |
| `POST /cases/{id}/close` | `{expectedVersion}` | `{case:Case}`; assigned authorized OFFICER with `CLOSE_CASE`, `RESOLVED` to `CLOSED`. |
| `GET /cases/{id}/evidence` | Optional `cursor`, `limit` | `{items:EvidenceItem[],nextCursor}`; `READ_EVIDENCE`; includes immutable prior inputs. Existing POST is unchanged. |
| `GET /cases/{id}/decisions` | Optional `cursor`, `limit` | `{items:CaseDecision[],nextCursor}`; `READ_EVIDENCE`; includes protected officer explanations and old/new assignment references. |
| `GET /cases/{id}/program-inputs` | Optional `cursor`, `limit` | `{items:SyntheticProgramInput[],nextCursor}`; `READ_EVIDENCE`; sources explicitly labeled `SYNTHETIC_DEMO`. |
| `GET /audit` | Required `caseId`; optional `cursor`, `limit` | `{items:AuditMetadata[],nextCursor}`; AUDITOR only; retained opaque audit metadata, no reasons, input, findings or raw evidence. |
| `GET /rules/current` | Optional `programRef=program_demo` | `{programRef,policyLabel,rule:RuleVersion}`; ADMIN or OFFICER. 404 until first publication. |
| `GET /rules/{ruleId}` | UUID | Same shape; ADMIN or OFFICER; historical version, 404 for the B03 unavailable basis. |
| `POST /rules/publish` | `{programRef:"program_demo",expectedCurrentVersion,parameters}` | 201 `{programRef,policyLabel,rule:RuleVersion}`; ADMIN; expected version is explicit `null` for the first publication, otherwise a positive integer. |

Collections default to 20, maximum 100; cursors are UUIDs. Officer sort options:
`priority` (default: HIGH first, unknown/low confidence first, oldest then ID),
`confidence` (unknown first, then increasing confidence/priority/age/ID), and
`oldest`. Unknown confidence is returned as **null**, never a fabricated score.
Queue rows may move when priority or assessments change; refresh after mutations.
Choose a status from the existing six states. Invalid sort/filter/limit is 422.

`DispatchItem` contains exactly `caseId,departmentId,assignedOfficerId,status,
priority,version,createdAt,updatedAt`; it has no Citizen ID, evidence, reason,
finding or confidence. `departmentId` identifies the department grant permitting
dispatch. `OfficerQueueItem` adds nullable `confidence`. Follow the existing
protected detail/Passport/history/Assessment trace APIs after assignment.
Source/decision/audit field shapes and response schemas are exported from
`@/lib/officer-contract`; rule compositions from `@/lib/rule-contract`.

Reasons must contain meaningful text, maximum 2,000 characters. Actor, author,
timestamps, findings, source versions, resolution IDs and status come from the
server. Admin and Auditor roles confer no automatic private evidence permission.
An Auditor needs B02's independent named audit grant to read private inputs or
decision explanations. That grant grants no officer mutations.

## Resolution and concurrency

All case operations reuse B01/B02's verified identity, transaction helper,
central policy evaluator, reservation locks, consent reconciliation and minimal
audit. Queue authorization uses a bounded batch of the same server inputs and
sorts reservation locks by ID. No external provider runs under database locks.

Resolution takes the reservation and Case row locks, checks expected Case
version, assignment/department/role, applicable consent and `UNDER_REVIEW`, and
holds a shared lock on the singleton current-rule pointer. Publication exclusively
locks that pointer through commit. Publication-first rejects an older reviewed
rule; resolution-first preserves a correct historical reference.

The reviewed immutable Assessment must match the current evidence and published
rule. Resolution creates a **new deterministic final Assessment**, compares
its evidence/source manifest and findings with the reviewed basis, and refuses
changed findings. Observation timestamps may advance; source identities/versions
and facts must agree. It records the reason, reviewer, reviewed/final Assessment,
published rule, evidence/Case versions and old/new state in an immutable decision.
The Assessment, decision, state, event, replay reference and minimal audit commit
together. Current consent is checked again before commit, including for owner
resubmission. Retries reauthorize before replay and return original outcomes.

`UNAVAILABLE` is never a published rule and cannot support resolution. A fresh
human disposition may record an unresolved/unknown factual situation with a clear
reason. It does not make the payment settled, approve eligibility or change any
finding. Signature and payment remain independent, and AI is advisory only.

## Example requests

Publish the owner-approved initial demo policy as Admin (substitute the current
version if already published):

```http
POST /api/v1/rules/publish
Content-Type: application/json
Idempotency-Key: b04-demo-policy-v1

{"programRef":"program_demo","expectedCurrentVersion":null,"parameters":{"maxMonthlyIncomeMinor":800000,"minRoutingConfidence":0.8,"integrityFailurePriority":"HIGH"}}
```

After Citizen submission and department sharing, dispatch without opening evidence:

```json
{"expectedVersion":2,"departmentId":"<department UUID>","officerId":"<officer UUID>","reason":"Synthetic department dispatch"}
```

As the assigned Officer, start review using the returned version, inspect
`/evidence`, `/program-inputs`, `/evidence-passport` and `/history`, then request
`POST /cases/{id}/assessments` with the current `evidenceVersion`:

```json
{"expectedEvidenceVersion":2,"includeAi":false}
```

Resolve using the Case version from review and the Assessment actually inspected:

```json
{"expectedVersion":4,"reviewedAssessmentId":"<assessment UUID>","reason":"Reviewed synthetic dispute; missing payment records remain unknown. This Case disposition authorizes no payment."}
```

Successful response data has `case.status:"RESOLVED"`, a new `assessmentId`,
and a `resolutionId`. Inspect `/decisions` for the immutable explanation; close
using `POST /cases/{id}/close` with `expectedVersion:data.case.version`.
Use actual returned revisions; the example numbers are illustrative.

For the optional rule-change demonstration, the live test seeds a case-specific
mock source through a trusted development PostgreSQL connection:

```sql
insert into public.synthetic_program_inputs
  (case_id,version,recipient_match,enrollment,monthly_income_minor,recorded_by)
values ('<synthetic case UUID>',1,'MATCH','ACTIVE',750000,'<active demo admin UUID>');
```

This advances both versions. Under the approved 800000 ceiling, a fresh
Assessment is `ELIGIBLE`; publishing a 700000 synthetic ceiling changes a new
Assessment to `INELIGIBLE`, retaining the first Assessment and Rule Version.
The live test restores the approved 800000 parameters afterwards. No API client
can insert these source inputs or promote Citizen text to authoritative records.

## Setup, errors and gate

Use the existing ignored B01 environment, trusted DB CA and synthetic account
passwords. No new secrets or dependencies. `db:seed` additionally gives the demo
Admin department membership for dispatch; it still grants no evidence access.
Publish the initial rule with the request above, or run the live test, which
publishes it through actual authenticated HTTP before its synthetic scenarios.

```sh
npm run db:migrate
npm run db:seed
npm run test:contracts
npm run test:backend
npm run typecheck
npm run lint
npm run build
npm run start -- --port 3400
# Separate terminal, same development environment:
npm run test:b04:live
```

Optional `B04_BASE_URL` overrides localhost:3400. Run live suites sequentially:
they share demo roles and current synthetic policy. B04 retains immutable demo
history, publishes new versions, installs narrowly scoped temporary lock/failure
triggers removed in `finally`, and logs out its sessions. Use development only.
`B04_LIVE_SCENARIO` is an optional substring selector for diagnosing one live
scenario with real setup; selected runs report other scenarios as skipped.
Leave it unset for the verification gate.

Errors reuse the frozen catalog: 401 authentication; 403 role, assignment,
department or consent denial; 404 authorized absent record; 409 `STALE_VERSION`,
`STALE_ASSESSMENT`, `INVALID_TRANSITION` or `IDEMPOTENCY_CONFLICT`; 422 schema/
filter validation; 400/413/415 malformed/oversized/non-JSON transport; sanitized
503 DB/provider/audit failure. Evidence and rule changes require reassessment;
never silently retry a decision against unseen inputs. B02 withdrawal preserves
terminal history and interrupts open review to `PENDING_CONSENT`.

Additive migrations: `20261121000800_published_rules.sql` (immutable publication,
current pointer, known Assessment basis); `20261121000900_officer_decisions.sql`
(private immutable decisions/provenance); `20261121001000_synthetic_program_inputs.sql`
(private versioned demo sources and evidence invalidation). All new tables deny
direct anon/authenticated/service-role access and enable RLS.

Actual results and observed resolution IDs are in [B04 verification](b04-verification.md).
Crypto/source adapter integration, AI implementation, full mock REST APIs,
API keys/OpenAPI (B05), frontend/browser/audio work and public deployment
acceptance remain separate tasks. This work stops at the B04 verification gate.
