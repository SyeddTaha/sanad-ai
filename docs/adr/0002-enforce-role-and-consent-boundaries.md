---
status: accepted
---

# Enforce role and consent boundaries

Approved in interview question 2 on 21 November 2026. A helper serving many Citizens must not gain blanket access, and withdrawing helper access must not silently change an independent department authorization. SANAD therefore centralizes backend authorization, combining role permissions with scoped Consent Grants despite the additional checks this requires throughout the API.

- Every protected API request must pass server-side RBAC and applicable active consent checks; neither is sufficient alone for delegated access. Default to denial, and centralize the authorization logic instead of duplicating permission rules across endpoints.
- Each Consent Grant specifies Case, recipient, purpose, permitted actions, expiry, and revocation status. Helper and department-officer access are independently granted and revoked; a helper cannot authorize its own access.
- Citizens access their own Cases and evidence and control sharing and corrections. Community Helpers may read, upload, and submit only as permitted by their grants, and cannot resolve Cases. Shopkeepers use the citizen-facing verification flow without an additional privileged role.
- Department Officers require both case assignment and valid department-sharing authorization to review and resolve a Case. Withdrawal during review stops further access and moves the Case to a blocked or pending-consent state without deleting its history; the exact state name and transition rules remain open for the interview.
- Admins manage users, roles, rules, and mock services without automatic access to private case evidence. Auditors have read-only access to necessary audit metadata and decision traces; raw evidence requires separate authorization. Neither role can bypass evidence permissions.
- AI processing requires explicit consent covering its disclosed purpose and cannot bypass role or consent checks.
- Retain minimal immutable audit metadata for accountability: actor, action, timestamp, authorization reference, and revocation event. Audit logs must not contain raw evidence, sensitive AI prompts, or unnecessary personal data; decision traces exposed to Auditors must respect these evidence permissions.
- Withdrawal immediately blocks subsequent server requests and actions covered by that grant. Previously viewed or downloaded information cannot be retroactively recalled.

## Required security tests

These are approved requirements for later implementation, not tests already executed.

- Helper A cannot access Citizen B's Case without authorization.
- Revoking helper consent causes subsequent API requests to fail.
- Revoking helper consent does not revoke independent officer consent.
- Officers cannot access unassigned or unauthorized Cases.
- Admins and Auditors cannot bypass evidence permissions.
- All restrictions hold through direct API calls, independently of UI controls.
