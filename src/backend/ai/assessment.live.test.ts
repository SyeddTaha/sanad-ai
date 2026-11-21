import assert from "node:assert/strict";
import { test } from "node:test";
import { assessReliefMessage } from "./assessment";
import { A01_SCENARIOS } from "./a01-scenarios";

test("Groq assessment evaluation on the five recorded A01 synthetic scenarios", {
  skip: process.env.GROQ_API_KEY ? false : "Set GROQ_API_KEY for the live Groq evaluation",
}, async (context) => {
  const results = [];
  for (const item of A01_SCENARIOS) {
    const result = await assessReliefMessage(item.message, { timeoutMs: 30_000 });
    assert.equal(result.status, "SUCCEEDED", `${item.id}: ${result.failureCode}`);
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
      correctness: {
        classification: actual.classification === item.expected.classification,
        route: actual.route === item.expected.route,
        extraction: actual.issuer === item.expected.issuer && actual.amount === item.expected.amount && actual.reference === item.expected.reference,
      },
      latencyMs: result.metadata.latencyMs,
      tokenUsage: result.metadata.tokenUsage,
    });
  }
  context.diagnostic(JSON.stringify({ provider: "groq", model: "openai/gpt-oss-120b", promptVersion: "a03-relief-assessment-1", schemaVersion: "a03-relief-output-1", results }));
});
