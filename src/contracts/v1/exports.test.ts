import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONTRACT_REVISION, API_BASE_PATH, RoleSchema, CaseStatusSchema, ConsentActionSchema,
  ErrorCodeSchema, ErrorHttpStatus, EvidencePassportSchema, ApiSuccessSchema,
  type ApiSuccess, type EvidencePassport, type CaseStatus, type Role,
} from "@/contracts/v1";
import { evidencePassportFixture, fixtureIds } from "@/contracts/v1/fixtures";

test("the v1 public exports share the candidate revision, role/status vocabulary and error catalog", () => {
  assert.equal(CONTRACT_REVISION, "candidate-v1.0.0");
  assert.equal(API_BASE_PATH, "/api/v1");
  assert.deepEqual(RoleSchema.options, ["CITIZEN", "HELPER", "OFFICER", "ADMIN", "AUDITOR"]);
  assert.deepEqual(CaseStatusSchema.options, ["SUBMITTED", "UNDER_REVIEW", "NEEDS_EVIDENCE", "PENDING_CONSENT", "RESOLVED", "CLOSED"]);
  assert.deepEqual(ConsentActionSchema.options, [
    "READ_CASE", "READ_EVIDENCE", "WRITE_DRAFT", "ADD_EVIDENCE", "SUBMIT_CASE",
    "REQUEST_ASSESSMENT", "REVIEW_CASE", "RESOLVE_CASE", "CLOSE_CASE", "PROCESS_AI", "ASSIGN_CASE", "ESCALATE_CASE",
  ]);
  assert.deepEqual([...ErrorCodeSchema.options].sort(), Object.keys(ErrorHttpStatus).sort());
});

test("exported inferred types compose with the same runtime schemas used by consumers", () => {
  const data: EvidencePassport = EvidencePassportSchema.parse(evidencePassportFixture);
  const response: ApiSuccess<EvidencePassport> = ApiSuccessSchema(EvidencePassportSchema).parse({ data, requestId: fixtureIds.request });
  assert.equal(response.data.payment.result, "PENDING");
  // Compiler checks are exercised by npm run typecheck, not the transpiling test runner.
  // @ts-expect-error Draft progress is not a Case status.
  const invalidStatus: CaseStatus = "SAVED";
  // @ts-expect-error Shopkeepers have no additional privileged role.
  const invalidRole: Role = "SHOPKEEPER";
  void invalidStatus;
  void invalidRole;
});
