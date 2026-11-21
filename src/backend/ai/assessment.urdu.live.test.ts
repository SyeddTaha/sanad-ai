import { test } from "node:test";
import { AI_MODEL, AI_PROMPT_VERSION, AI_SCHEMA_VERSION, assessReliefMessage } from "./assessment";
import { URDU_SCENARIOS } from "./urdu-scenarios";

test("Groq assessment evaluation on synthetic Urdu and mixed-language messages", {
  skip: process.env.GROQ_API_KEY ? false : "Set GROQ_API_KEY for the live Groq evaluation",
}, async (context) => {
  const results = [];
  for (const item of URDU_SCENARIOS) {
    const result = await assessReliefMessage(item.message, { timeoutMs: 30_000 });
    const actual = {
      classification: result.classification,
      extraction: result.extractedClaims,
      route: result.recommendedRoute,
    };
    const expected = {
      classification: item.expected.classification,
      extraction: {
        issuer: item.expected.issuer,
        amountMinor: item.expected.amount,
        paymentReference: item.expected.reference,
      },
      route: item.expected.route,
    };
    results.push({
      id: item.id,
      expected,
      actual,
      status: result.status,
      failureCode: result.failureCode,
      correctness: {
        classification: result.status === "SUCCEEDED" && actual.classification === expected.classification,
        extraction: result.status === "SUCCEEDED" && JSON.stringify(actual.extraction) === JSON.stringify(expected.extraction),
        routing: actual.route === expected.route,
      },
      latencyMs: result.metadata.latencyMs,
      tokenUsage: result.metadata.tokenUsage,
    });
  }
  context.diagnostic(JSON.stringify({ provider: "groq", model: AI_MODEL, promptVersion: AI_PROMPT_VERSION, schemaVersion: AI_SCHEMA_VERSION, results }));
});
