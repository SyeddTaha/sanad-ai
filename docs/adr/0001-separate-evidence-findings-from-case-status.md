---
status: accepted
---

# Separate evidence findings from case status

Approved in interview question 1 on 21 November 2026. A valid notice signature can coexist with a pending or unknown payment, so SANAD records independent evidence findings in an Evidence Passport and manages the associated Case separately, accepting a more detailed shared contract to prevent misleading claims of safety or payment completion.

- Represent signature validity, notice expiry/revocation, recipient matching, payment status, and eligibility separately. Authenticity alone establishes neither payment completion nor eligibility.
- Missing evidence is not negative evidence: unknown payment status does not mean payment failed, and missing eligibility records do not mean ineligible.
- A Case can be `SUBMITTED`, `UNDER_REVIEW`, `NEEDS_EVIDENCE`, `RESOLVED`, or `CLOSED` without changing its evidence findings. The permitted transitions and the distinction between resolution and closure were subsequently agreed in [ADR 0004](./0004-versioned-assessments-and-transactional-case-resolution.md).
- Evidence updates preserve previous findings, sources, timestamps, and applicable rule versions. Closing a Case must not rewrite historical evidence.
- AI may explain findings and recommend routing, but cannot change authoritative evidence or approve payments.
- The UI must never present a single overall "Verified" badge that implies notice authenticity, payment completion, and eligibility simultaneously.
