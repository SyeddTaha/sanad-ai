import assert from "node:assert/strict";
import { test } from "node:test";
import { CaseSchema, CaseTransitionSchema, CaseStatusSchema, ResolveCaseRequestSchema } from "@/contracts/v1";
import { caseFixture, fixtureIds } from "@/contracts/v1/fixtures";

test("case transitions accept the ADR 0004 workflow including consent interruption and fresh review", () => {
  const transitions = [
    [null, "SUBMITTED"], [null, "PENDING_CONSENT"],
    ["SUBMITTED", "UNDER_REVIEW"], ["UNDER_REVIEW", "NEEDS_EVIDENCE"],
    ["NEEDS_EVIDENCE", "SUBMITTED"], ["UNDER_REVIEW", "RESOLVED"],
    ["RESOLVED", "CLOSED"], ["SUBMITTED", "PENDING_CONSENT"],
    ["UNDER_REVIEW", "PENDING_CONSENT"], ["NEEDS_EVIDENCE", "PENDING_CONSENT"],
    ["PENDING_CONSENT", "SUBMITTED"],
  ];
  for (const [from, to] of transitions) assert.deepEqual(CaseTransitionSchema.parse({ from, to }), { from, to });
});

test("a Case carries workflow and revision metadata without an evidence verdict", () => {
  assert.deepEqual(CaseSchema.parse(caseFixture), caseFixture);
  assert.equal(CaseSchema.safeParse({ ...caseFixture, assignedOfficerId: undefined }).success, false);
  assert.equal(CaseSchema.safeParse({ ...caseFixture, verified: true }).success, false);
  assert.equal(CaseSchema.safeParse({ ...caseFixture, priority: "AUTO_APPROVE" }).success, false);
});

test("case transitions reject skipped review, reopening, no-ops and draft or approval states", () => {
  for (const [from, to] of [
    [null, "RESOLVED"], ["SUBMITTED", "RESOLVED"], ["NEEDS_EVIDENCE", "RESOLVED"],
    ["PENDING_CONSENT", "UNDER_REVIEW"], ["RESOLVED", "PENDING_CONSENT"],
    ["CLOSED", "SUBMITTED"], ["CLOSED", "PENDING_CONSENT"], ["UNDER_REVIEW", "CLOSED"],
    ["SUBMITTED", "SUBMITTED"], ["DRAFT", "SUBMITTED"], ["UNDER_REVIEW", "APPROVED"],
  ]) assert.equal(CaseTransitionSchema.safeParse({ from, to }).success, false);
  for (const state of ["DRAFT", "SAVED", "ASSIGNED", "ESCALATED", "APPROVED", "REJECTED"]) {
    assert.equal(CaseStatusSchema.safeParse(state).success, false);
  }
  assert.equal(CaseTransitionSchema.safeParse({ from: "SUBMITTED", to: "UNDER_REVIEW", actorRole: "OFFICER" }).success, false);
});

test("resolution input requires a reviewed Assessment, positive expected version and meaningful bounded reason", () => {
  const input = { expectedVersion: 2, reviewedAssessmentId: fixtureIds.assessment, reason: "Synthetic dispute reviewed." };
  assert.deepEqual(ResolveCaseRequestSchema.parse(input), input);
  for (const patch of [
    { reason: "" }, { reason: "  \n " }, { reason: "x".repeat(2001) },
    { reviewedAssessmentId: undefined }, { expectedVersion: 0 },
    { expectedVersion: "2" }, { approved: true }, { officerId: fixtureIds.officer },
  ]) assert.equal(ResolveCaseRequestSchema.safeParse({ ...input, ...patch }).success, false);
});
