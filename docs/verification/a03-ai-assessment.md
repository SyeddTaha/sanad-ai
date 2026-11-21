# A03 production AI assessment service

Implementation: `src/backend/ai/assessment.ts` provides a server-only assessment
function for synthetic relief-payment messages. It calls Groq's
OpenAI-compatible API using `openai/gpt-oss-120b`; `GROQ_API_KEY` is read only on
the server. No API route or dependency was added.

## Behavior and safety

- Extracts untrusted issuer, amount-in-paisa, and payment-reference claims. A
  claim is returned only when its value appears in the original message. When
  the message contains contradictory claims, conflicting extracted values are
  withheld while unambiguous claims remain available.
- Validates the strict model output with Zod. Invalid input/output, malformed
  JSON, missing configuration, provider errors, rate limits, and timeouts return
  an abstention result routed to officer review. The service does not return raw
  provider content or error text.
- Deterministically routes suspicious and contradictory messages to officer
  review, missing critical details to evidence request, and complete ordinary
  messages to information-only. A model confidence value is retained as an
  uncalibrated advisory estimate and does not change routing or approve a case.
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

- Focused A03 tests: 10 passed, 0 failed; the optional live evaluation was
  skipped because `GROQ_API_KEY` was not configured.
- A01 deterministic fixture expectations: all 5 passed using an injected test
  provider.
- Shared contract tests: 25 passed, 0 failed.
- Typecheck and ESLint: passed.
- `next build --webpack`: passed, including compilation, type checking, static
  generation, and trace collection.

The live Groq evaluation test covers the five A01 synthetic scenarios. No live
provider accuracy result is claimed because credentials were not configured in
this session.
