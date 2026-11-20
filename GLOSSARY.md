# SANAD

SANAD supports evidence-first verification and disputes concerning synthetic relief payment notices.

## Language

**Signed Notice**:
An issuer's digitally signed statement about a synthetic relief payment notice; a valid signature checked against a trusted issuer key establishes issuer origin and content integrity, not payment completion or recipient eligibility. Possession of a Signed Notice grants neither payment authorization nor access to case evidence.
_Avoid_: Verified payment, payment proof

**Evidence Passport**:
A reviewable record of independent findings about signature validity, notice expiry, revocation, recipient matching, payment status, and eligibility, including their sources, timestamps, and applicable rule versions. Unknown findings remain unknown, and earlier findings remain part of its history when evidence changes.
_Avoid_: Overall verification verdict, safe/scam verdict

**Case**:
A reviewable dispute or request with a workflow status independent of its evidence findings. Resolution or closure does not change the underlying findings or their history.
_Avoid_: Verification result, payment approval

**Citizen**:
The person whose synthetic relief notice, evidence, and Case are being considered, and who controls sharing of their case data. A shopkeeper using the citizen-facing verification flow has no additional privileged role.
_Avoid_: Case account

**Community Helper**:
A person assisting Citizens with only the Cases and actions covered by their explicit sharing grants. This role does not include resolving Cases or authorizing its own access.
_Avoid_: Case owner, proxy owner

**Department Officer**:
A reviewer assigned to a Case and authorized through active department sharing to review and resolve it.
_Avoid_: Payment approver

**Admin**:
A person responsible for users, roles, rules, and mock services, without automatic access to private case evidence.
_Avoid_: Unrestricted case viewer

**Auditor**:
A read-only reviewer of necessary audit metadata and decision traces whose access to raw evidence requires separate authorization.
_Avoid_: Unrestricted evidence viewer

**Consent Grant**:
A Citizen's authorization to share a specified Case with a specified recipient for a disclosed purpose and permitted actions, subject to expiry and revocation. Helper sharing, department sharing, and AI-processing authorization are explicit; helper and department grants are independently granted and revoked.
_Avoid_: Blanket consent, device consent

**Consent Withdrawal**:
The revocation of a Consent Grant, ending subsequent access and actions covered by that grant without erasing case history. Information already viewed or downloaded cannot be retroactively recalled.
_Avoid_: Recall of downloaded evidence

**Issuer**:
A participating organization responsible for issuing Signed Notices about synthetic relief payments.
_Avoid_: Payment guarantor

**Trusted Issuer Registry**:
SANAD's controlled record of trusted Issuers and their authorized public signing keys, including which Issuer each key belongs to.
_Avoid_: Notice-supplied key list

**Notice Revocation**:
The withdrawal of a Signed Notice's active standing, tracked separately from its signature validity and expiry. It is independent of a Citizen's Consent Withdrawal.
_Avoid_: Signature failure, consent revocation

**Rule Version**:
An immutable published set of SANAD eligibility and routing rules applicable to new Assessments. Earlier Assessments retain the Rule Version under which they were made.
_Avoid_: Overwritten policy

**Assessment**:
An immutable evaluation of a Case's evidence under a particular Rule Version, preserving its findings, evidence and source references, timestamps, and applicable AI model and prompt versions. A new evaluation creates another Assessment rather than replacing the earlier one.
_Avoid_: Overall verification verdict

**Pending Consent**:
The state of an open Case awaiting valid department-sharing authorization, with its history preserved. It is separate from withdrawal of an independent helper grant.
_Avoid_: Rejected case

**Case Resolution**:
A Department Officer's reasoned disposition of a Case, based on a fresh Assessment and valid authorization. It establishes neither relief payment completion nor eligibility approval.
_Avoid_: Payment approval, eligibility approval

**Mock Identity Service**:
The source of synthetic recipient records and identity lookup findings used in SANAD verification. Ambiguous matches remain ambiguous; name similarity alone does not establish a unique recipient or justify merging records.
_Avoid_: Real identity verification

**Mock Payment Service**:
The source of synthetic relief payment records and payment-status findings. Whether a record was found is separate from its settlement status and from Signed Notice authenticity.
_Avoid_: Payment authorization service

**Mock Program Data Service**:
The source of synthetic program records and eligibility inputs used in SANAD Assessments.
_Avoid_: Government records integration

**Citizen Draft**:
Unsent notice or dispute input held in the active Citizen's session, separate from the Case lifecycle. An in-memory draft is not safely persisted and may disappear when the tab closes or reloads.
_Avoid_: Offline-saved case

**Shared-Phone Session**:
The active Citizen context on a phone used to assist multiple families, with private views, draft input, and audio isolated from other Citizens. Switching Citizens ends the previous private context rather than carrying its evidence or consent into the next one.
_Avoid_: Shared citizen account

**Urdu Audio Guidance**:
Spoken instructions and case information supporting a Citizen's primary workflow without requiring reading. Fixed prerecorded instructions are distinct from AI voice functionality, and case-specific narration reflects only validated, server-authoritative findings.
_Avoid_: AI voice feature for prerecorded instructions
