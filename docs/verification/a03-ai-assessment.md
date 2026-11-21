# A03 production AI assessment service

Implementation: `src/backend/ai/assessment.ts` provides a server-only assessment
function for synthetic relief-payment messages. It calls Groq's
OpenAI-compatible API using `openai/gpt-oss-120b`; `GROQ_API_KEY` is read only on
the server. No API route or dependency was added.

## Behavior and safety

- Extracts untrusted issuer, amount-in-paisa, and payment-reference claims. A
  claim is grounded in the original message; recognized PKR amounts include
  Latin or Urdu digits and prefix or Urdu suffix currency notation. A sole
  literal payment reference is extracted directly. When the message contains
  contradictory claims, conflicting extracted values are withheld while
  unambiguous claims remain available.
- Validates the strict model output with Zod. Invalid input/output, malformed
  JSON, missing configuration, provider errors, rate limits, and timeouts return
  an abstention result routed to officer review. The service does not return raw
  provider content or error text.
- Deterministically routes suspicious and contradictory messages to officer
  review, missing critical details to evidence request, and complete ordinary
  messages to information-only. A model confidence value is retained as an
  uncalibrated advisory estimate and does not change routing or approve a case.
- Suspicion and contradiction detection uses bounded text heuristics plus the
  validated classification; these signals are routing safeguards, not proof of
  fraud or a complete natural-language contradiction detector.
- Explanations are short, fixed English or Urdu statements selected by route.
  Model-authored text is not exposed, avoiding unsupported signature, payment,
  identity, or eligibility assertions.
- Metadata records provider, model, prompt/schema versions, latency, token usage
  when supplied, failure code, and `UNCALIBRATED` status. Message content,
  prompts, credentials, and raw model output are not recorded.

## Backend interface

```ts
assessReliefMessage(message, {
  provider?: ReliefMessageProvider, // test/adapter seam; defaults to Groq env provider
  timeoutMs?: number,
  env?: NodeJS.ProcessEnv,
}): Promise<AssessmentResult>
```

The result carries extracted claims, classification, recommended route,
missing-information keys, safe explanation, confidence, and run metadata. A
backend consumer can map supported run fields to the frozen
`AiAssessmentMetadataSchema`; its current schema does not carry extracted claims
or explanation text. Those values therefore remain module-internal until the
contract owner approves and coordinates a contract update. No contract fields
or API routes were added here.

## Verification

- Focused A03 deterministic tests: 14 passed, 0 failed.
- A01 deterministic fixture expectations: all 5 passed using an injected test
  provider.
- Urdu/mixed-language deterministic fixture expectations: all 6 passed using
  an injected test provider, including native Urdu digits followed by `روپے`.
- Shared contract tests: 25 passed, 0 failed.
- Backend tests: 8 passed, 0 failed.
- AI trust and cryptographic tests: 16 passed, 0 failed (includes the A01 live
  Groq feasibility run).
- A03 production live evaluation runners: 2 passed (five A01 cases and six Urdu
  or mixed-language cases; results are detailed below).
- Typecheck and ESLint: passed.
- `next build --webpack`: passed, including compilation, type checking, static
  generation, and trace collection.

The live Groq evaluation tests separately report classification, extraction,
and routing outcomes for both fixture sets. The canonical `GROQ_API_KEY` name
was absent, but the existing local A01 configuration supplied a Groq
credential. It was mapped in-process for the production service evaluation;
the credential was neither printed nor written to a file.

### Live A01 evaluation

Provider/model: Groq `openai/gpt-oss-120b`. Prompt/schema:
`a03-relief-assessment-2` / `a03-relief-output-1`. The existing local A01 Groq
configuration was used without printing or storing its credential.

| Scenario | Classification | Extracted issuer / amount (minor) / reference | Route | Result |
| --- | --- | --- | --- | --- |
| Normal relief notice | `CLARIFICATION` | Sindh Relief Authority / 2,500,000 / PAY-77821 | `INFORMATION_ONLY` | all correct |
| Suspicious payment request | `SUSPICIOUS_MESSAGE` | NADRA / 2,500,000 / PAY-999 | `OFFICER_REVIEW` | all correct |
| Ambiguous missing fields | `UNKNOWN` | null / null / null | `ASK_FOR_EVIDENCE` | all correct |
| Contradictory claims | `UNKNOWN` | null / null / PAY-100 | `OFFICER_REVIEW` | all correct |
| Prompt injection | `SUSPICIOUS_MESSAGE` | null / 10,000,000 / null | `OFFICER_REVIEW` | all correct |

Totals: classification 5/5, extraction 5/5, routing 5/5; summed provider latency
12,999 ms (mean 2,600 ms); usage 2,269 input and 2,910 output tokens (5,179
total). The first live probe using prompt version 1 was rejected because Groq
returned `missingInformation: null` and textual confidence. The strict Zod
schema rejected that response; prompt version 2 clarified JSON types and the
final five-case run passed schema validation throughout.

### Live Urdu and mixed-language evaluation

Provider/model and prompt/schema versions were the same as the A01 evaluation.
This set covers PKR text, Urdu native digits and `روپے`, missing details,
suspected fraud, a disputed payment, and contradictory amounts.

| Scenario | Classification | Extracted issuer / amount (minor) / reference | Route | Result |
| --- | --- | --- | --- | --- |
| Urdu mixed-language notice | `CLARIFICATION` | سندھ ریلیف اتھارٹی / 2,500,000 / PAY-UR-01 | `INFORMATION_ONLY` | all correct |
| Urdu native-digit amount | `CLARIFICATION` | سندھ امدادی ادارہ / 2,500,000 / PAY-UR-06 | `INFORMATION_ONLY` | all correct |
| Missing details | `UNKNOWN` | null / null / null | `ASK_FOR_EVIDENCE` | all correct |
| Suspected fraud | `SUSPICIOUS_MESSAGE` | null / 50,000 / null | `OFFICER_REVIEW` | all correct |
| Disputed payment | `PAYMENT_DISPUTE` | null / 2,500,000 / PAY-UR-04 | `OFFICER_REVIEW` | all correct |
| Contradictory amounts | `UNKNOWN` | null / null / PAY-UR-05 | `OFFICER_REVIEW` | all correct |

Totals: classification 6/6, extraction 6/6, routing 6/6; summed latency 20,624 ms
(mean 3,437 ms); usage 2,675 input and 3,288 output tokens (5,963 total). The
first Urdu evaluation exposed two extraction errors: a prose fragment was
returned as an issuer, and a visible payment reference was missed. The
issuer-shape validation and literal-reference extraction fix was regression
tested; the sequential re-run above corrected both.

A combined A01-plus-Urdu live attempt hit Groq `RATE_LIMITED` during the Urdu
dispute case. It was recorded as unavailable/manual review, then the Urdu set
was rerun sequentially after the provider quota window; the six-case results
above are from that completed run.
