import assert from "node:assert/strict";
import { test } from "node:test";
import { AiAssessmentMetadataSchema, AssessmentSchema, EvidencePassportSchema, RuleVersionSchema } from "@/contracts/v1";
import { aiNotAuthorizedFixture, assessmentFixture, evidencePassportFixture, missingPaymentPassportFixture, ruleVersionFixture, fixtureIds } from "@/contracts/v1/fixtures";

test("a Rule Version preserves published structured parameters and publication provenance", () => {
  assert.deepEqual(RuleVersionSchema.parse(ruleVersionFixture), ruleVersionFixture);
  assert.equal(RuleVersionSchema.safeParse({ ...ruleVersionFixture, parameters: { javascript: "return true" } }).success, false);
});

test("AI abstention metadata carries no invented score, success, model run or recommendation", () => {
  assert.deepEqual(AiAssessmentMetadataSchema.parse(aiNotAuthorizedFixture), aiNotAuthorizedFixture);
  for (const patch of [
    { confidence: 0 }, { runId: fixtureIds.assessment }, { status: "SUCCEEDED" },
    { classification: "PAYMENT_DISPUTE" }, { recommendedRoute: "APPROVE_PAYMENT" },
    { explanationRefs: [{ factId: "payment", explanationKey: "paid" }] },
  ]) assert.equal(AiAssessmentMetadataSchema.safeParse({ ...aiNotAuthorizedFixture, ...patch }).success, false);
});

test("a successful AI run records actual versions and advisory results only", () => {
  const input = {
    status: "SUCCEEDED", runId: fixtureIds.aiRun,
    modelVersion: "synthetic-model/v1", promptVersion: "prompt_demo_v1", outputSchemaVersion: "1",
    confidence: 0.6, classification: "PAYMENT_DISPUTE", recommendedRoute: "OFFICER_REVIEW",
    explanationRefs: [{ factId: "payment", explanationKey: "payment_pending" }], failureCode: null,
  };
  assert.deepEqual(AiAssessmentMetadataSchema.parse(input), input);
  for (const patch of [
    { confidence: null }, { confidence: -0.1 }, { confidence: 1.1 }, { runId: null },
    { modelVersion: null }, { promptVersion: "" }, { recommendedRoute: "RESOLVED" },
    { payment: "SETTLED" }, { failureCode: "TIMEOUT" },
  ]) assert.equal(AiAssessmentMetadataSchema.safeParse({ ...input, ...patch }).success, false);
});

test("failed AI attempts retain provenance while no-run unavailability remains explicit", () => {
  const failure = {
    ...aiNotAuthorizedFixture, status: "INVALID_OUTPUT", runId: fixtureIds.aiRun,
    modelVersion: "synthetic-model/v1", promptVersion: "prompt_demo_v1", outputSchemaVersion: "1",
    failureCode: "INVALID_OUTPUT",
  };
  assert.deepEqual(AiAssessmentMetadataSchema.parse(failure), failure);
  const unavailable = { ...aiNotAuthorizedFixture, status: "UNAVAILABLE", failureCode: "PROVIDER_UNAVAILABLE" };
  assert.deepEqual(AiAssessmentMetadataSchema.parse(unavailable), unavailable);
  assert.equal(AiAssessmentMetadataSchema.safeParse({ ...failure, modelVersion: null }).success, false);
  assert.equal(AiAssessmentMetadataSchema.safeParse({ ...failure, confidence: 0.9 }).success, false);
  assert.equal(AiAssessmentMetadataSchema.safeParse({ ...unavailable, modelVersion: "invented" }).success, false);
});

test("assessment and passport carry independent findings with evidence, source and rule revisions", () => {
  assert.deepEqual(AssessmentSchema.parse(assessmentFixture), assessmentFixture);
  assert.deepEqual(EvidencePassportSchema.parse(evidencePassportFixture), evidencePassportFixture);
  assert.deepEqual(EvidencePassportSchema.parse(missingPaymentPassportFixture), missingPaymentPassportFixture);
  assert.equal(EvidencePassportSchema.parse({ ...evidencePassportFixture, caseStatus: null }).caseStatus, null);
  for (const patch of [
    { ruleVersionId: undefined }, { evidenceVersion: 0 }, { sourceVersions: undefined },
    { findings: { ...assessmentFixture.findings, approved: true } },
    { contradictions: [{ fields: ["amountMinor"], verdict: "FRAUD" }] },
  ]) assert.equal(AssessmentSchema.safeParse({ ...assessmentFixture, ...patch }).success, false);
});
