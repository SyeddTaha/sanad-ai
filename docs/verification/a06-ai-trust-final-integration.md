# A06 AI and Trust final integration

Date: 22 November 2026 (Asia/Karachi)

## Recommendation

**READY FOR COMPONENT HANDOFF.** The deterministic local notice demo and
isolated adapter/AI examples pass. Assessment API orchestration is owned by the
backend lead in the Final Integration branch and is outside A06's scope.

The repository contains working A02–A05 modules, passing deterministic tests,
and a seven-scenario synthetic notice runner. A04's AI adapter produces
schema-valid Assessment metadata and keeps signature/revocation/expiry findings
separate from recipient, payment, and eligibility findings.

The Assessment HTTP endpoint exists at
`POST /api/v1/cases/{caseId}/assessments`. The current `createAssessment` in
`src/backend/cases/assessments.ts` still records unavailable signature/payment
and AI findings; it does not call the A02 or A04 adapters. This is not a
successful live integration. The repository also has no production
issuer/key/revocation registry. The synthetic A05 registry is in-memory and
local only.

## Reproduce the signed-notice scenarios

From the repository root, run:

```sh
node --conditions=react-server --import tsx scripts/synthetic-notice-demo.ts
```

Inputs are generated in-process: an ephemeral Ed25519 key pair, fixed synthetic
payload claims from the notice fixture, registry records held only in memory,
and fixed verifier time `1795300000`. No token, key, API, or database setup is
required. The key pair changes per run; the finding outcomes are deterministic.
The script prints seven JSON lines. Expected outcomes:

| Scenario | Signature | Expiry | Revocation | Issuer trust | Error |
| --- | --- | --- | --- | --- | --- |
| `valid` | `VALID` | `CURRENT` | `ACTIVE` | `TRUSTED` | none |
| `tampered-signature` | `INVALID` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` | `SIGNATURE_INVALID` |
| `expired` | `VALID` | `EXPIRED` | `ACTIVE` | `TRUSTED` | none |
| `revoked` | `VALID` | `CURRENT` | `REVOKED` | `TRUSTED` | none |
| `unknown-issuer` | `NOT_VERIFIED` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN_ISSUER` |
| `unknown-key` | `NOT_VERIFIED` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` | `UNKNOWN_KEY` |
| `registry-unavailable` | `VALID` | `CURRENT` | `UNKNOWN` | `TRUSTED` | `REGISTRY_UNAVAILABLE` |

These findings concern only the synthetic token and registry. The registry is
not government-backed, and signature validity does not establish payment,
identity, or eligibility. Expiry and revocation are independent findings.

## Reproduce the AI and adapter cases

Run the deterministic AI and adapter checks without a provider credential:

```sh
node --conditions=react-server --import tsx --test src/backend/ai/assessment.test.ts src/backend/adapters/assessment-adapters.test.ts
```

The adapter test's successful example input is:

```text
Sindh Relief Authority will pay PKR 25000 PAY-77821
```

It injects a test-only `fixture-provider` response (including confidence `0.91`)
and verifies `SUCCEEDED` metadata. That value is test fixture data, not a live
provider result or a confidence claim for the demo. The same tests cover
malformed JSON, unconfigured provider, and invalid input. A03 deterministic
tests cover timeout, rate-limit/provider failure, malformed and schema-invalid
outputs, oversize input, and abstention routing. None of these examples calls
the live Groq provider.

Live provider evaluation, when configured, can be attempted with:

```sh
node --env-file-if-exists=.env --env-file-if-exists=.env.local --conditions=react-server --import tsx --test src/backend/ai/assessment.live.test.ts src/backend/ai/assessment.urdu.live.test.ts
```

The A03 live test runners were not invoked during final validation because
`GROQ_API_KEY` was unset. No successful live A03 Assessment was observed. Do
not present the adapter's fixture-provider example as a real provider
response.

## Exported integration interfaces

Exact package paths below use the repository's `@/` alias, rooted at `src/`.
All backend modules listed here are server-only.

### Signed-notice verification — `@/backend/notices/signed-notice`

- `createSignedNotice(input: unknown, keyProvider: NoticeSigningKeyProvider): Promise<CompactJws>` validates the v1 payload and signs compact JWS with exact `Ed25519` headers. The key provider is `{ getSigningKey(issuerId): NoticeSigningKey | Promise<NoticeSigningKey> }`, where `NoticeSigningKey` is `{ kid, issuerId, privateKey: CryptoKey }` and the key must be non-extractable.
- `verifySignedNotice(input: unknown, registry: TrustedIssuerRegistry, nowSeconds: number): Promise<NoticeVerificationResult>` returns `{ signature, expiry, revocation, issuer, payload, errorCode }`. `payload` is `SignedNoticePayload | null`. Unknown, invalid, expired, revoked, and unavailable states remain distinct; the function does not return payment or eligibility decisions.
- `TrustedIssuerRegistry` provides `resolveKey(kid)`, `resolveIssuer(issuerId)`, and `resolveNotice(issuerId, noticeId)`. Exact resolution unions:

```ts
RegistryKeyResolution =
  | { status: "FOUND"; kid: string; issuerId: string; publicKey: CryptoKey;
      trustStatus: "ACTIVE" | "REVOKED" | "UNTRUSTED"; sourceVersion: number }
  | { status: "UNKNOWN_KEY" | "UNAVAILABLE" };
RegistryIssuerResolution =
  | { status: "ACTIVE" | "REVOKED"; sourceVersion: number }
  | { status: "UNKNOWN_ISSUER" | "UNAVAILABLE" };
NoticeRevocationResolution =
  | { status: "ACTIVE" | "REVOKED"; sourceVersion: number }
  | { status: "UNAVAILABLE" };
```

Keys are resolved from this server-owned interface only.

### Synthetic issuer registry — `@/backend/notices/synthetic-demo-registry`

- `new SyntheticDemoTrustedIssuerRegistry(snapshot: SyntheticRegistrySnapshot)` implements `TrustedIssuerRegistry` in memory.
- Exported records are `SyntheticIssuerRecord = { issuerId: string; status: "ACTIVE" | "REVOKED"; sourceVersion: number }`, `SyntheticKeyRecord = { kid: string; issuerId: string; publicKey: CryptoKey; trustStatus: "ACTIVE" | "REVOKED" | "UNTRUSTED"; sourceVersion: number }`, and `SyntheticNoticeRecord = { issuerId: string; noticeId: string; status: "ACTIVE" | "REVOKED"; sourceVersion: number }`. `SyntheticRegistrySnapshot` contains readonly arrays `issuers`, `keys`, `notices`, plus optional `unavailable: readonly ("keys" | "issuers" | "notices")[]`.
- Methods mirror the registry resolutions above. Missing notice records return `UNAVAILABLE`, never implied active status. This is only a synthetic local adapter, not a trusted authority.
- The seven-case runnable wrapper is `runSyntheticNoticeDemo(): Promise<SyntheticNoticeDemoResult[]>` from `@/backend/notices/synthetic-notice-demo` and is invoked by `scripts/synthetic-notice-demo.ts`.

### AI extraction and classification — `@/backend/ai/assessment`

- `assessReliefMessage(message: string, options?: AssessmentOptions): Promise<AssessmentResult>` accepts a 1–10,000 character message and optionally `{ provider, timeoutMs, env }`.
- `AssessmentResult` contains `status`, `failureCode`, `extractedClaims: { issuer: string | null; amountMinor: number | null; paymentReference: string | null }`, nullable `classification`, `recommendedRoute`, `missingInformation: string[]`, nullable `confidence`, fixed-safe `explanation`, `explanationReplaced`, and `metadata: { provider, model, promptVersion, outputSchemaVersion, latencyMs, confidenceCalibration: "UNCALIBRATED", tokenUsage: { input, output, total } | null }`. `status` is `SUCCEEDED | INVALID_OUTPUT | UNAVAILABLE | INVALID_INPUT`; classification is `SUSPICIOUS_MESSAGE | PAYMENT_DISPUTE | CLARIFICATION | UNKNOWN`; route is `ASK_FOR_EVIDENCE | OFFICER_REVIEW | INFORMATION_ONLY`.
- `ReliefAssessmentOutputSchema` is strict; the provider output cannot supply signature, settlement, recipient identity, or eligibility. `confidence` is advisory and marked `UNCALIBRATED` in run metadata. Invalid inputs and provider failures abstain.
- Default provider configuration uses `GROQ_API_KEY`, model `openai/gpt-oss-120b`, and the Groq OpenAI-compatible chat-completions endpoint. No default provider is created if the key is absent.

### Mock identity/payment/program adapters

No mock identity or payment adapter implementation/interface exists. There is a synthetic program input reader and deterministic eligibility evaluator in `@/backend/rules/eligibility`:

- `programInput(tx: Transaction, caseId: string)` returns a promise of `null` or `{ id: string, version: number, recipientMatch: "MATCH" | "AMBIGUOUS" | "UNKNOWN", enrollment: "ACTIVE" | "INACTIVE" | "UNKNOWN", monthlyIncomeMinor: number | null }`, validated against a private strict Zod schema.
- `evaluateEligibility(input: Awaited<ReturnType<typeof programInput>>, parameters: RuleParameters)` returns `{ result: "UNKNOWN" | "INELIGIBLE" | "ELIGIBLE", reasonCodes: FindingReasonCode[] }`. Missing/ambiguous/unmatched inputs stay unknown; eligible status is bounded by the supplied published rule threshold.
- `programInput` reads `synthetic_program_inputs`; it is synthetic case-scoped input, not an authoritative identity or government program record. It currently carries a `recipientMatch` input, but that is not an independently verified identity-service result.

A04 accepts separately built findings; signed notice claims are lookup inputs only. The public `EvidenceFindings` data shape from `@/contracts/v1` (`signature`, `expiry`, `revocation`, `recipientMatch`, `payment`, `eligibility`) is a finding schema, not an adapter interface. No mock payment source is connected; `payment` stays unknown. Do not substitute synthetic pass findings for absent sources.

### Assessment metadata composition — `@/backend/adapters/assessment-adapters`

- `verifyNoticeForCase(token: unknown, registry: TrustedIssuerRegistry, nowSeconds: number): Promise<CaseNoticeAdapterResult>` returns `findings` for signature/expiry/revocation, a separate `issuer` trust finding, validated payload or null, and `errorCode`.
- `mergeNoticeFindings(existing: EvidenceFindings, notice: CaseNoticeFindings): EvidenceFindings` replaces only signature/expiry/revocation and preserves recipient/payment/eligibility objects.
- `assessForCase(message: string, options?: AssessmentOptions): Promise<CaseAiAdapterResult>` returns `INVALID_INPUT` without metadata for caller validation errors; otherwise `ASSESSED` contains the full A03 `assessment` and `metadata: AiAssessmentMetadata` validated against `AiAssessmentMetadataSchema` from `@/contracts/v1`.
- Successful `AiAssessmentMetadata` has `status: "SUCCEEDED"`, UUID `runId`, model/prompt/schema versions, advisory `confidence`, classification, route, empty `explanationRefs`, and null `failureCode`. Provider/configuration failures return `UNAVAILABLE`; malformed output returns `INVALID_OUTPUT`; both carry null advisory fields and a failure code. Missing provider config uses a no-run shape with null run/version fields. Invalid input returns no metadata. The private `toAiMetadata` function is not exported. Current v1 metadata does not store extracted claims, explanation text, latency, token usage, or calibration state.

## Environment setup

- A02/A04 deterministic tests and A05 local demo require no credentials or service configuration. The A05 command refuses to run when `NODE_ENV=production`.
- A03 live Groq assessment requires `GROQ_API_KEY`. This credential is server-side only.
- The separate A01 spike live runner (`spikes/ai-trust/ai/live-inference.test.ts`) accepts `SANAD_SPIKE_AI_PROVIDER` (`gemini`, `groq`, or `openai`) and `SANAD_SPIKE_AI_API_KEY`; optional overrides are `SANAD_SPIKE_AI_MODEL` and `SANAD_SPIKE_AI_BASE_URL`. Without these, it also recognizes `GEMINI_API_KEY` or `GOOGLE_API_KEY`, then `GROQ_API_KEY`, then `OPENAI_API_KEY`.
- For Assessment API authentication/database setup, the auth client reads `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`; PostgreSQL uses `SUPABASE_STRING` and optionally `SUPABASE_DB_CA_FILE`. Those app credentials do not connect A02–A05 to the Assessment orchestrator.

### A01 live-inference failure

The failing runner was not skipped for absent credentials: `.env.local` contained
`SANAD_SPIKE_AI_PROVIDER=groq` and `SANAD_SPIKE_AI_API_KEY` (presence checked;
the key value was not displayed). The captured test summary only identifies
`live-inference.test.ts` as failed; it does not expose the assertion, case, or
provider error. In this spike, provider exceptions/timeouts become
`UNAVAILABLE`, which the runner rejects, so an external provider failure is a
plausible cause but is not proven by the output. The runner writes
`live-results.json` only after all five cases finish, so the existing artifact
remains the earlier 21 November 2026 run; it records five successful
schema-valid responses with some fixture mismatches. This was not a
missing-credential skip, but the evidence cannot distinguish a transient live
failure from another runner defect. No deterministic defect was demonstrated;
no code fix is justified from this evidence. The paid live provider remains
optional; deterministic AI and crypto tests are the delivery gate.

## HTTP integration and consent boundary

The current Assessment API is the real local HTTP endpoint
`POST /api/v1/cases/{caseId}/assessments`; the trace endpoint is
`GET /api/v1/cases/{caseId}/assessments/{assessmentId}/trace`. Existing backend
tests exercise the route handler's authorization, processor consent,
withdrawal, and unavailable Assessment persistence in-process. No HTTP request
against a running server was made for A06. With `includeAi: true`, processing
consent must be present for AI authorization; without it the handler returns
`NOT_AUTHORIZED` AI metadata. Even with consent, current orchestration returns
`UNAVAILABLE`/`provider_not_configured` and does not call the AI provider.
`includeAi: false` also does not call A03.

The only outbound provider URL implemented is A03's Groq URL:
`https://api.groq.com/openai/v1/chat/completions`. A03 calls it only when
`GROQ_API_KEY` is configured. It was not called in this A06 run. It is called
by A03 directly, not through the Assessment API. No notice-verification HTTP
endpoint or production registry is connected. The A05 command above and all
A02/A04 verification examples run locally.

## Validation results

Commands run from the repository root:

| Command | Result |
| --- | --- |
| `node --conditions=react-server --import tsx --test src/backend/ai/assessment.test.ts src/backend/adapters/assessment-adapters.test.ts src/backend/notices/signed-notice.test.ts src/backend/notices/synthetic-notice-demo.test.ts spikes/ai-trust/crypto/verify-notice.test.ts spikes/ai-trust/ai/assess-message.test.ts` | Passed on updated branch: 6 test files, 6 passed, 0 failed, 0 skipped. Covers deterministic A01/A03 AI, A02, A04, A05, and crypto behavior. |
| `node --conditions=react-server --import tsx scripts/synthetic-notice-demo.ts` | Passed on updated branch; printed all 7 documented scenarios with expected outcomes. |
| `node --import tsx --test src/contracts/v1/*.test.ts` | Passed on updated branch: 7 test files, 7 passed, 0 failed. |
| `npm run test:backend` | 11 test files passed; 1 failed to load because `@apidevtools/swagger-parser` is declared in package.json/package-lock.json but absent from this checkout's `node_modules`. No source assertion failed; dependencies were not reinstalled for A06. |
| `npm run test:ai-trust` | Live A01 `live-inference.test.ts` failed with Groq configured; captured output has no assertion/provider/case detail. Deterministic A01 assessment and crypto test files pass independently. This was not a missing-credential skip. |
| `node --env-file-if-exists=.env --env-file-if-exists=.env.local --conditions=react-server --import tsx --test src/backend/ai/assessment.live.test.ts src/backend/ai/assessment.urdu.live.test.ts` | Both A03 live tests skipped because `GROQ_API_KEY` is unset. |
| `git diff --check` | Passed on updated branch before commit. |

`npm run lint`, `npm run typecheck`, and `npm run build` passed at the earlier
feature tip but were not repeated after the B04/B05 fast-forward. The checkout's
`node_modules` predates the updated lockfile, which explains the missing B05
test-only package above.

No code, API contract, migration, authorization, or frontend files were
modified for A06.
