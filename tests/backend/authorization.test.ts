import assert from "node:assert/strict";
import test from "node:test";
import { authorize } from "../../src/backend/authorization/policy";
import type { AuthorizationContext } from "../../src/contracts/v1";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const context: AuthorizationContext = {
  principal: { id: id(1), kind: "HUMAN", roles: ["CITIZEN"], active: true },
  target: { caseId: id(10), citizenId: id(1), assignedOfficerId: null },
  departmentIds: [], grants: [], apiKeyScopes: null, evaluatedAt: "2026-11-21T12:00:00Z",
};
test("Citizen A reads their own evidence and cannot read Citizen B's evidence", () => {
  assert.equal(authorize(context, { action: "READ_EVIDENCE", purpose: "synthetic_helper_assistance" }).allowed, true);
  assert.equal(authorize({ ...context, target: { ...context.target, citizenId: id(2) } },
    { action: "READ_EVIDENCE", purpose: "synthetic_helper_assistance" }).allowed, false);
});

test("officers need assignment, the assigned department and that department's action grant", () => {
  const officer = { ...context, principal: { ...context.principal, id: id(4), roles: ["OFFICER"] as AuthorizationContext["principal"]["roles"] },
    target: { ...context.target, assignedOfficerId: id(4) }, departmentIds: [id(30)], assignedDepartmentId: id(30),
    grants: [{ ...grant, actions: ["READ_EVIDENCE" as const], recipientType: "DEPARTMENT" as const, recipientId: id(30), purpose: "synthetic_department_review" }] };
  const permission = { action: "READ_EVIDENCE" as const, purpose: "synthetic_department_review" };
  assert.equal(authorize(officer, permission).allowed, true);
  for (const changed of [ { grants: [] }, { departmentIds: [id(31)] }, { assignedDepartmentId: id(31) },
    { target: { ...officer.target, assignedOfficerId: null } } ]) {
    assert.equal(authorize({ ...officer, ...changed }, permission).allowed, false);
  }
});

test("admin and auditor roles do not confer private evidence or mutations; role combinations cannot launder grants", () => {
  const shared = { ...helper, grants: [{ ...grant, actions: ["READ_EVIDENCE", "RESOLVE_CASE"] as AuthorizationContext["grants"][number]["actions"] }] };
  for (const roles of [["ADMIN"], ["AUDITOR"], ["ADMIN", "OFFICER"], ["HELPER", "OFFICER"], ["HELPER", "ADMIN"]] as AuthorizationContext["principal"]["roles"][]) {
    const c = { ...shared, principal: { ...shared.principal, roles } };
    assert.equal(authorize(c, { action: "RESOLVE_CASE", purpose: grant.purpose }).allowed, false);
    if (!roles.includes("HELPER")) assert.equal(authorize(c, { action: "READ_EVIDENCE", purpose: grant.purpose }).allowed, false);
  }
  const audit = { ...shared, principal: { ...shared.principal, roles: ["AUDITOR"] as AuthorizationContext["principal"]["roles"] },
    grants: [{ ...shared.grants[0], purpose: "synthetic_audit_review", actions: ["READ_EVIDENCE", "ADD_EVIDENCE"] as AuthorizationContext["grants"][number]["actions"] }] };
  assert.equal(authorize(audit, { action: "READ_EVIDENCE", purpose: "synthetic_audit_review" }).allowed, true);
  assert.equal(authorize(audit, { action: "ADD_EVIDENCE", purpose: "synthetic_audit_review" }).allowed, false);
  assert.equal(authorize({ ...context, apiKeyScopes: [] }, { action: "READ_CASE", purpose: grant.purpose }).code, "INSUFFICIENT_SCOPE");
});

const helper = { ...context, principal: { ...context.principal, id: id(3), roles: ["HELPER"] as AuthorizationContext["principal"]["roles"] } };
const grant = {
  id: id(20), caseId: id(10), grantorCitizenId: id(1), recipientType: "PRINCIPAL" as const,
  recipientId: id(3), purpose: "synthetic_helper_assistance", actions: ["READ_EVIDENCE"] as const,
  createdAt: "2026-11-21T11:00:00Z", expiresAt: "2026-11-21T13:00:00Z", revokedAt: null, version: 1,
};
test("helper access requires a live grant for the exact recipient, case, purpose and action", () => {
  const permission = { action: "READ_EVIDENCE" as const, purpose: grant.purpose };
  assert.equal(authorize(helper, permission).allowed, false);
  const shared = { ...helper, grants: [{ ...grant, actions: [...grant.actions] }] };
  assert.equal(authorize(shared, permission).allowed, true);
  for (const changed of [
    { recipientId: id(4) }, { caseId: id(11) }, { grantorCitizenId: id(2) },
    { purpose: "undisclosed" }, { expiresAt: context.evaluatedAt }, { revokedAt: context.evaluatedAt },
  ]) assert.equal(authorize({ ...shared, grants: [{ ...shared.grants[0], ...changed }] }, permission).allowed, false);
  assert.equal(authorize(shared, { ...permission, action: "ADD_EVIDENCE" }).allowed, false);
  assert.equal(authorize({ ...shared, grants: [{ ...shared.grants[0], actions: ["RESOLVE_CASE"] }] },
    { ...permission, action: "RESOLVE_CASE" }).allowed, false);
});

test("AI processing requires both initiating permissions and independent processor consent", () => {
  const processorId = id(40);
  const ai = { ...grant, id: id(41), recipientType: "AI_PROCESSOR" as const, recipientId: processorId,
    purpose: "synthetic_ai_assistance", actions: ["PROCESS_AI" as const] };
  const permission = { action: "PROCESS_AI" as const, purpose: "synthetic_helper_assistance", processorId };
  assert.equal(authorize(context, permission).allowed, false);
  assert.equal(authorize({ ...context, grants: [ai] }, permission).allowed, true);
  const shared = { ...helper, grants: [ai, { ...grant, actions: ["READ_EVIDENCE", "REQUEST_ASSESSMENT"] as AuthorizationContext["grants"][number]["actions"] }] };
  assert.equal(authorize(shared, permission).allowed, true);
  assert.equal(authorize({ ...shared, grants: [ai] }, permission).allowed, false);
  assert.equal(authorize(shared, { ...permission, processorId: id(42) }).allowed, false);
  assert.equal(authorize({ ...shared, apiKeyScopes: ["PROCESS_AI"] }, permission).allowed, false);
});
