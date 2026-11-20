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
