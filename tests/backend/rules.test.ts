import assert from "node:assert/strict";
import { test } from "node:test";
import { handleRules } from "../../src/backend/rules/http";
import { handleCase } from "../../src/backend/cases/http";
import { handleConsent } from "../../src/backend/consent/http";
import { RuleVersionSchema } from "../../src/contracts/v1";
import { db, id, request, dependencies } from "../support/case-fixture";

test("only an active admin publishes bounded synthetic parameters; versions and digest remain immutable", async () => {
  const parameters = { maxMonthlyIncomeMinor: 800000, minRoutingConfidence: 0.8, integrityFailurePriority: "HIGH" };
  const body = { programRef: "program_demo", expectedCurrentVersion: null, parameters };
  for (const actor of [1,3,4,6]) assert.equal((await handleRules(request(actor, body), "publish", dependencies(actor))).status, 403);
  const key = crypto.randomUUID();
  const response = await handleRules(request(5, body, key), "publish", dependencies(5));
  assert.equal(response.status, 201);
  const original = RuleVersionSchema.parse((await response.json()).data.rule);
  assert.equal(original.version, 1);
  assert.equal(original.publishedBy, id(5));
  assert.equal(original.contentDigest, "98d3e150420c9b576120111b14feb4757836613549b1f472ee77e659e65ee063");
  assert.deepEqual((await (await handleRules(request(5, body, key), "publish", dependencies(5))).json()).data.rule, original);
  assert.equal((await handleRules(request(5, { ...body, parameters: { ...parameters, disableConsent: true } }), "publish", dependencies(5))).status, 422);
  assert.equal((await handleRules(request(5, body), "publish", dependencies(5))).status, 409);
  const next = await handleRules(request(5, { ...body, expectedCurrentVersion: 1, parameters: { ...parameters, maxMonthlyIncomeMinor: 900000 } }), "publish", dependencies(5));
  assert.equal(next.status, 201);
  assert.equal((await next.json()).data.rule.version, 2);
  assert.equal((await handleRules(request(1), "current", dependencies(1))).status, 403);
  assert.equal((await (await handleRules(request(4), "current", dependencies(4))).json()).data.rule.version, 2);
  await assert.rejects(db.query("update public.rule_versions set parameters='{}' where id=$1", [original.id]), /immutable/);
  await assert.rejects(db.query("delete from public.rule_versions where id=$1", [original.id]), /immutable/);
  for (const role of ["anon", "authenticated", "service_role"]) {
    await db.exec("set role " + role);
    await assert.rejects(db.query("select * from public.rule_versions"), /permission denied/);
    await db.exec("reset role");
  }
});

test("published income rules evaluate only scoped synthetic program inputs; changes preserve earlier findings and ambiguous inputs abstain",async()=>{
  const caseId=(await (await handleConsent(request(1,{}),"reserve",undefined,dependencies(1))).json()).data.caseId;
  await handleCase(request(1,{expectedVersion:1,noticeToken:null,messageText:"Synthetic program dispute",disputeText:null,relatedCaseId:null}),"draft-save",caseId,dependencies(1));
  await handleCase(request(1,{caseId,expectedDraftVersion:2}),"submit","",dependencies(1));
  const assess=async()=>{
    const current=(await (await handleCase(request(1),"detail",caseId,dependencies(1))).json()).data;
    return (await (await handleCase(request(1,{expectedEvidenceVersion:current.evidenceVersion,includeAi:false}),"assess",caseId,dependencies(1))).json()).data;
  };
  await db.query(`insert into public.synthetic_program_inputs(case_id,version,recipient_match,enrollment,monthly_income_minor,recorded_by)
    values($1,1,'MATCH','ACTIVE',750000,$2)`,[caseId,id(5)]);
  const old=await assess();
  assert.equal(old.findings.eligibility.result,"ELIGIBLE");
  const current=(await (await handleRules(request(5),"current",dependencies(5))).json()).data.rule;
  await handleRules(request(5,{programRef:"program_demo",expectedCurrentVersion:current.version,parameters:{...current.parameters,maxMonthlyIncomeMinor:700000}}),"publish",dependencies(5));
  const changed=await assess();
  assert.equal(changed.findings.eligibility.result,"INELIGIBLE");
  assert.deepEqual(changed.findings.eligibility.reasonCodes,["RULE_THRESHOLD_EXCEEDED"]);
  assert.equal(changed.findings.payment.result,"UNKNOWN");
  assert.deepEqual((await (await handleCase(request(1),"trace",caseId,dependencies(1),old.id)).json()).data,old);
  await db.query(`insert into public.synthetic_program_inputs(case_id,version,recipient_match,enrollment,monthly_income_minor,recorded_by)
    values($1,2,'AMBIGUOUS','ACTIVE',100,$2)`,[caseId,id(5)]);
  assert.equal((await assess()).findings.eligibility.result,"UNKNOWN");
  await assert.rejects(db.query("update public.synthetic_program_inputs set monthly_income_minor=0 where case_id=$1",[caseId]),/immutable/);
});

test("new Assessments use the published rule immediately and retain historical references", async () => {
  const caseId = (await (await handleConsent(request(1, {}), "reserve", undefined, dependencies(1))).json()).data.caseId;
  const first = (await (await handleCase(request(1, {expectedEvidenceVersion:1,includeAi:false}), "assess", caseId, dependencies(1))).json()).data;
  const published=(await (await handleRules(request(5),"current",dependencies(5))).json()).data.rule;
  const next = (await (await handleRules(request(5, {programRef:"program_demo",expectedCurrentVersion:published.version,
    parameters:{maxMonthlyIncomeMinor:700000,minRoutingConfidence:0.8,integrityFailurePriority:"HIGH"}}), "publish", dependencies(5))).json()).data.rule;
  const current = (await (await handleCase(request(1, {expectedEvidenceVersion:1,includeAi:false}), "assess", caseId, dependencies(1))).json()).data;
  assert.equal(current.ruleVersionId, next.id);
  assert.ok(!current.missingEvidence.includes("rule_basis_unavailable"));
  assert.equal(current.findings.eligibility.result, "UNKNOWN");
  assert.notEqual(first.ruleVersionId, current.ruleVersionId);
  assert.deepEqual((await (await handleCase(request(1), "trace", caseId, dependencies(1), first.id)).json()).data, first);
});
