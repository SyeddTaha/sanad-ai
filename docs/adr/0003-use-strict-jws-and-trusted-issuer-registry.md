---
status: accepted
---

# Use strict JWS and a trusted issuer registry

Approved in interview question 3 on 21 November 2026. Different serializations and notice-supplied keys could make verification inconsistent or falsely establish issuer trust. SANAD adopts one versioned compact JWS Signed Notice contract with Ed25519 and a server-controlled Trusted Issuer Registry, accepting strict format and registry requirements to give every developer the same verification boundary.

- Require protected headers `alg: "Ed25519"`, `kid`, and a SANAD-specific `typ`. Reject unsupported algorithms, missing required headers, and untrusted key references. Verify the original JWS signing input; never reconstruct JSON before signature verification.
- Resolve public keys exclusively through SANAD's Trusted Issuer Registry and ensure the selected key belongs to the claimed Issuer. Never accept embedded public keys or notice-provided key URLs. Private signing keys remain server-side.
- Require signed payload fields for schema version, Issuer ID, unique notice ID, opaque synthetic recipient reference, program reference, payment reference, amount in integer minor units, currency, and issue/expiry timestamps in UTC seconds. Enforce the exact schema, supported version, valid timestamps, unique notice ID, currency, and integer amounts. Exclude names and identity-document numbers.
- Keep cryptographic validity, expiry, revocation, recipient matching, payment status, and eligibility independent. A valid signature with a missing payment record cannot confirm payment.
- Unknown Issuers or keys, unavailable registry services, and unsupported versions produce `NOT_VERIFIED` or `UNKNOWN`, never a declaration of fraud. An invalid signature is an integrity failure requiring caution, not automatic proof of fraud; unavailable registry status remains unknown.
- Track notice IDs, expiry, and revocation server-side. A copied valid notice cannot authorize payment or case access, and proves only its signed content; surrounding message text remains untrusted.
- AI may extract surrounding message information but cannot invent or reconstruct signed tokens, select trusted keys, or override cryptographic results.

## Implementation prerequisite

Before implementation, verify that the selected JOSE library supports the exact `Ed25519` algorithm identifier. Do not silently substitute `EdDSA`. No JOSE library has been selected or tested in this interview; its compatibility remains unverified.

## Required tests

These are approved requirements for later implementation, not tests already executed.

- The original Signed Notice verifies successfully.
- Modifying the amount, recipient reference, or payment reference invalidates the signature.
- Unknown Issuers, keys, and unsupported algorithms fail safely.
- Expired and revoked notices are identified separately.
- A valid signature with a missing payment record does not confirm payment.
- Malformed or duplicated input cannot bypass verification.
- A simulated registry outage produces uncertainty rather than false verification.

## Format references

[RFC 7515, section 3.1](https://www.rfc-editor.org/rfc/rfc7515.html#section-3.1) defines JWS Compact Serialization and its signing input. [RFC 9864, section 2.2](https://www.rfc-editor.org/rfc/rfc9864.html#section-2.2) specifies the fully specified `Ed25519` JOSE algorithm identifier.
