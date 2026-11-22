# SANAD Judges' Q&A

SANAD is a **synthetic prototype**, not an official government or banking service. Answers distinguish source-backed implementation from future integration.

### What problem are you solving?

People receive public-relief messages they cannot confidently verify, and recipients may need help disputing a missing or mismatched payment record. SANAD separates evidence into verifiable facts, unknowns, and a reviewable Case. It aims to help someone safely ask for human review instead of treating a message or an AI answer as proof. All data in this prototype is synthetic.

### Isn't this already available?

Messaging channels can deliver a notice, and existing government systems may maintain identity, eligibility, and payment records. SANAD's prototype demonstrates a different workflow layer: issuer-signed notice checks, independent findings, explicit sharing consent, evidence versioning, scoped human review, rule version history, and audited Case resolution. We have not integrated an actual public authority, so we do not claim to replace those systems.

### How is SANAD different?

It keeps signature validity, expiry, notice revocation, recipient matching, payment state, and eligibility as separate findings. Missing data remains `UNKNOWN`. Citizens control Case-scoped sharing; Admin assignment does not grant evidence access; Officers must be assigned and have current department consent. Assessments preserve evidence/source/rule versions so a human can review what was known at that point. These behaviors are implemented in the backend. The current Citizen source has live dispute, Case, and consent API calls, but a browser run timed out on dispute submission and did not establish a full journey; notice checking and the results summary remain disconnected/sample-only.

### Where exactly is AI used?

Optional server-side AI classifies synthetic message text, extracts untrusted issuer/amount/reference claims, identifies missing details, and recommends information-only, evidence request, or Officer review. Its output is strictly schema-validated. Timeouts, malformed output, rate limits and unavailable configuration abstain; risky or low-confidence results go to human review. AI does not verify signatures, confirm payments, match identity, decide eligibility, approve money, or resolve Cases. The current configured provider is Groq-compatible (`openai/gpt-oss-120b`), but the latest live evaluation was skipped for missing credentials; do not claim a live AI run unless you perform and record one.

### Why do you need cryptographic signatures?

A compact JWS with Ed25519 lets the verifier detect whether the exact signed notice payload changed after its issuer signed it. The `kid` must resolve in the server-controlled registry, and the issuer/key binding is checked. This helps answer “was this payload signed by a key the configured registry trusts?” It does not answer whether money arrived, the phone holder is the intended recipient, or the issuer is a legitimate government body.

### Can a valid notice still be fraudulent?

Yes. A valid signature means the payload matches a trusted key's signature under this prototype's registry. A real signing key might be compromised, a valid notice can be copied/replayed, or the configured issuer itself may not be a legitimate authority. Signature, expiry, revocation, recipient, payment, and eligibility are separate findings. Our demo issuer is synthetic and cannot establish real-world legitimacy.

### How is consent enforced?

The Citizen grants a named principal, department, or AI processor a specific purpose, actions, and expiry. The server checks the grant on every protected request, serializes relevant work with database locks, and rechecks before returning data or committing. Withdrawal/expiry blocks later access and can set an open Case to `PENDING_CONSENT`. AI processing has separate processor consent. A button or API key cannot override consent.

### How do you prevent unauthorized access?

Supabase Auth verifies the session; roles, profile activation, session status and department memberships come from the database. Every protected route checks role plus owner/assignment, department, purpose, action, consent and key scope where relevant. Protected tables deny direct client database access; private responses are no-store; cookie mutations check origin; API keys are hashed, scoped, short-lived and revocable. These controls have local and development integration evidence. The latest hosted runtime had SQL-backed 503 failures, so hosted protection/availability still needs to be reverified.

### How do the Case and Officer workflows work?

A Citizen reserves and saves a versioned draft, then submits it. The backend creates a Case only from that Citizen-owned reservation. Department review consent is required before department processing. Admin dispatches minimal metadata and assigns an active department Officer. The assigned Officer reviews, requests new evidence or escalates; the Citizen/Helper can append evidence and resubmit. Resolution requires a current Assessment, evidence version, published rule, current assignment and consent, plus a human-authored reason. Closing follows resolution. Resolution records a review outcome; it does not trigger or confirm payment. The backend flow is implemented and tested locally; connected Citizen browser completion is not verified.

### How would you integrate government systems?

**Proposed future capability:** adapter interfaces could connect issuer registries, identity matching, payment ledgers, program enrollment, and notification systems. Each adapter would need an authority-approved contract, authentication, data minimization, source version/timestamp, four outcomes (`FOUND`, `NOT_FOUND`, `AMBIGUOUS`, `UNAVAILABLE`), and a failure path that preserves `UNKNOWN` and human review. SANAD currently has none of the real integrations and lacks the separate mock identity/payment REST adapters required by the brief. We would not imply that a cryptographic signature is a substitute for a payment lookup.

### How would this become a sustainable product?

**Proposal, not implemented:** a deployment for authorized departments could offer case workflow, issuer integration, support, audit/export, training and service-level operations under a government or institutional contract. Pricing, procurement, ownership, hosting jurisdiction, privacy retention, support model and financing have not been validated. Subscription plans, tenant billing and production operations are not implemented.

### What prevents competitors from copying it?

There is no defensible claim that code or the idea cannot be copied. Potential long-term advantages would come from trusted issuer participation, reliable integrations, good human-review operations, accessibility, measured false-positive/false-negative performance, and institutional trust. Those are future execution outcomes, not current assets or validated moats.

### What are the current limitations?

The app is a prototype with synthetic accounts and records. Payment lookup and real identity services are absent; program input is case-scoped synthetic data. The persistent registry has no onboarding/editor workflow and there is no production signing-key management. AI confidence is uncalibrated and live provider behavior is not established by the latest audit. Contradiction checks are listed unavailable. Current Citizen source includes live dispute, Case and consent calls, but browser evidence records a dispute timeout and no complete workflow; notice verification and the result summary remain disconnected/sample-only. Urdu audio/weak-network completion is not verified; public API and browser probes recorded failures. No actual government integration, financial decision, measured loss/accuracy, production security certification, or validated business model is claimed.

## Implemented versus proposed

| Implemented in source | Proposed future work |
|---|---|
| Supabase Auth sessions and five database roles | Government/identity/payment/program integrations |
| Server-side RBAC, explicit purpose/action consent and revocation | Multi-tenant departments with production isolation and administration |
| Versioned Cases, evidence, Assessments, workflow decisions and audit metadata | Production issuer onboarding, key custody/rotation and signing service |
| Ed25519 JWS verifier with separate crypto/expiry/revocation findings | Notifications, external webhooks, billing and service-level operations |
| Optional AI classification/extraction with validated fallback and human routing | Calibrated model quality, measured risk outcomes, richer full trace |
| Synthetic eligibility policy and scoped API keys/OpenAPI | Real production integrations, commercial model and durable competitive advantage |

Evidence pointers: [`SANAD_COMPLETE_GUIDE.md`](SANAD_COMPLETE_GUIDE.md), [`docs/final-release-audit.md`](final-release-audit.md), [`docs/verification/a02-signed-notice.md`](verification/a02-signed-notice.md), [`docs/verification/a03-ai-assessment.md`](verification/a03-ai-assessment.md), [`docs/b02-rbac-consent.md`](b02-rbac-consent.md), [`docs/b03-cases-evidence.md`](b03-cases-evidence.md), [`docs/b04-officer-rules.md`](b04-officer-rules.md), [`docs/b05-public-api.md`](b05-public-api.md).
