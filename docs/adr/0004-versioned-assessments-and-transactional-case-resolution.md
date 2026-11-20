---
status: accepted
---

# Versioned assessments and transactional case resolution

Approved in interview question 4 on 21 November 2026. Evidence, consent, or rules can change while a Department Officer has a Case open, making an earlier Assessment unsafe to use for resolution. SANAD therefore uses explicit server-side state transitions and PostgreSQL transactional version checks, accepting reassessment when necessary instead of introducing a complex workflow engine.

## Case lifecycle

| From | To | Required actor and condition |
| --- | --- | --- |
| New Case | `SUBMITTED` | Citizen or authorized Community Helper submits with active department-sharing consent. |
| New Case | `PENDING_CONSENT` | Submission lacks active department-sharing consent. |
| `SUBMITTED` | `UNDER_REVIEW` | Assigned, authorized Department Officer starts review with active department-sharing consent. |
| `UNDER_REVIEW` | `NEEDS_EVIDENCE` | Authorized Department Officer requests additional evidence. |
| `NEEDS_EVIDENCE` | `SUBMITTED` | Citizen or authorized Community Helper resubmits evidence with active department-sharing consent. |
| `UNDER_REVIEW` | `RESOLVED` | Authorized Department Officer provides a reason and passes the atomic resolution checks below. |
| `RESOLVED` | `CLOSED` | Authorized Department Officer finishes the workflow. |
| Open Case | `PENDING_CONSENT` | Missing, expired, or revoked department consent interrupts departmental review; history remains intact. |
| `PENDING_CONSENT` | `SUBMITTED` | Department-sharing consent is restored; fresh review is required. |

All transitions are validated on the server; invalid or unauthorized transitions are rejected, including through direct API calls. Missing, expired, or revoked department consent prevents officer access and resolution, while withdrawing helper consent does not interrupt independently authorized officer review. `RESOLVED` means the Department Officer resolved the Case, not that payment was completed or eligibility approved; further disputes after `CLOSED` become linked Cases. Assignment and escalation are separately audited actions rather than additional case statuses.

## Rules and assessment history

- Admins publish validated, structured eligibility and routing parameters without redeployment. Published Rule Versions are immutable, apply immediately to new Assessments, and do not replace the versions attached to historical Assessments.
- Each Assessment preserves its findings, evidence references and source versions, timestamps, Rule Version, and applicable model and prompt versions. New evidence or a newly published Rule Version makes an earlier Assessment insufficient for resolution; reassessment appends a new Assessment without overwriting history.
- Before resolution, reassess current evidence under the currently published rules. Another AI call is unnecessary when deterministic checks suffice. AI may recommend routing but cannot independently resolve, approve, or reject Cases.

## Atomic resolution

In one PostgreSQL transaction, verify the Department Officer's role, assignment and authorization, applicable active consent, current Rule Version, Assessment freshness against current evidence, valid case status, and a required resolution reason before saving the resolution. Reject the operation if any condition changed; concurrent rule publication must not allow a stale-rule resolution. Use transactional version checks and explicit transition validation rather than a complex workflow engine.

Record assignments, escalations, consent interruptions, reassessments, resolutions, and closure as separate auditable events, respecting [ADR 0002](./0002-enforce-role-and-consent-boundaries.md)'s restrictions on sensitive audit content.

## Required tests

These are acceptance requirements for later implementation, not claims of completed implementation or executed tests.

- Valid transitions succeed and invalid transitions fail.
- Unauthorized users cannot change case status, including through direct API calls.
- Revoked department consent blocks officer resolution.
- Revoking helper consent does not interrupt independently authorized officer review.
- Rule Version changes force reassessment before resolution.
- Concurrent rule publication cannot produce a resolution using stale rules.
- Historical Assessments remain unchanged after a new Rule Version is published.
- New evidence invalidates the previous Assessment for resolution.
- Department Officer resolution without a reason is rejected.
