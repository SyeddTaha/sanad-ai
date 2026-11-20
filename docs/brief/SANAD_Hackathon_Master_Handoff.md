# SANAD — Master Handoff for Coder's Cup 2026

**Purpose:** Transfer the entire product idea, requirements, reasoning, risks, and next implementation instructions to a fresh ChatGPT/Codex conversation. This is a **planning and context document**, NOT a claim that any application has been implemented or deployed.

**Working name:** **SANAD (سند)** — Urdu for documentary proof / supporting evidence. **Name is provisional**, and availability of domain, trademark, and social handles has not been verified. Previous working names: AmanVerify → AmanVerify 2.0 → AmanProof → AmanProof TrustDesk. **TrustDesk** describes the organizational workflow; **TrustReceipt** and **Evidence Passport** are feature names.

**Recommended product description:** *SANAD is an evidence-first, AI-assisted verification and dispute-resolution platform for simulated public-relief payments. It enables people to check whether participating issuers created a notice, understand contradictory information, collect evidence for payment disputes, and obtain human review without trusting an AI model blindly.*

**Tagline options:** “Har daaway ka saboot” / “Trust, backed by evidence.”

**Current status at handoff:** Concept and critique developed in conversation. No code, repository, UI, API integration, deployment, actual AI result, security test, or customer validation has been demonstrated to this conversation. **Do not claim any implementation already exists.** Team size/skills, available credits, repo status, and services have NOT been confirmed for this specific hackathon. Ask only for the missing high-value facts, and do not re-ask what is stated below.

---

## 1. Competition: authoritative brief

**Organizer:** Coder's Cup 2026, ACM FAST-NUCES Karachi.

**Challenge:** “The Last Mile: AI on Public Rails,” a digital public infrastructure (DPI) AI hackathon.

- **Build window:** Friday **20 November 2026, 6:00 PM PKT** to Sunday **22 November 2026, 6:00 PM PKT** (48 hours).
- **Final evaluation:** Monday **23 November 2026**, FAST-NUCES Karachi Library; exact time to be announced.
- **Team:** 3–4 participants.
- **Development:** During event ONLY. Tools and AI coding/models permitted; prebuilt competition projects and plagiarism prohibited.
- **Data:** ALL identities, payment records and data-exchange services **must be mocked**, no real personal data; real data will disqualify.
- **Branding:** Must be clearly labeled a **prototype, not an official service**. Distinguish truly working AI and cryptography from simulated identity/payment data.
- **Judging focus:** What actually works under surprises and faults; server-enforced permissions, security, reliability, responsible AI, safe uncertainty/human intervention, technical judgment, live functionality rather than claims. Official brief gives no numerical judging weights.
- **Submission:** Functioning AI-powered prototype and mandatory live demo; GitHub repository; README; public Google Drive demo video; slides optional. Verify accessible deployed URL as part of engineering basics.

**The three people in the organizer's brief:**
1. A widow cannot read complicated forms and has unreliable connectivity.
2. A shopkeeper receives fake “relief payment” messages.
3. A community helper assists 40 families from one shared phone.

They have incomplete/different-spelling records; wrong approvals can cost money. Build **one multi-user SaaS platform** that serves all three, with users, roles, cases, rules and audit trails. It must **decide, explain, protect, and say “I am not sure”**. “Deep solution to one task beats a thin solution to many.”

**Official completion statement adapted to SANAD:**
> We help relief-benefit recipients and community helpers verify a relief-payment notice and submit a reviewable dispute even when messages may be fraudulent, records conflict, literacy is limited and internet access is unreliable.

### ALL mandatory core platform features (do not omit any)

1. Secure JWT/OAuth login and **server-side RBAC**.
2. Dashboard with case progress, status and history.
3. Case creation, assignment, escalation and closure.
4. **Public REST API** with API keys and OpenAPI/Swagger documentation.
5. Audit logs of **user, AI and agent/automated actions**.
6. Consent management: view who accesses data, share, withdraw, correct data; revocation must stop authorization, not merely hide a UI button.
7. **Mock identity, payment and data-exchange services**, cleanly separated behind documented APIs.
8. Engineering: Postgres/Supabase DB with migrations; deployed link; monitoring/logs/basic tests.

### Choose at least 3 additional platform features

**Committed recommendation:**
- Admin rule editor (change eligibility/verification rules without changing code/redeploying).
- Officer review queue with priority and confidence sorting.
- Low-bandwidth/offline draft and retry/sync behavior.

Other choices in official brief: multi-tenant spaces, notifications, webhooks, per-tenant analytics, subscriptions, background jobs, rate-limiting/error handling. Rate limiting and error handling are good security practice even if not counted as one of the three.

### Choose at least 3 AI features

**Committed core recommendations (at least four):**
- Structured outputs: AI extracts key fields (issuer, reference ID, claimed amount, sender, account type, message content, missing fields) to validated JSON.
- Classification/routing: suspicious message vs dispute vs clarification, with a transparent score or decision criteria and route.
- Guardrails + human approval: require evidence and officer review for risky/uncertain decisions; no AI-generated financial approval.
- Explainability: simple Urdu/English reason for citizen and rich rule/model/source trace for auditor.

**Conditional if tested:** voice/STT/TTS in Urdu and/or OCR/QR/document check, source-grounded RAG from versioned mock program rules. Do not falsely claim an AI feature is operational merely because its UI exists. The brief also lists autonomous tool calling, anomaly detection, memory/context, evaluation dashboard.

### Eight technical challenges, with pass criteria

1. **Cost of being wrong:** Define relative loss costs for false-verified/false-denied/manual review, and choose a conservative action policy. Show actual small-fixture error counts, not invented accuracy.
2. **“I am not sure”:** Missing/contradictory evidence or low confidence yields an explicit abstain + review case and notes, not a guessed result.
3. **Bad data:** Missing fields, duplicate people, Muhammad/Mohammad/Muhammed-style ambiguity; do not auto-merge on string similarity.
4. **Rules change:** Admin publishes a rule version, applied to NEW decisions immediately; old decisions preserve version, input and trace. Include at least one actual *eligibility* rule for the synthetic relief program to fully address the brief.
5. **Explain + audit:** Simple user reason and full auditor record including evidence/source IDs, inputs, timestamp, rule/prompt/model version, confidence, outcome, reviewer.
6. **Consent/take-back:** Helper access scope and expiry; revocation causes subsequent API requests to fail; audit revocation. Explain practical limit: cannot recall already viewed/offline copied data.
7. **Works for everyone:** An icon-heavy, high-contrast, Urdu-assisted, low-bandwidth guided workflow; one short end-to-end task; save draft and safe resumable sync.
8. **Scams + fake documents:** Evaluate fake relief messages, modified *synthetic signed notices*, mismatch patterns, fuzzy/damaged document extraction; show false alarms; never imply generic photo-forgery detection is solved.

### Optional bonus features

- Digital Twin: preview rule changes on synthetic historical cases (best if rule engine already works).
- Helper Mode: fast, permission-safe shared-device switches among families with separated consent (especially natural to this product).
- Offline-First Sync: full robust offline pending changes with no loss/duplicates (harder than basic draft).
- Scam Map: grouped scam patterns, only if core robust.

**Do not overbuild bonuses.** One demonstrable bonus beats four decorative ones.

---

## 2. How the idea evolved and why

**AmanVerify (first):** AI checker classifies suspicious BISP/relief messages. **Rejected as insufficiently original**: existing tools check scam messages; risk being just an LLM classifier and dashboard. False declaration of safety would be dangerous.

**AmanVerify 2.0:** Added mock registry and payment reference checks, safe abstention, case routing, multiple roles, consent and audit. Better challenge fit but still generic complaint management.

**AmanProof / Evidence Passport:** Instead of “Is this a scam?” asks “Which statements do trustworthy sources support, which contradict them, and what cannot be established?” Records checks and contradictions in a reviewable case.

**AmanProof TrustDesk (current recommended product direction):** Address the biggest real-world blocker: cannot verify BISP/govt records without authorized access. Initial business customer is an **authorized relief/aid organization that controls its own notices and program records**. It generates **cryptographically signed synthetic notices** and provides an Evidence Passport/dispute review. Judges can modify the notice and see a real signature-verification failure against mocked issuer records. Product is **not an official BISP/NADRA/Raast verifier**. SANAD is a provisional new brand for this final direction.

**Why important:** Existing NGO platforms (e.g. CommCare) already have offline workflows, beneficiary enrollment, eligibility rules, payments, complaints and supervision. Merely integrating those features is not enough for a commercial moat. Focus on issuer-origin verification plus explainable contradiction resolution and measurable case preparation. Signed messages and case management are still not new inventions. Any claimed uniqueness is in implementation/operational fit and must be proven.

---

## 3. User story and tight scope

**One task:** Verify a participating relief program's payment notice, check consistency against mock program records, and open/resolve a disputed case when verification is incomplete, suspicious or disputed.

**Actors and what each does:**
- **Citizen/beneficiary (widow):** Can begin via simple Urdu voice/instructions or large icon-led steps; input a simulated SMS or scan/upload a synthetic notice; view plain-language findings; see case status; manage consent; submit a dispute, even with connection interruptions.
- **Shopkeeper:** Can check a presented notice/reference without gaining unrestricted access to beneficiary personal data. **Clarify whether shopkeeper is a role in app or simply a citizen-facing use case**, depending on time; at least three official roles must be working regardless.
- **Community helper:** Manages consent-authorized cases for multiple families on shared phone. Switching a family must clear old case data and enforce server ownership checks.
- **Officer:** Sees a queue, evidence, conflict reasons; requests more information; resolves/rejects cases with rationale. No actual transfer occurs.
- **Admin (issuer/organization):** Creates synthetic official notices and program records, configures and versions eligibility/verification policy, manages roles.
- **Auditor:** Read-only access to traceable decisions/consent events, no edits.

**In scope for MVP:** One fictitious *relief program*, one issuer workspace, verified notices with signed payloads, simple message text intake, synthetic case creation, rule-based checks, conditional AI extraction/routing, privacy controls, human review, an audit trace, basic low-data/resumable experience, demo cases.

**Avoid:** Real payment transfer, NADRA/BISP integration, actual government logo/endorsement, authentic Pakistani citizen data, generalized fraud detection for arbitrary internet links, a full payment network, microservices, blockchain, advanced document-forgery assertions, production-level certification, complex multi-agent frameworks, business billing until required essentials work.

### TrustReceipt (signed issuer notice) — precise promise

- Organization signs a canonical notice payload (issuer ID, notice ID, synthetic claimant/case ref, optional amount/program ref, issued-at, expiry and version) with a **test asymmetric signature** (e.g. Ed25519). Private signing key remains server-side; verifier uses trusted/public key registered for that mock issuer.
- QR code or text token conveys signed payload and signature. **A QR code alone is not authenticity**. A copied signed notice may remain valid and a forged QR can link to a phishing site. Prevent replay and staleness with notice IDs, expiry and server-side status where connected.
- Crypto proves **issuer origin / content integrity for participating issuer**, not that payment happened or recipient is eligible. Only mock payment service checks settlement status.
- Outside the participating issuer registry: **NOT VERIFIED / unable to verify**. Do not claim scam when evidence absent.
- In the demo a judge changes signed amount/ref -> signature fails, result is explicit, cannot be overridden by LLM output.

### Evidence Passport — precise promise

Evidence Passport is an internal, permission-protected **record of verifiable checks**, not a government-certified identity/payment credential. Contains evidence source IDs + timestamps, result of signature, mock payment/identity lookups, policy version, missing fields, contradictions, AI extraction/risk results, officer actions, consent scope and audit trail. Show concise citizen view and expanded officer/auditor view. Use server-derived data, not only a persuasive model-generated summary.

### Allowed outcomes

- **Authentic notice from participating issuer**, independently specify mock payment status. Do NOT call “verified payment” purely from authentic notice.
- **Unverified** (unknown issuer, missing source, expired or disconnected).
- **Contradiction / suspected tampering** (signature mismatch, incompatible details) -> caution and case handoff.
- **Needs additional evidence** (incomplete data).
- **Human review required** (high-impact or ambiguous).

Do not use red/green labels that overclaim safety. A forged notice should not be pronounced legally fraudulent without independent evidence.

---

## 4. 90-second judge demo script (planned, not yet built)

1. Log in as a mock program administrator. Show a **synthetic** issuer and create a digitally signed demo relief-payment notification.
2. As a citizen, input a copy of the notice or SMS, optionally using voice input. The app extracts fields, verifies cryptographic authenticity and looks up mock identity/payment/data API references.
3. Judge edits the amount or reference. The previously signed content is invalid. System flags contradiction; it **does not trust AI's apparent confidence**; opens case with Evidence Passport.
4. As community helper, file the dispute under scoped consent; show visible family switching and a saved draft if connectivity is poor.
5. Officer reviews all source-backed evidence, assigns/escalates/closes the case, records rationale. Auditor can view full trace.
6. Judge revokes helper consent: show next unauthorized GET/update being blocked server-side. Admin changes a simple mock **eligibility threshold**: new decisions use it, old cases show the original rule version.

**Time risk:** Six steps may take longer than 90s. Keep a 90s fast path focused on tampering → abstention → case → review, plus optional judge-driven extended tests for consent and rule versioning. All seeded accounts and cases must be available, and no demo interaction may pretend real APIs are being called.

---

## 5. Risk/cost policy, measurable AI quality, and guardrails

**Rule:** `AI never directly authorizes/denies a real payment or merges identities`. A signature is verified cryptographically; eligibility rules are deterministic; AI extracts and explains; officers make high-impact resolutions.

Possible illustrative cost assumptions **for synthetic exercises only**: false verification = 100 loss units; false rejection = 30; unnecessary manual review = 5; extra evidence request = 2. The numbers are hypothetical and need clearly marked as such. Simulate multiple thresholds on a labeled synthetic set (e.g., 20 cases), show confusion matrix, routing rates and expected loss under those assumed costs. Avoid unsupported accuracy percentages.

**AI test set should include:** legitimate signed notice, modified amount, modified ref, unknown issuer, expired notice, replayed notice, authentic notice with missing payment, contradicting mock status, input prompt-injection attempt, noisy Urdu spelling, empty content, long content, duplicate person, vague evidence, model timeout/outage, weak internet, wrongly classified legitimate message, false alarms. A 10–20-case set is acceptable for the event, if truthful and labeled.

**Guardrails:** server-side authorization every route, Zod/JSON schema validation, model timeout and bounded retries, size limits, no plaintext secrets, no trusting AI-created source IDs, no arbitrary URLs or retrieved instructions controlling tools, verified mock source IDs, deterministic status enum, rule version hash, reversible correction with audit, approval gates. An AI response in valid JSON is not evidence that its facts are correct.

**Offline caveat:** IndexedDB/local draft can preserve limited permitted information and sync with idempotency keys. Sensitive cached content should be minimized and encrypted where feasible; explicitly warn that revoked access stops *future online access*, not retroactively deleted offline copies. Avoid exposing another family's case on a shared device; on family switch, wipe local view/state and require fresh authorization.

---

## 6. Recommended lightweight architecture (not yet selected/implemented)

**Default stack for this team's likely skills:**
- Next.js (App Router) + TypeScript, React, Tailwind, shadcn/ui for frontend and server API routes; simple monolith.
- Supabase Auth + PostgreSQL with migrations and RLS, plus server-side scope authorization; verify setup and hosting quotas.
- Model behind server-only provider adapter (Groq or another available real API) for extraction + classification/explanations. Validate outputs with Zod. Test actual language performance before relying on Urdu STT/TTS.
- Native Node crypto Ed25519 for signed synthetic notices; trusted issuer public keys server registry; never store signing secret in client.
- Vercel for early deployment, GitHub source control, Vitest for business logic, Playwright/browser for critical paths.
- IndexedDB/local drafts and client retries with server idempotency for interrupted form submission.
- **No LangGraph, separate FastAPI service, n8n, Qdrant or microservices by default.** Use only if there is a proven unmet requirement; keep model use explicit and bounded.

**Proposed components:**
- `identity-mock`: synthetic beneficiary lookup, ambiguous spelling variants, duplicate/missing statuses.
- `payment-mock`: issuer payment ref/status; synthetic pending, settled, mismatch, duplicate, unavailable.
- `data-exchange-mock`: program enrollment/record info, source version and timestamps.
- `notice-issuer`: versioned issuer metadata/public keys, signed-notice generator + verifier.
- `policy-engine`: versioned structured rule JSON, audit snapshots, optional Digital Twin evaluator.
- `ai-service`: bounded extraction/classification/explanation; no power to change stored verified facts.
- `case-service`: role/scoped consent cases, review transitions, Evidence Passport and immutable audit events.
- `public-api`: API-key scopes and OpenAPI spec.

**Suggested DB entities (proposals, not done):** `organizations`, `users`/`profiles`, `memberships`/`roles`, `beneficiaries` (all synthetic), `consents`, `cases`, `case_events`, `evidence_items`, `mock_identity_records`, `mock_payment_records`, `mock_program_records`, `issuer_keys`, `signed_notices`, `rule_versions`, `decision_traces`, `audit_events`, `api_keys` (hash/scopes/expiry), `idempotency_keys`, `ai_evaluations`.

**Case state candidates:** `draft → submitted → needs_evidence | review_required → under_review → resolved | rejected`, with transitions constrained by role and audit. “Rejected” means dispute/case rejected by authorized officer, not LLM pronouncement of fraud.

**REST API draft examples:**
- `POST /api/v1/cases`, `GET /api/v1/cases/:id`, `POST /api/v1/cases/:id/submit`, `POST /api/v1/cases/:id/review`
- `POST /api/v1/notices`, `POST /api/v1/notices/verify`
- `POST /api/v1/consents`, `POST /api/v1/consents/:id/revoke`
- `GET /api/v1/cases/:id/evidence-passport`, `GET /api/v1/audit`
- `GET/POST /api/v1/rules`, `POST /api/v1/rules/preview`, `POST /api/v1/rules/:id/publish`
- `GET /api/v1/mocks/identity/:id`, `GET /api/v1/mocks/payments/:id`, `GET /api/v1/mocks/data/:id`
- `GET /openapi.json`, developer docs/Swagger or Redoc UI

Need choose consistent authorization between human session/JWT and API-key clients; **API keys should be hashed at rest, scoped, and never bypass access restrictions**. Never expose a generic admin service role to frontend.

---

## 7. Current critical decisions vs unresolved questions

### Recommended but still to confirm with team

- **Brand:** SANAD (سند) is preferred; only a working name. Alternative Aitbaar, Daleel, Tahqeeq. No availability check completed. Do not lose hours on naming.
- **Product:** SANAD TrustDesk: issuer-aware notice verification + Evidence Passport + dispute handling. Not a general chatbot or fake-payment detector.
- **Customer framing:** NGO/charity/aid operator with program records, not direct government access. Pakistan consumer beneficiary is the end user, not necessarily the paying customer.
- **Core scope:** one synthetic relief program and one end-to-end dispute task.
- **Default stack:** Next.js + Supabase + server-side AI + Vercel.
- **Selected extras:** rule editor, officer queue, offline/low-bandwidth drafts.
- **AI core:** structured extraction, classification/routing, guardrails, explainability. Voice/OCR optional if real test works.
- **Potential bonus:** Helper Mode if family switching is genuinely safe; Digital Twin only if rule versioning is stable.

### Unknown — new chat must ask only if necessary

- Confirm actual **team size (3 or 4), skill allocation** and who owns integration/deployment/demo.
- Which coding agent(s) are available: Codex CLI/App, Cursor, Claude Code, etc; API quotas/hosting access; account credentials availability (never share secret values).
- Repo current state, branches, whether anything is already implemented/hosted; do NOT assume blank repo if user has built meanwhile.
- Confirm SANAD brand (or use working label without delay).
- Confirm intended voice/OCR ambition after capability test.

**Current handoff has no implementation results, no actual tests, and no verified deployment.**

---

## 8. The startup and judge critique (do not misrepresent)

### Main competitors / evidence previously researched

- **BISP Integrated Grievance Management System (iGMS)** already exists, launched 2025; SANAD must not present itself as the first complaint platform or official BISP tool. Primary announcement: https://bisp.gov.pk/NewsDetail/NWJlZTAxZTItMzk5My00ZjcxLTk2MjUtMTc4NmU5ODNhYTFl
- **BISP fraud advisories:** official number 8171 has been publicly highlighted; fake notifications are a known issue. Research official source for latest details if citing numbers on stage: https://bisp.gov.pk/
- **2026 Dawn reporting** on reported BISP payment deductions and difficulty verifying complaints owing to missing payment details: https://www.dawn.com/news/2021629/price-of-collecting-bisp-stipend (verify the current article/source when using in external claims).
- **Bitdefender Scamio** can assess suspicious messages: https://www.bitdefender.com/en-us/consumer/scamio
- **Haqdaar's BISP scam-check concept**: https://haqdaar.danixsoft.com/en/scam-check
- **CommCare** already supports aid/NGO offline case management, cash/voucher workflows, supervisor review, complaints, and some payment integrations; GiveDirectly use-case illustrates sector maturity: https://commcare.dimagi.com/use-cases/cash-voucher-assistance/ and https://commcare.dimagi.com/clients/ngos/givedirectly/
- **KoboToolbox** for field data collection: https://www.kobotoolbox.org/
- **W3C Verifiable Credentials Data Integrity** establishes digital signature/proof principles (not a SANAD invention): https://www.w3.org/TR/vc-data-integrity/

**Observed examples of past hackathon award recipients** (inspiration, not proof identical competition):
- Boston University 2025 Civic Tech overall winner SafeContractor: official record checks + AI summaries: https://www.bu.edu/spark/2025/03/05/2025-civic-tech-hackathon-breaks-record-in-attendance-and-creativity/
- University of North Florida 2025 AI4Good Gold Horizon: interactive evidence-backed housing affordability score in 48 hours: https://dssg.unf.edu/ai4good/2025AI4GoodHackathon.html
- 2024 US Federal GSA AI hackathon NSF Awards Search AI interface: official-information retrieval: https://govciomedia.com/gsa-hackathon-winners-produce-ai-search-engine-interface/
- Banco Sabadell 2025 winner Clear Pay: detect irregular banking transactions: https://comunicacion.grupbancsabadell.com/en/press-room/an-ai-based-solution-to-detect-banking-fraud-wins-the-banco-sabadell-hackathon/
- Philippines OpenGov 2025 Tunai AI fact-checker: https://pco.gov.ph/news_releases/filipinos-create-breakthrough-app-vs-fake-news-palace/

**Takeaway:** Winning projects tend to solve a concrete problem with inspectable, often source-grounded output. These examples do not imply copycats win, or that newness alone is scored.

### Judge Q&A: concise, defensible responses

**Q: This has already been built.** A: Correct: scam classification, signing and case management exist. Our contribution is a focused issuer-origin check, contradiction-aware evidence record, and consent-bound human dispute workflow for low-connectivity relief use. We need to show it works; we don't claim inventing each component.

**Q: Why would BISP use it rather than iGMS?** A: Initial target is aid operators that control their own notices and need a specialized verification/case-intake layer; we don't require government integration for the first deployment. Real government integration would need authorization.

**Q: Why not use CommCare?** A: Mature platforms already manage field cases. Our hypothesis is that issuer-backed message provenance and evidence passport specifically improve authenticity checks and handoffs. A pilot must demonstrate this is cheaper/better than configuring their existing platform. Without that evidence, we have no proven differentiator.

**Q: What problem does this solve?** A: People cannot reliably distinguish official payment notices from altered/fake ones and often lack organized, verifiable evidence to dispute discrepancies; case workers need clean, traceable reports.

**Q: What stops copying?** A: Nothing technical makes a hackathon MVP unstealable. Potential future moat is lawful issuer integrations, trusted distribution, labeled human-reviewed case histories, proven operational quality and switching costs; none exist yet.

**Q: Where does real data come from?** A: This prototype uses mock services only. Production would require organizations to issue their own signed notices or formally authorize integrations. No unilateral BISP/NADRA/Raast access.

**Q: Can digital signatures prove payment?** A: No. They prove a trusted issuer signed unchanged content. Payment status is a distinct verified fact from authorized payment records.

**Q: Why AI?** A: Multilingual unstructured message/document extraction, complaint classification, plain-language explanation, optional voice. Cryptography and financial/eligibility policies must remain deterministic.

**Q: What if the AI lies or fails?** A: Every field is validated; uncertain/unsupported results abstain and go to officer review; rules/cryptography/source data cannot be overridden; provider outage becomes manual flow.

**Q: What if policy changes?** A: Admin-published structured rules, immutable versions. Demo new decision vs historical trace.

**Q: Is offline authentication/consent truly revocable?** A: Server denies subsequent access immediately online; previously downloaded offline data cannot magically be recalled, so minimize it and prevent cross-family leakage.

**Q: Who is customer?** A: Authorized aid operator / NGO/charity managing a relief program; beneficiaries use free. B2B2C subscription/integration/support as a **hypothesis**.

**Q: Why would anyone pay, and how much?** A: Not validated. Prove value through reduction in time per case, missing evidence, wrong routing and case backlog. Do not state a made-up price or actual ROI as fact.

**Q: How do you get first 10 customers?** A: Target small relief organizations with own notification/case records, recruit design partners, pilot the verification layer, compare workflows with existing tools, then seek paid contract. Sales channels and procurement still unproven.

**Q: How is this sustainable?** A: Organization workspaces + usage tiers + integration/support; inference and messaging costs must be bounded. No fees from vulnerable beneficiaries, sale of personal data or percentage of relief payments.

**Q: What's novel?** A: The demonstrable interaction between cryptographically testable issuer notice, AI-extracted contradiction checks, abstention, Evidence Passport, explicit consent and officer workflow. This is product integration/technical judgment, not a patentable new cryptographic algorithm.

**Q: What is the biggest startup failure risk?** A: Slow issuer adoption and no evidence of willingness to pay; existing tools can incorporate the same features. Stop or reposition after a failed pilot rather than pretending to have a moat.

**Q: What metrics prove success?** A: False verification rate, false alarms, manual-review burden, % complete evidence passports, average review time, duplicate submission rate, user task completion on low bandwidth, permission violations (goal zero). Only report measurements actually made.

**Q: Legal/security concerns?** A: Real production requires consent/privacy review, contractual data sharing, cryptographic key rotation, threat modeling, access controls, audit and retention policy, independent security assessment. Prototype is simulated.

**Q: Why won't government copy this for free?** A: It might. Position as an interoperable layer for organizations issuing their own records and offer measurable operational improvement, or be prepared for commoditization.

**Q: Why can your team finish?** A: One issuer, one benefit program, few verified roles, a vertical slice, seeded cases, mandatory checks and incremental deploy; avoid heavy frameworks.

### Startup conclusions from prior critique

- **Problem existence:** supported qualitatively by known scams and reported payment disputes.
- **Uniqueness:** unproven; broad stack is already available from competitors.
- **Technical plausibility:** prototype feasible with synthetic data and one carefully defined flow.
- **Business model:** B2B2C potential but pricing and budgets NOT verified.
- **Real-world integration:** issuer partnerships/authorized records required; currently no confirmed partnership.
- **Moat:** future plan only (trusted integrations, reviewed data, distribution, workflow adoption); not an existing asset.
- **Privacy/security/legal:** high-stakes and unvalidated; prototype only.
- **Go/no-go for event:** Good competition fit if live and safe. Not investment-ready as a startup without validation.

---

## 9. Suggested team execution, only after confirming capacity

**4 people:**
1. Backend/contracts/auth/database/mock services, API keys and API docs.
2. AI extraction/classifier/policy/rule versioning/decision traces + signed notice technical proof.
3. Frontend citizen/helper/mobile accessibility/offline drafts.
4. Officer/admin/auditor screens, end-to-end testing, integration/deploy/demo (ideally explicit integration owner).

**3 people:** combine (1) backend and integration; (2) AI/policy/signature; (3) frontend + officer screens; explicitly assign someone to release/test. Avoid concurrent edits to shared schema or auth paths; agree on API schemas first. Owner names and skill strengths are unknown.

**5 constrained vertical slices rather than feature silos:**

0. **Foundation / feasibility:** inspect repo; brief spec, minimal app, actual model API JSON response, native Ed25519 roundtrip/mutation test, migration auth skeleton, deploy early. If external credential absent, do not fake test; continue deterministic crypto.
1. **Issuer notice verify:** mock issuer and signed synthetic notice → citizen text entry → check signature/status → save check trace → results UI.
2. **AI and evidence:** real AI extraction/classification validated server-side → mock identity/payment/data lookups → contradictions → Evidence Passport → new case.
3. **Review and control:** safe roles, officer queue, case transitions, audit, helper consent/revocation, admin versioned eligibility/rules, OpenAPI/API-key route.
4. **Accessibility, resilience, test and release:** Urdu guidance/voice if works, short forms, offline drafts/idempotency, tests, full hosted browser smoke, demo video, GitHub README. Bonus only if stable.

**Must-start-first proof:** Generate a synthetic notice, sign it with an Ed25519 private key, verify signature with public key, change one amount/reference and prove verification fails. Then check one real model extraction request with schema validation (if account available). This de-risks the unique hero moment before building a large UI.

**Critical acceptance tests** (write before or alongside implementation):
- Mutating a signed payload invalidates verification; AI output can't override crypto check.
- Unknown issuer returns NOT_VERIFIED, never TRUE/SAFE.
- Valid signature but mock payment not found does NOT become verified payment.
- Citizen A cannot read Citizen B's cases via API; helper consent limited by person/case/purpose.
- Revoked helper consent denies new API requests and audit records it.
- Ambiguous names/duplicate people escalate, never auto-merge.
- Admin rule version changes without redeploy; old trace unchanged.
- Offline repeat submit never creates duplicate case; idempotency token.
- Model timeout or malformed JSON leads to manual clarification, not success.
- Officer cannot see data outside role/organization; auditor cannot mutate.
- Documented API-key endpoint refuses missing/invalid scope.
- Live host path works from fresh browser on mobile-size viewport; access denied is enforced on backend.

**Release discipline:** Freeze optional features early. Fix P0 security/secrets/data leaks and P1 broken core/critical false verification first. Show actual tests; no invented scores. A working deployed vertical slice beats 20 polished pages.

---

## 10. Suggested initial prompt to use with this file in a fresh chat

> Act as my senior engineering partner and hackathon copilot for Coder's Cup 2026. I have attached `SANAD_Hackathon_Master_Handoff.md`, the official `AI_Hackathon_Problem_Statement.pdf`, and `Hackathon_Copilot_All_In_One.md`. Read all three. Treat the **official PDF as authoritative** and the master handoff as concept/history, not evidence of code. I want a tested, deployed, judge-ready prototype before **Sunday, November 22, 2026 at 6 PM PKT**. Use the proposed SANAD TrustDesk idea, critique any infeasible assumption and narrow it without losing mandatory requirements. First check current local time, ask ONLY for genuinely missing team/repo/tools information, then give me (1) a one-sentence locked MVP, (2) a 90-second live demo path, (3) the most urgent feasibility spike, (4) one copy-ready task prompt for my coding agent and (5) a concrete verification gate. Route installed skills only when actually available. Work in sequential tested vertical slices. Never call simulated identity/payment checks real, never invent tests/deployments, and require server-side role and consent enforcement.

**If attachments are hard to manage, just upload this one master document and the official PDF to the new chat.** The copilot guide adds process recommendations but is not required to understand the concept; attach it as well if possible.

---

## 11. State flags and next action

- **Verified:** Event requirements from original official PDF; research indicated existing BISP grievance systems, scam-checking competition and NGO case tooling; general cryptographic signature concepts; naming meaning of Urdu “Sanad.”
- **Proposed, NOT verified:** Customer demand, signed-notice adoption, unique differentiator, prices, integration permission, moat, team capability for this event, provider accounts, architectural specifics and forecast accuracy.
- **Not built/unknown:** Repository, signing code, mock API, AI workflow, auth, UI, tests, deployment, public URL and demo video.
- **Next action:** Confirm team/repo/provider access, run native signed-notice tampering proof and one real AI extraction test, then create first deployed vertical slice. Stop planning loops.

