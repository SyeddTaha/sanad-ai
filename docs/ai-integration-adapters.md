# A04 AI and signed-notice adapter handoff

This document describes the server-only adapters in
`src/backend/adapters/assessment-adapters.ts` and the remaining integration
work for the backend owner. They wrap the production A02/A03 services. They do
not change an API route, database schema, Case lifecycle, or frozen v1 contract.

## Adapter functions

### Signed Notice

```ts
verifyNoticeForCase(token, registry, nowSeconds)
```

This calls `verifySignedNotice` from
`src/backend/notices/signed-notice.ts` with the opaque submitted token and the
server controlled `TrustedIssuerRegistry`. The adapter validates and returns
the existing v1 finding shapes for `signature`, `expiry`, and `revocation`,
plus A02's internal issuer trust finding, validated payload, and error code.
Issuer trust remains separate from the public signature finding. Only the
server registry resolves `kid`; callers must not construct it from notice
headers or payloads.

On a valid payload, use these claims only as lookup inputs for separately owned
services:

| Signed payload value | Consumer | Meaning |
| --- | --- | --- |
| `issuerId`, `noticeId` | issuer/revocation history | Signed issuer and notice reference |
| `recipientRef` | mock identity service | Opaque recipient lookup input; not a match finding |
| `paymentRef`, `amountMinor`, `currency`, `programRef` | mock payment/program services | Claims to compare with their independent records |
| `issuedAt`, `expiresAt` | expiry finding | A02 already returns the expiry finding |

Never infer settlement or eligibility from a valid signature or signed
payment/amount claims. A02 does not supply recipient, payment, or eligibility
findings. `mergeNoticeFindings(existing, notice.findings)` replaces exactly
signature/expiry/revocation and carries the existing recipient/payment/
eligibility findings unchanged.

For an unavailable or malformed verification, persist the returned finding
states and sources as-is. In particular, do not turn `UNKNOWN` into a negative
finding, and retain expiry and revocation independently from signature validity.

### AI Assessment

```ts
assessForCase(message, options?)
```

This calls `assessReliefMessage` from `src/backend/ai/assessment.ts`. It takes no
database transaction argument and must be called after releasing authorization
and Case locks. `kind: "INVALID_INPUT"` is caller validation failure and must
not become a persisted Assessment. `kind: "ASSESSED"` returns both:

- the full A03 `assessment`, including extracted untrusted claims, deterministic
  classification/route, safe explanation, abstention/failure code and detailed
  provider/model/prompt/schema/latency/token trace; and
- `metadata`, validated by the frozen `AiAssessmentMetadataSchema`, for the
  current `Assessment.ai` field.

The projection maps successful output to classification, deterministic route,
advisory confidence, and prompt/model/schema versions. A UUID invocation ID is
created for the contract's `runId` and can also populate `Assessment.aiRunIds`.
The contract's `explanationRefs` is empty because A03 returns fixed safe text,
not an approved catalog reference. For provider-not-configured, the projection
uses the contract's no-run unavailable shape with null run/version fields.
Provider errors and invalid model output retain their failure code and an
invocation ID, with null advisory fields; their route remains officer review in
the full A03 result. AI output is never mapped to signature, recipient,
payment, eligibility, Case status, or payment approval. The adapter does not
convert abstention into a successful classification.

The frozen contract has no slots for A03 extracted claims, safe explanation
text, provider name, latency, token usage, or confidence calibration. They are
available in the adapter's returned `assessment` but cannot be persisted in the
current public `Assessment` without an owner-approved contract revision. Do not
silently add fields or place raw message/provider data in `explanationRefs`.
Taha must decide whether those details remain transient or request a coordinated
contract revision.

## Case/Assessment integration sequence for Taha

Current B03 `src/backend/cases/assessments.ts:createAssessment(tx, ...)` writes
the explicit unavailable basis and unknown findings. It runs under the
authorization transaction in `src/backend/cases/http.ts:handleCase`; calling
the Groq-backed A03 service there would make a provider request while database
locks are held. B04 resolution remains deferred; A04 does not implement its
workflow.

For a real Assessment, the backend owner should compose the existing boundaries
in this order:

1. Authenticate and authorize the request, including `READ_EVIDENCE`,
   `REQUEST_ASSESSMENT`, and the server-selected AI processor grant when AI is
   requested. Read a versioned evidence snapshot under the existing Case
   transaction, record its Case/evidence version, and commit/release locks.
2. Outside the transaction, call `verifyNoticeForCase` for each notice using a
   server registry and server UTC epoch time. Call `assessForCase` only when
   consent permits it. Make no provider call for `includeAi: false` or absent
   processing consent.
3. Outside the transaction, query the existing mock identity/payment/program
   services using the validated notice claim inputs and message claims. Build
   independent findings; message extraction is not identity matching or
   authoritative evidence.
4. Start a fresh authorization transaction. Recheck consent and permissions,
   require the captured evidence version still to match, write one immutable
   Assessment from current findings, source refs/versions, rule basis and AI
   metadata, then commit. Discard prepared AI output if authorization was
   withdrawn or the evidence became stale.

Suggested mapping inside the owner-controlled Assessment composer:

```ts
const notice = await verifyNoticeForCase(token, trustedIssuerRegistry, nowSeconds);
const findings = mergeNoticeFindings(identityPaymentProgramFindings, notice.findings);
const sourceVersions = [
  ...Object.values(findings).flatMap((finding) => finding.sourceRefs),
  ...notice.issuer.sourceRefs,
  ...otherSourceRefs,
];
const notAuthorizedMetadata = {
  status: "NOT_AUTHORIZED", runId: null, modelVersion: null, promptVersion: null,
  outputSchemaVersion: null, confidence: null, classification: null,
  recommendedRoute: null, explanationRefs: [], failureCode: null,
} as const;
const ai = aiResult?.kind === "ASSESSED" ? aiResult.metadata : notAuthorizedMetadata;
const aiRunIds = ai.runId ? [ai.runId] : [];
```

The snippet is a mapping example, not a replacement for the existing server
authorization, freshness, persistence, rule-version, or idempotency checks.
The owner must supply actual identity/payment/program findings, current
published rules, a durable immutable Assessment write, and appropriate
`notAuthorizedMetadata`; no service or successful fixture may stand in for
those inputs.

## Exact remaining requirements

- A02 needs a server implementation of `TrustedIssuerRegistry` with current
  issuer/key/notice-revocation records and source versions. Embedded notice
  keys and URLs are never acceptable. Notice ID uniqueness remains a signing
  persistence responsibility.
- The existing v1 Assessment has no issuer-trust finding field. Keep that
  internal finding and its registry source references in the returned adapter
  result/source manifest; do not merge issuer trust into signature validity.
- A03's additional extraction and trace fields have no frozen v1 projection,
  as listed above. Contract-owner decision is required before persisting them.
- The backend owner must add an orchestrator that separates snapshot/read,
  provider/service work, and authorized version-checked persistence. The A04
  adapters are ready to call from that orchestration but intentionally do not
  alter `handleCase` or `createAssessment`.

Adapter tests use synthetic Ed25519 keys, a synthetic frozen notice fixture,
and an injected AI provider. They make no external provider call.
