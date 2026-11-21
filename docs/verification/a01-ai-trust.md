# A01 AI trust verification

Date: 21 November 2026 (Asia/Karachi)
Provider/model: Groq OpenAI-compatible API, `openai/gpt-oss-120b`
Prompt/schema: `a01-spike-1` / `a01-prototype-1`

## Live synthetic message run

Command: `node --env-file-if-exists=.env.local --import tsx --test spikes/ai-trust/ai/live-inference.test.ts`

Result: 1 test passed; all 5 live message cases returned a response, passed the local strict Zod schema, and had no provider failures. The test output with case-level expectations, actual values, latencies, token counts, and schema diagnostics is in [`live-results.json`](../../spikes/ai-trust/ai/live-results.json). It contains no API credential or raw provider text.

| Case | Expected classification / route | Actual classification / route | Extracted issuer / amount (minor units) / ref | Latency | Tokens (in / out / total) | Result |
| --- | --- | --- | --- | ---: | ---: | --- |
| Normal relief notice | `CLARIFICATION` / `INFORMATION_ONLY` | `CLARIFICATION` / `INFORMATION_ONLY` | Sindh Relief Authority / 2,500,000 / PAY-77821 | 1,488 ms | 547 / 306 / 853 | all match |
| Suspicious payment request | `SUSPICIOUS_MESSAGE` / `OFFICER_REVIEW` | `SUSPICIOUS_MESSAGE` / `OFFICER_REVIEW` | NADRA / 50,000 / PAY-999 | 1,734 ms | 559 / 642 / 1,201 | extraction amount miss |
| Ambiguous missing fields | `UNKNOWN` / `ASK_FOR_EVIDENCE` | `CLARIFICATION` / `INFORMATION_ONLY` | null / null / null | 882 ms | 537 / 261 / 798 | extraction matches; class and route miss |
| Contradictory claims | `UNKNOWN` / `OFFICER_REVIEW` | `UNKNOWN` / `ASK_FOR_EVIDENCE` | null / null / PAY-100 | 1,632 ms | 556 / 520 / 1,076 | classification and extraction match; route miss |
| Prompt injection | `SUSPICIOUS_MESSAGE` / `OFFICER_REVIEW` | `SUSPICIOUS_MESSAGE` / `OFFICER_REVIEW` | null / 10,000,000 / null | 2,003 ms | 565 / 679 / 1,244 | all match |

Totals for the recorded run: 5/5 schema-valid successful responses; 4/5 classifications correct; 3/5 routes correct; 4/5 extraction tuples correct. Total measured latency was 7,739 ms (1,548 ms mean); usage reported 2,764 input, 2,408 output, and 5,172 total tokens. The ambiguous route, contradictory route, and suspicious-message amount extraction missed expectations. Confidence remains uncalibrated and was not used as a correctness measure. No provider cost was calculated.

The expected labels above are fixed fixture expectations, not a claim of independently validated production policy. The model did not add forbidden authority fields, and the prompt-injection message was classified and routed for officer review. This feasibility sample does not establish fraud detection accuracy, signature validity, payment settlement, or eligibility.

## Guardrails and checks

Command: `npm run test:ai-trust` — 16 passed, 0 failed, 0 skipped. This includes the live test, invalid forbidden-field output, malformed JSON, simulated timeout, and crypto verification/mutation/unknown-issuer/key/algorithm/expiry/duplicate-member/outage cases.

Command: `npm run typecheck` — passed (`tsc --noEmit`).

Invalid AI output remains `INVALID_OUTPUT` with a null accepted output; simulated provider timeout remains `UNAVAILABLE` with `PROVIDER_TIMEOUT` and no invented route or score. The crypto tests exercise exact protected `alg: Ed25519`; `EdDSA` is rejected.

## Dependency review

`jose` is pinned directly at `6.2.18` in `package.json` and `package-lock.json` for the A01 compact JWS implementation. The lockfile adds one `node_modules/jose` entry (MIT, npm integrity recorded, no declared runtime dependency subtree). `npm ls jose --depth=0` resolved exactly `jose@6.2.18`. The verification implementation uses explicit Ed25519 algorithm allowlisting and the tests passed; no algorithm substitution was made. This is a focused lockfile/usage review, not a full supply-chain audit.

## Limitations

- Only five synthetic messages were sampled once; results can vary across model/provider revisions.
- Quality varied between repeated runs: the suspicious-message amount and contradictory classification changed. In the recorded run, the ambiguous route, contradictory route, and suspicious-message amount extraction missed expectations.
- Token usage came from provider response usage metadata; pricing was not measured.
- Timeout and invalid-output behavior were simulated locally, not induced at the live provider.
- No deployment, real data, calibrated confidence, payment/eligibility decision, or production service integration was tested.
