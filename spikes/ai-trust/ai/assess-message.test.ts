import assert from "node:assert/strict";
import { test } from "node:test";
import { assessReliefMessage, type ReliefMessageProvider } from "./assess-message";

test("invalid model output is rejected and cannot set signature, settlement, or eligibility", async () => {
  const provider: ReliefMessageProvider = {
    name: "stub",
    model: "none",
    async complete() {
      return JSON.stringify({
        classification: "FRAUD",
        signatureValid: true,
        settlementStatus: "SETTLED",
        eligibility: "ELIGIBLE",
      });
    },
  };
  const result = await assessReliefMessage("synthetic message", provider, { timeoutMs: 1000 });
  assert.equal(result.status, "INVALID_OUTPUT");
  assert.equal(result.failureCode, "FORBIDDEN_FIELD");
  assert.equal(result.output, null);
  assert.equal(result.schemaValid, false);
  assert.equal(result.confidenceCalibration, "UNCALIBRATED");
  assert.ok(result.forbiddenKeys.includes("signatureValid"));
  assert.equal("signature" in result, false);
  assert.equal("eligibility" in result, false);
  assert.equal("paymentStatus" in result, false);
});

test("malformed model JSON stays an invalid-output finding", async () => {
  const provider: ReliefMessageProvider = {
    name: "stub",
    model: "none",
    async complete() {
      return "not-json";
    },
  };
  const result = await assessReliefMessage("synthetic message", provider, { timeoutMs: 1000 });
  assert.equal(result.status, "INVALID_OUTPUT");
  assert.equal(result.failureCode, "MALFORMED_JSON");
  assert.equal(result.output, null);
});

test("a provider timeout does not invent a confidence score or route", async () => {
  const provider: ReliefMessageProvider = {
    name: "stub",
    model: "none",
    async complete({ signal }) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 10_000);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(signal.reason);
        });
      });
      return JSON.stringify({ confidence: 1, suggestedRoute: "INFORMATION_ONLY" });
    },
  };
  const result = await assessReliefMessage("synthetic message", provider, { timeoutMs: 40 });
  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(result.failureCode, "PROVIDER_TIMEOUT");
  assert.equal(result.output, null);
  assert.equal(result.schemaValid, false);
  assert.equal(result.confidenceCalibration, "UNCALIBRATED");
});
