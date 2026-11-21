import assert from "node:assert/strict";
import { test } from "node:test";
import { handleStaffQueue, handleOfficerAction } from "../../src/backend/officers/http";
import { handleConsent } from "../../src/backend/consent/http";
import { handleCase } from "../../src/backend/cases/http";
import { handleRules } from "../../src/backend/rules/http";
import { handleCaseRecords, handleAudit } from "../../src/backend/officers/reads";
import { db, id, request, dependencies } from "../support/case-fixture";

async function submitted() {
  const caseId = (await (await handleConsent(request(1, {}), "reserve", undefined, dependencies(1))).json()).data.caseId;
  await handleCase(request(1, { expectedVersion: 1, noticeToken: null, messageText: "Synthetic private input", disputeText: null, relatedCaseId: null }), "draft-save", caseId, dependencies(1));
  await handleConsent(request(1, { recipientType: "DEPARTMENT", recipientId: id(30), purpose: "synthetic_department_review",
    actions: ["READ_CASE", "READ_EVIDENCE", "REVIEW_CASE", "REQUEST_ASSESSMENT", "RESOLVE_CASE", "CLOSE_CASE", "ASSIGN_CASE", "ESCALATE_CASE"], expiresAt: new Date(Date.now() + 3600000).toISOString() }), "grant", caseId, dependencies(1));
  const response = await handleCase(request(1, { caseId, expectedDraftVersion: 2 }), "submit", "", dependencies(1));
  assert.equal(response.status, 201);
  return (await response.json()).data;
}

test("staff queue rejects other roles; department admin dispatch exposes only minimal metadata", async () => {
  const record = await submitted();
  for (const actor of [1,3,6]) assert.equal((await handleStaffQueue(request(actor), "officer", dependencies(actor))).status, 403);
  assert.equal((await handleStaffQueue(request(4), "dispatch", dependencies(4))).status, 403);
  const response = await handleStaffQueue(request(5), "dispatch", dependencies(5));
  assert.equal(response.status, 200);
  const item = (await response.json()).data.items.find((item: { caseId: string }) => item.caseId === record.id);
  assert.deepEqual(Object.keys(item).sort(), ["assignedOfficerId","caseId","createdAt","departmentId","priority","status","updatedAt","version"]);
  assert.equal(item.departmentId, id(30));
  assert.equal((await handleCase(request(5), "passport", record.id, dependencies(5))).status, 403);
  assert.equal((await handleCase(request(4), "passport", record.id, dependencies(4))).status, 403);
  assert.equal((await (await handleStaffQueue(request(4), "officer", dependencies(4))).json()).data.items.length, 0);
});

test("resolution refuses UNAVAILABLE basis; fresh authorized review appends a final Assessment and resolves the Case", async () => {
  const record = await submitted();
  const assigned = (await (await handleOfficerAction(request(5, {expectedVersion:record.version,departmentId:id(30),officerId:id(4),reason:"Synthetic dispatch"}), "assign", record.id, dependencies(5))).json()).data;
  const review = (await (await handleOfficerAction(request(4, {expectedVersion:assigned.version}), "start-review", record.id, dependencies(4))).json()).data.case;
  const assess = async () => (await (await handleCase(request(4, {expectedEvidenceVersion:review.evidenceVersion,includeAi:false}), "assess", record.id, dependencies(4))).json()).data;
  const unavailable = await assess();
  const body = {expectedVersion:review.version,reviewedAssessmentId:unavailable.id,reason:"Reviewed synthetic dispute; source records unavailable. This disposition authorizes no payment."};
  const denied = await handleOfficerAction(request(4,body), "resolve",record.id,dependencies(4));
  assert.equal(denied.status,409);
  assert.equal((await denied.json()).error.code,"STALE_ASSESSMENT");
  assert.equal((await handleRules(request(5,{programRef:"program_demo",expectedCurrentVersion:null,parameters:{maxMonthlyIncomeMinor:800000,minRoutingConfidence:0.8,integrityFailurePriority:"HIGH"}}),"publish",dependencies(5))).status,201);
  const reviewed = await assess();
  const input={...body,reviewedAssessmentId:reviewed.id};
  for (const actor of [1,3,5,6]) assert.equal((await handleOfficerAction(request(actor,input),"resolve",record.id,dependencies(actor))).status,403);
  const key=crypto.randomUUID();
  const response=await handleOfficerAction(request(4,input,key),"resolve",record.id,dependencies(4));
  assert.equal(response.status,200);
  const resolution=(await response.json()).data;
  assert.equal(resolution.case.status,"RESOLVED");
  assert.notEqual(resolution.assessmentId,reviewed.id);
  assert.ok(resolution.resolutionId);
  const final=(await (await handleCase(request(4),"trace",record.id,dependencies(4),resolution.assessmentId)).json()).data;
  assert.equal(final.ruleVersionId,reviewed.ruleVersionId);
  assert.equal(final.findings.payment.result,"UNKNOWN");
  assert.equal(final.findings.eligibility.result,"UNKNOWN");
  assert.deepEqual((await (await handleCase(request(4),"trace",record.id,dependencies(4),reviewed.id)).json()).data,reviewed);
  assert.deepEqual((await (await handleOfficerAction(request(4,input,key),"resolve",record.id,dependencies(4))).json()).data,resolution);
  assert.equal((await handleOfficerAction(request(4,input),"resolve",record.id,dependencies(4))).status,409);
});

async function reviewedCase() {
  const record=await submitted();
  const assigned=(await (await handleOfficerAction(request(5,{expectedVersion:record.version,departmentId:id(30),officerId:id(4),reason:"Synthetic dispatch"}),"assign",record.id,dependencies(5))).json()).data;
  const review=(await (await handleOfficerAction(request(4,{expectedVersion:assigned.version}),"start-review",record.id,dependencies(4))).json()).data.case;
  const assessment=(await (await handleCase(request(4,{expectedEvidenceVersion:review.evidenceVersion,includeAi:false}),"assess",record.id,dependencies(4))).json()).data;
  return {record:review,assessment,body:{expectedVersion:review.version,reviewedAssessmentId:assessment.id,reason:"Reasoned synthetic case disposition; no payment approval"}};
}

test("evidence and rule changes invalidate reviewed Assessments; revoked consent prevents resolution and replay",async()=>{
  const {record,assessment,body}=await reviewedCase();
  const added=(await (await handleCase(request(1,{expectedVersion:record.version,kind:"CITIZEN_STATEMENT",content:{text:"New synthetic evidence"},supersedesId:null}),"evidence-add",record.id,dependencies(1))).json()).data;
  assert.equal((await handleOfficerAction(request(4,body),"resolve",record.id,dependencies(4))).status,409);
  const stale=await handleOfficerAction(request(4,{...body,expectedVersion:added.caseVersion}),"resolve",record.id,dependencies(4));
  assert.equal((await stale.json()).error.code,"STALE_ASSESSMENT");
  const next=(await (await handleCase(request(4,{expectedEvidenceVersion:added.evidenceVersion,includeAi:false}),"assess",record.id,dependencies(4))).json()).data;
  const current=(await (await handleRules(request(5),"current",dependencies(5))).json()).data.rule;
  assert.equal((await handleRules(request(5,{programRef:"program_demo",expectedCurrentVersion:current.version,parameters:{...current.parameters,maxMonthlyIncomeMinor:700000}}),"publish",dependencies(5))).status,201);
  const staleRule=await handleOfficerAction(request(4,{...body,expectedVersion:added.caseVersion,reviewedAssessmentId:next.id}),"resolve",record.id,dependencies(4));
  assert.equal((await staleRule.json()).error.code,"STALE_ASSESSMENT");
  assert.deepEqual((await (await handleCase(request(1),"trace",record.id,dependencies(1),assessment.id)).json()).data,assessment);
  const grants=(await (await handleConsent(request(1),"list",record.id,dependencies(1))).json()).data.items;
  assert.equal((await handleConsent(request(1,{expectedVersion:grants[0].version}),"revoke",grants[0].id,dependencies(1))).status,200);
  assert.equal((await handleOfficerAction(request(4,{...body,expectedVersion:added.caseVersion}),"resolve",record.id,dependencies(4))).status,403);
  assert.equal((await handleCase(request(4),"passport",record.id,dependencies(4))).status,403);
});

test("failed success audit rolls back the final Assessment, decision and state; immutable decision history survives closure",async()=>{
  const {record,assessment,body}=await reviewedCase();
  const before=(await (await handleCase(request(1),"history",record.id,dependencies(1))).json()).data;
  await db.exec(`create function public.b04_test_audit_failure() returns trigger language plpgsql as $$ begin
    if new.action='CASE_RESOLVED' and new.outcome='ALLOWED' then raise exception 'Synthetic audit failure'; end if; return new; end $$;
    create trigger b04_test_audit before insert on public.audit_events for each row execute function public.b04_test_audit_failure();`);
  try {assert.equal((await handleOfficerAction(request(4,body),"resolve",record.id,dependencies(4))).status,503);}
  finally {await db.exec("drop trigger b04_test_audit on public.audit_events; drop function public.b04_test_audit_failure();");}
  assert.equal((await (await handleCase(request(1),"detail",record.id,dependencies(1))).json()).data.status,"UNDER_REVIEW");
  assert.deepEqual((await (await handleCase(request(1),"history",record.id,dependencies(1))).json()).data,before);
  assert.equal((await (await handleCase(request(1),"passport",record.id,dependencies(1))).json()).data.assessmentId,assessment.id);
  const key=crypto.randomUUID();
  const result=(await (await handleOfficerAction(request(4,body,key),"resolve",record.id,dependencies(4))).json()).data;
  const closed=await handleOfficerAction(request(4,{expectedVersion:result.case.version}),"close",record.id,dependencies(4));
  assert.equal(closed.status,200);
  assert.equal((await closed.json()).data.case.status,"CLOSED");
  await assert.rejects(db.query("delete from public.case_decisions where id=$1",[result.resolutionId]),/immutable/);
  const grant=(await (await handleConsent(request(1),"list",record.id,dependencies(1))).json()).data.items[0];
  await handleConsent(request(1,{expectedVersion:grant.version}),"revoke",grant.id,dependencies(1));
  assert.equal((await handleOfficerAction(request(4,body,key),"resolve",record.id,dependencies(4))).status,403);
  assert.equal((await (await handleCase(request(1),"detail",record.id,dependencies(1))).json()).data.status,"CLOSED");
});

test("private evidence and decision explanations require evidence permission; auditors see minimal immutable audit metadata", async () => {
  const record=await submitted();
  const assigned=(await (await handleOfficerAction(request(5,{expectedVersion:record.version,departmentId:id(30),officerId:id(4),reason:"Private synthetic dispatch explanation"}),"assign",record.id,dependencies(5))).json()).data;
  for (const actor of [3,5,6]) {
    assert.equal((await handleCaseRecords(request(actor),"evidence",record.id,dependencies(actor))).status,403);
    assert.equal((await handleCaseRecords(request(actor),"decisions",record.id,dependencies(actor))).status,403);
  }
  const evidence=await handleCaseRecords(request(4),"evidence",record.id,dependencies(4));
  assert.equal(evidence.status,200);
  assert.equal((await evidence.json()).data.items[0].content.messageText,"Synthetic private input");
  const decisions=await handleCaseRecords(request(4),"decisions",record.id,dependencies(4));
  assert.equal(decisions.status,200);
  const decision=(await decisions.json()).data.items[0];
  assert.equal(decision.reason,"Private synthetic dispatch explanation");
  assert.equal(decision.caseVersion,assigned.version);
  const audit=await handleAudit(request(6),record.id,dependencies(6));
  assert.equal(audit.status,200);
  const events=(await audit.json()).data.items;
  assert.ok(events.some((event:{action:string})=>event.action==="CASE_ASSIGNED"));
  assert.equal(JSON.stringify(events).includes("Private synthetic"),false);
  assert.equal((await handleAudit(request(4),record.id,dependencies(4))).status,403);
});

test("department admin assigns with a version and reason; only assigned officer starts review", async () => {
  const record = await submitted();
  const input = { expectedVersion: record.version, departmentId: id(30), officerId: id(4), reason: "Synthetic department dispatch" };
  assert.equal((await handleOfficerAction(request(4, input), "assign", record.id, dependencies(4))).status, 403);
  const response = await handleOfficerAction(request(5, input), "assign", record.id, dependencies(5));
  assert.equal(response.status, 200);
  const assigned = (await response.json()).data;
  assert.equal(assigned.assignedOfficerId, id(4));
  assert.equal(assigned.version, record.version + 1);
  assert.equal("citizenId" in assigned, false);
  assert.equal((await handleOfficerAction(request(5, input), "assign", record.id, dependencies(5))).status, 409);
  assert.equal((await handleOfficerAction(request(5, { expectedVersion: assigned.version }), "start-review", record.id, dependencies(5))).status, 403);
  const review = await handleOfficerAction(request(4, { expectedVersion: assigned.version }), "start-review", record.id, dependencies(4));
  assert.equal(review.status, 200);
  assert.equal((await review.json()).data.case.status, "UNDER_REVIEW");
  assert.equal((await handleOfficerAction(request(4, { expectedVersion: assigned.version+1 }), "start-review", record.id, dependencies(4))).status, 409);
  const history = (await (await handleCase(request(4), "history", record.id, dependencies(4))).json()).data.items;
  assert.ok(history.some((event: { action: string }) => event.action === "CASE_ASSIGNED"));
  assert.ok(history.some((event: { action: string }) => event.action === "REVIEW_STARTED"));
});

test("review requests evidence, Citizen adds and resubmits, escalation preserves state and closing requires resolution", async () => {
  const record=await submitted();
  const assigned=(await (await handleOfficerAction(request(5,{expectedVersion:record.version,departmentId:id(30),officerId:id(4),reason:"Dispatch"}),"assign",record.id,dependencies(5))).json()).data;
  let current=(await (await handleOfficerAction(request(4,{expectedVersion:assigned.version}),"start-review",record.id,dependencies(4))).json()).data.case;
  assert.equal((await handleOfficerAction(request(4,{expectedVersion:current.version}),"close",record.id,dependencies(4))).status,409);
  const requested=await handleOfficerAction(request(4,{expectedVersion:current.version,reason:"Please add a synthetic statement"}),"request-evidence",record.id,dependencies(4));
  assert.equal(requested.status,200);
  current=(await requested.json()).data.case;
  assert.equal(current.status,"NEEDS_EVIDENCE");
  assert.equal((await handleOfficerAction(request(1,{expectedVersion:current.version}),"resubmit",record.id,dependencies(1))).status,409);
  const added=(await (await handleCase(request(1,{expectedVersion:current.version,kind:"CITIZEN_STATEMENT",content:{text:"Additional synthetic evidence"},supersedesId:null}),"evidence-add",record.id,dependencies(1))).json()).data;
  const resubmitted=await handleOfficerAction(request(1,{expectedVersion:added.caseVersion}),"resubmit",record.id,dependencies(1));
  assert.equal(resubmitted.status,200);
  current=(await resubmitted.json()).data.case;
  assert.equal(current.status,"SUBMITTED");
  const escalated=await handleOfficerAction(request(4,{expectedVersion:current.version,reason:"Synthetic missing records need senior review"}),"escalate",record.id,dependencies(4));
  assert.equal(escalated.status,200);
  current=(await escalated.json()).data.case;
  assert.equal(current.priority,"HIGH");
  assert.equal(current.status,"SUBMITTED");
  assert.equal((await handleOfficerAction(request(6,{expectedVersion:current.version,reason:"Auditor cannot escalate"}),"escalate",record.id,dependencies(6))).status,403);
});

test("admin priority and reassignment require the exact shared department; losing membership blocks officer access", async () => {
  const record=await submitted();
  const body={expectedVersion:record.version,departmentId:id(30),officerId:id(4),reason:"Assign synthetic case"};
  const assigned=(await (await handleOfficerAction(request(5,body),"assign",record.id,dependencies(5))).json()).data;
  const priority=await handleOfficerAction(request(5,{expectedVersion:assigned.version,departmentId:id(30),priority:"HIGH",reason:"Synthetic urgent dispatch"}),"priority",record.id,dependencies(5));
  assert.equal(priority.status,200);
  assert.equal((await priority.json()).data.priority,"HIGH");
  await db.query("insert into public.departments(id,name) values($1,'Other synthetic department')",[id(31)]);
  await db.query("insert into public.department_memberships(profile_id,department_id) values($1,$2)",[id(5),id(31)]);
  assert.equal((await handleOfficerAction(request(5,{...body,expectedVersion:assigned.version+1,departmentId:id(31)}),"assign",record.id,dependencies(5))).status,403);
  await db.query("delete from public.department_memberships where profile_id=$1 and department_id=$2",[id(4),id(30)]);
  try {
    assert.equal((await handleCase(request(4),"detail",record.id,dependencies(4))).status,403);
    assert.equal((await handleOfficerAction(request(4,{expectedVersion:assigned.version+1}),"start-review",record.id,dependencies(4))).status,403);
  } finally { await db.query("insert into public.department_memberships(profile_id,department_id) values($1,$2)",[id(4),id(30)]); }
});

test("resubmission rechecks active department sharing at commit even for the Citizen owner",async()=>{
  const {record}=await reviewedCase();
  const requested=(await (await handleOfficerAction(request(4,{expectedVersion:record.version,reason:"Need additional synthetic evidence"}),"request-evidence",record.id,dependencies(4))).json()).data.case;
  const added=(await (await handleCase(request(1,{expectedVersion:requested.version,kind:"CITIZEN_STATEMENT",content:{text:"Additional evidence"},supersedesId:null}),"evidence-add",record.id,dependencies(1))).json()).data;
  await db.exec(`create function public.b04_test_withdraw_at_commit() returns trigger language plpgsql as $$ begin
    if new.action='CASE_RESUBMITTED' and new.outcome='ALLOWED' then update public.consent_grants set revoked_at=clock_timestamp() where case_id=new.target_id and recipient_type='DEPARTMENT' and revoked_at is null; end if; return new; end $$;
    create trigger b04_test_withdraw before insert on public.audit_events for each row execute function public.b04_test_withdraw_at_commit();`);
  try { assert.equal((await handleOfficerAction(request(1,{expectedVersion:added.caseVersion}),"resubmit",record.id,dependencies(1))).status,403); }
  finally {await db.exec("drop trigger b04_test_withdraw on public.audit_events; drop function public.b04_test_withdraw_at_commit();");}
  assert.equal((await (await handleCase(request(1),"detail",record.id,dependencies(1))).json()).data.status,"NEEDS_EVIDENCE");
});

test("reassignment immediately removes the previous officer's evidence authority; queue filters and cursor preserve null confidence",async()=>{
  const {record}=await reviewedCase();
  const filtered=request(4);
  filtered.nextUrl.searchParams.set("status","UNDER_REVIEW");
  filtered.nextUrl.searchParams.set("sort","confidence");
  filtered.nextUrl.searchParams.set("limit","1");
  const first=(await (await handleStaffQueue(filtered,"officer",dependencies(4))).json()).data;
  assert.equal(first.items.length,1);
  assert.equal(first.items[0].confidence,null);
  if (first.nextCursor) {
    filtered.nextUrl.searchParams.set("cursor",first.nextCursor);
    const next=(await (await handleStaffQueue(filtered,"officer",dependencies(4))).json()).data;
    assert.notEqual(next.items[0]?.caseId,first.items[0].caseId);
  }
  filtered.nextUrl.searchParams.set("sort","untrusted_sql");
  assert.equal((await handleStaffQueue(filtered,"officer",dependencies(4))).status,422);
  await db.query("insert into public.role_assignments(profile_id,role) values($1,'OFFICER')",[id(2)]);
  await db.query("insert into public.department_memberships(profile_id,department_id) values($1,$2)",[id(2),id(30)]);
  try {
    const reassigned=await handleOfficerAction(request(5,{expectedVersion:record.version,departmentId:id(30),officerId:id(2),reason:"Synthetic second reviewer assignment"}),"assign",record.id,dependencies(5));
    assert.equal(reassigned.status,200);
    assert.equal((await reassigned.json()).data.assignedOfficerId,id(2));
    assert.equal((await handleCaseRecords(request(4),"evidence",record.id,dependencies(4))).status,403);
    assert.equal((await handleCaseRecords(request(2),"evidence",record.id,dependencies(2))).status,200);
  } finally {
    await db.query("delete from public.department_memberships where profile_id=$1 and department_id=$2",[id(2),id(30)]);
    await db.query("delete from public.role_assignments where profile_id=$1 and role='OFFICER'",[id(2)]);
  }
});
