import { test } from "node:test";
import { AI_MODEL, AI_PROMPT_VERSION, AI_SCHEMA_VERSION, assessReliefMessage } from "./assessment";
import { A01_SCENARIOS } from "./a01-scenarios";

test("Groq assessment evaluation on the five recorded A01 synthetic scenarios", {
  skip: process.env.GROQ_API_KEY ? false : "Set GROQ_API_KEY for the live Groq evaluation",
}, async (context) => {
  const results = [];
  for (const item of A01_SCENARIOS) {
    const result = await assessReliefMessage(item.message, { timeoutMs: 30_000 });
    const actual = {
      classification: result.classification,
      route: result.recommendedRoute,
      issuer: result.extractedClaims.issuer,
      amount: result.extractedClaims.amountMinor,
      reference: result.extractedClaims.paymentReference,
    };
    results.push({
      id: item.id,
      expected: item.expected,
      actual,
      status: result.status,
      failureCode: result.failureCode,
      correctness: {
        classification: result.status === "SUCCEEDED" && actual.classification === item.expected.classification,
        route: actual.route === item.expected.route,
        extraction: result.status === "SUCCEEDED" && actual.issuer === item.expected.issuer && actual.amount === item.expected.amount && actual.reference === item.expected.reference,
      },
      latencyMs: result.metadata.latencyMs,
      tokenUsage: result.metadata.tokenUsage,
    });
  }
  context.diagnostic(JSON.stringify({ provider: "groq", model: AI_MODEL, promptVersion: AI_PROMPT_VERSION, schemaVersion: AI_SCHEMA_VERSION, results }));
});
