// Real development Supabase Auth/PostgreSQL and the production HTTP server. Synthetic data only.
import assert from "node:assert/strict";
import {test} from "node:test";
import {setTimeout as delay} from "node:timers/promises";
import {connectDatabase} from "../../scripts/database";
import {AssessmentSchema,CaseSchema,type RuleParameters} from "../../src/contracts/v1";
import {CaseDecisionsResponseSchema,DispatchResponseSchema,EvidenceListResponseSchema,OfficerQueueResponseSchema,ResolutionResponseSchema,StaffQueueResponseSchema} from "../../src/lib/officer-contract";

const base=process.env.B04_BASE_URL ?? "http://localhost:3400";
const origin=new URL(base).origin;
const approved:RuleParameters={maxMonthlyIncomeMinor:800000,minRoutingConfidence:0.8,integrityFailurePriority:"HIGH"};

test("B04 live officer workflow, published rules and transactional resolution",async(t)=>{
  // Node's name filter includes descendants of matching parents. Keep diagnosis explicit.
  const selected=process.env.B04_LIVE_SCENARIO;
  const scenario=(name:string,work:()=>Promise<void>)=>t.test(name,{skip:!!selected && !name.includes(selected) && !name.startsWith("real Auth")},work);
  const db=await connectDatabase();
  const observer=await connectDatabase();
  const cookies=new Map<string,string>();
  const ids=new Map<string,string>();
  let departmentId="";
  const call=(path:string,actor:string,body?:unknown,key=crypto.randomUUID(),method=body===undefined ? "GET" : "POST")=>fetch(base+"/api/v1"+path,{
    method,headers:{cookie:cookies.get(actor)!,origin,...(body===undefined ? {} : {"content-type":"application/json","idempotency-key":key})},
    ...(body===undefined ? {} : {body:JSON.stringify(body)}),
  });
  async function data(path:string,actor:string,body?:unknown,status=body===undefined ? 200 : 200,method?:string) {
    const response=await call(path,actor,body,crypto.randomUUID(),method);
    assert.equal(response.status,status,path+" status");
    return (await response.json()).data;
  }
  const detail=async(caseId:string)=>CaseSchema.parse(await data(`/cases/${caseId}`,"CITIZEN_A"));
  const assess=async(caseId:string)=>AssessmentSchema.parse(await data(`/cases/${caseId}/assessments`,"OFFICER",{expectedEvidenceVersion:(await detail(caseId)).evidenceVersion,includeAi:false},201));
  async function publish(parameters=approved) {
    const response=await call("/rules/current","ADMIN");
    assert.ok([200,404].includes(response.status));
    const current=response.status===200 ? (await response.json()).data.rule : null;
    return (await data("/rules/publish","ADMIN",{programRef:"program_demo",expectedCurrentVersion:current?.version ?? null,parameters},201)).rule;
  }
  async function workflow() {
    const reservation=await data("/case-drafts","CITIZEN_A",{},201);
    const caseId=reservation.caseId;
    await data(`/case-drafts/${caseId}`,"CITIZEN_A",{expectedVersion:1,noticeToken:null,messageText:"Synthetic B04 private dispute",disputeText:"Synthetic missing payment",relatedCaseId:null},200,"PATCH");
    const grant=await data(`/cases/${caseId}/consents`,"CITIZEN_A",{recipientType:"DEPARTMENT",recipientId:departmentId,purpose:"synthetic_department_review",
      actions:["READ_CASE","READ_EVIDENCE","REQUEST_ASSESSMENT","REVIEW_CASE","RESOLVE_CASE","CLOSE_CASE","ASSIGN_CASE","ESCALATE_CASE"],expiresAt:new Date(Date.now()+3600000).toISOString()},201);
    const submitted=await data("/cases","CITIZEN_A",{caseId,expectedDraftVersion:2},201);
    const assigned=DispatchResponseSchema.parse(await (await call(`/cases/${caseId}/assign`,"ADMIN",{expectedVersion:submitted.version,departmentId,officerId:ids.get("OFFICER"),reason:"Synthetic department dispatch"})).json()).data;
    const review=await data(`/cases/${caseId}/start-review`,"OFFICER",{expectedVersion:assigned.version});
    const assessment=AssessmentSchema.parse(await data(`/cases/${caseId}/assessments`,"OFFICER",{expectedEvidenceVersion:review.case.evidenceVersion,includeAi:false},201));
    return {caseId,grant,record:CaseSchema.parse(review.case),assessment,body:{expectedVersion:review.case.version,reviewedAssessmentId:assessment.id,reason:"Reviewed synthetic dispute; unknown payment remains unknown. Case disposition authorizes no payment."}};
  }
  async function waitForBlocker(pid:number) {
    // Includes verified Auth, connection setup and deterministic reassessment before the SQL barrier.
    // Production transaction lock_timeout remains 15s; observing a blocker is still mandatory.
    const deadline=Date.now()+30000;
    while(Date.now()<deadline) {
      const {rows}=await observer.query("select pid from pg_stat_activity where $1::int=any(pg_blocking_pids(pid))",[pid]);
      if (rows.length) return Number(rows[0].pid);
      await delay(40);
    }
    throw new Error("B04 database lock barrier not reached");
  }
  async function removeBarrier() {
    await db.query("drop trigger if exists b04_live_barrier on public.audit_events");
    await db.query("drop function if exists public.b04_live_barrier()");
  }
  try {
    await scenario("real Auth, applied migrations, restricted publication and approved synthetic policy",async()=>{
      for (const actor of ["CITIZEN_A","CITIZEN_B","HELPER","OFFICER","ADMIN","AUDITOR"]) {
        const response=await fetch(base+"/api/v1/auth/login",{method:"POST",headers:{origin,"content-type":"application/json"},
          body:JSON.stringify({email:actor.toLowerCase().replaceAll("_","-")+"@demo.sanad.test",password:process.env["DEMO_"+actor+"_PASSWORD"]})});
        assert.equal(response.status,200,actor+" login");
        const identity=(await response.json()).data;
        ids.set(actor,identity.principal.id);
        cookies.set(actor,response.headers.get("set-cookie")!.split(";")[0]);
        if(actor==="OFFICER") departmentId=identity.departmentIds[0];
        if(actor==="ADMIN") assert.ok(identity.departmentIds.includes(departmentId),"Admin dispatch membership seeded");
      }
      const {rows}=await db.query("select name from sanad_private.migrations");
      assert.ok(rows.some(row=>row.name==="20261121001000_synthetic_program_inputs.sql"));
      for (const actor of ["CITIZEN_A","HELPER","OFFICER","AUDITOR"]) assert.equal((await call("/rules/publish",actor,{programRef:"program_demo",expectedCurrentVersion:null,parameters:approved})).status,403);
      const rule=await publish();
      assert.deepEqual(rule.parameters,approved);
      await assert.rejects(db.query("update public.rule_versions set parameters='{}' where id=$1",[rule.id]),{code:"23514"});
      await assert.rejects(db.query("delete from public.rule_versions where id=$1",[rule.id]),{code:"23514"});
    });
    await scenario("dispatch metadata, officer queue and direct private evidence denials",async()=>{
      const {caseId}=await workflow();
      const dispatch=StaffQueueResponseSchema.parse(await (await call("/admin/dispatch?limit=100","ADMIN")).json()).data;
      assert.ok(dispatch.items.some(item=>item.caseId===caseId));
      assert.equal(JSON.stringify(dispatch).includes("Synthetic B04 private"),false);
      assert.ok(dispatch.items.every(item=>!("citizenId" in item) && !("confidence" in item)));
      const queue=OfficerQueueResponseSchema.parse(await (await call("/cases?sort=confidence&status=UNDER_REVIEW&limit=100","OFFICER")).json()).data;
      assert.ok(queue.items.some(item=>item.caseId===caseId && item.confidence===null));
      for(const actor of ["CITIZEN_B","HELPER","ADMIN","AUDITOR"]) {
        assert.equal((await call(`/cases/${caseId}/evidence`,actor)).status,403);
        assert.equal((await call(`/cases/${caseId}/decisions`,actor)).status,403);
      }
      const evidence=EvidenceListResponseSchema.parse(await (await call(`/cases/${caseId}/evidence`,"OFFICER")).json());
      assert.equal(evidence.data.items.length,2);
      const audit=await data(`/audit?caseId=${caseId}`,"AUDITOR");
      assert.ok(audit.items.some((event:{action:string})=>event.action==="CASE_ASSIGNED"));
      assert.equal(JSON.stringify(audit).includes("Synthetic B04 private"),false);
    });
    await scenario("evidence requests, Citizen resubmission and escalation follow ADR 0004",async()=>{
      const {caseId,record}=await workflow();
      assert.equal((await call(`/cases/${caseId}/close`,"OFFICER",{expectedVersion:record.version})).status,409);
      const requested=await data(`/cases/${caseId}/request-evidence`,"OFFICER",{expectedVersion:record.version,reason:"Add a synthetic account of the dispute"});
      const added=await data(`/cases/${caseId}/evidence`,"CITIZEN_A",{expectedVersion:requested.case.version,kind:"CITIZEN_STATEMENT",content:{text:"Additional synthetic evidence"},supersedesId:null},201);
      const resubmitted=await data(`/cases/${caseId}/resubmit`,"CITIZEN_A",{expectedVersion:added.caseVersion});
      assert.equal(resubmitted.case.status,"SUBMITTED");
      const escalated=await data(`/cases/${caseId}/escalate`,"OFFICER",{expectedVersion:resubmitted.case.version,reason:"Synthetic senior review required"});
      assert.equal(escalated.case.status,"SUBMITTED");
      assert.equal(escalated.case.priority,"HIGH");
    });
    await scenario("published income changes affect fresh findings while historical rules and Assessments remain intact",async()=>{
      const {caseId}=await workflow();
      await db.query(`insert into public.synthetic_program_inputs(case_id,version,recipient_match,enrollment,monthly_income_minor,recorded_by)
        values($1,1,'MATCH','ACTIVE',750000,$2)`,[caseId,ids.get("ADMIN")]);
      const first=await assess(caseId);
      assert.equal(first.findings.eligibility.result,"ELIGIBLE");
      const changed=await publish({...approved,maxMonthlyIncomeMinor:700000});
      const current=await assess(caseId);
      assert.equal(current.findings.eligibility.result,"INELIGIBLE");
      assert.equal(current.ruleVersionId,changed.id);
      assert.deepEqual(await data(`/cases/${caseId}/assessments/${first.id}/trace`,"OFFICER"),first);
      assert.equal((await data(`/rules/${first.ruleVersionId}`,"OFFICER")).rule.parameters.maxMonthlyIncomeMinor,800000);
      assert.equal((await call(`/cases/${caseId}/program-inputs`,"ADMIN")).status,403);
      assert.equal((await data(`/cases/${caseId}/program-inputs`,"OFFICER")).items[0].source,"SYNTHETIC_DEMO");
      await publish();
    });
    await scenario("stale evidence and newly published rules prevent resolution",async()=>{
      const {caseId,record,body}=await workflow();
      const added=await data(`/cases/${caseId}/evidence`,"CITIZEN_A",{expectedVersion:record.version,kind:"CITIZEN_STATEMENT",content:{text:"Changed evidence"},supersedesId:null},201);
      assert.equal((await call(`/cases/${caseId}/resolve`,"OFFICER",body)).status,409);
      const stale=await call(`/cases/${caseId}/resolve`,"OFFICER",{...body,expectedVersion:added.caseVersion});
      assert.equal((await stale.json()).error.code,"STALE_ASSESSMENT");
      const assessment=await assess(caseId);
      await publish();
      const staleRule=await call(`/cases/${caseId}/resolve`,"OFFICER",{...body,expectedVersion:added.caseVersion,reviewedAssessmentId:assessment.id});
      assert.equal((await staleRule.json()).error.code,"STALE_ASSESSMENT");
    });
    await scenario("revoked department consent blocks resolution and preserves pending-consent history",async()=>{
      const {caseId,grant,body}=await workflow();
      await data(`/consents/${grant.id}/revoke`,"CITIZEN_A",{expectedVersion:grant.version});
      assert.equal((await call(`/cases/${caseId}/resolve`,"OFFICER",body)).status,403);
      assert.equal((await detail(caseId)).status,"PENDING_CONSENT");
      assert.equal((await call(`/cases/${caseId}/evidence`,"OFFICER")).status,403);
    });
    await scenario("concurrent resolutions with distinct keys cannot both commit",async()=>{
      const {caseId,body}=await workflow();
      const responses=await Promise.all([call(`/cases/${caseId}/resolve`,"OFFICER",body),call(`/cases/${caseId}/resolve`,"OFFICER",body)]);
      assert.deepEqual(responses.map(response=>response.status).sort(),[200,409]);
      const decisions=CaseDecisionsResponseSchema.parse(await (await call(`/cases/${caseId}/decisions`,"OFFICER")).json()).data;
      assert.equal(decisions.items.filter(decision=>decision.action==="CASE_RESOLVED").length,1);
    });
    await scenario("a concurrent source append commits first and prevents the blocked stale decision",async()=>{
      const {caseId,body}=await workflow();
      await db.query("begin");
      const {rows:[connection]}=await db.query("select pg_backend_pid() as pid");
      await db.query("select id from public.case_reservations where id=$1 for update",[caseId]);
      const pending=call(`/cases/${caseId}/resolve`,"OFFICER",body);
      try {
        await waitForBlocker(Number(connection.pid));
        await db.query(`insert into public.synthetic_program_inputs(case_id,version,recipient_match,enrollment,monthly_income_minor,recorded_by)
          values($1,1,'MATCH','ACTIVE',750000,$2)`,[caseId,ids.get("ADMIN")]);
        await db.query("commit");
      } catch(error) {await db.query("rollback");await pending;throw error;}
      const response=await pending;
      assert.equal(response.status,409);
      assert.equal((await detail(caseId)).status,"UNDER_REVIEW");
    });
    await scenario("publication-first lock ordering rejects the reviewed old rule through actual HTTP",async()=>{
      const {caseId,body}=await workflow();
      const current=(await data("/rules/current","ADMIN")).rule;
      await db.query(`create function public.b04_live_barrier() returns trigger language plpgsql as $$ begin
        if new.action='RULE_PUBLISHED' and new.outcome='ALLOWED' then perform pg_advisory_xact_lock(20261121,404); end if; return new; end $$`);
      await db.query("create trigger b04_live_barrier before insert on public.audit_events for each row execute function public.b04_live_barrier()");
      await db.query("begin");
      const {rows:[connection]}=await db.query("select pg_backend_pid() as pid");
      await db.query("select pg_advisory_xact_lock(20261121,404)");
      const publication=call("/rules/publish","ADMIN",{programRef:"program_demo",expectedCurrentVersion:current.version,parameters:approved});
      let resolution:Promise<Response>|undefined;
      try {
        const publisher=await waitForBlocker(Number(connection.pid));
        resolution=call(`/cases/${caseId}/resolve`,"OFFICER",body);
        await waitForBlocker(publisher);
        await db.query("commit");
        assert.equal((await publication).status,201);
        assert.equal((await resolution).status,409);
      } finally {await db.query("rollback");await publication;await resolution;await removeBarrier();}
    });
    await scenario("resolution-first lock ordering retains its historical rule while publication waits",async()=>{
      const {caseId,body,assessment}=await workflow();
      const current=(await data("/rules/current","ADMIN")).rule;
      await db.query(`create function public.b04_live_barrier() returns trigger language plpgsql as $$ begin
        if new.action='CASE_RESOLVED' and new.target_id='${caseId}'::uuid and new.outcome='ALLOWED' then perform pg_advisory_xact_lock(20261121,404); end if; return new; end $$`);
      await db.query("create trigger b04_live_barrier before insert on public.audit_events for each row execute function public.b04_live_barrier()");
      await db.query("begin");
      const {rows:[connection]}=await db.query("select pg_backend_pid() as pid");
      await db.query("select pg_advisory_xact_lock(20261121,404)");
      const resolution=call(`/cases/${caseId}/resolve`,"OFFICER",body);
      let publication:Promise<Response>|undefined;
      try {
        const resolver=await waitForBlocker(Number(connection.pid));
        publication=call("/rules/publish","ADMIN",{programRef:"program_demo",expectedCurrentVersion:current.version,parameters:approved});
        await waitForBlocker(resolver);
        await db.query("commit");
        const result=ResolutionResponseSchema.parse(await (await resolution).json()).data;
        assert.equal((await publication).status,201);
        const final=await data(`/cases/${caseId}/assessments/${result.assessmentId}/trace`,"OFFICER");
        assert.equal(final.ruleVersionId,assessment.ruleVersionId);
      } finally {await db.query("rollback");await resolution;await publication;await removeBarrier();}
    });
    await scenario("failed audit atomically rolls back the final assessment, decision, state and retry outcome",async()=>{
      const {caseId,body,assessment}=await workflow();
      const history=await data(`/cases/${caseId}/history`,"OFFICER");
      await db.query(`create function public.b04_live_barrier() returns trigger language plpgsql as $$ begin
        if new.action='CASE_RESOLVED' and new.target_id='${caseId}'::uuid and new.outcome='ALLOWED' then raise exception 'Synthetic B04 audit outage'; end if; return new; end $$`);
      await db.query("create trigger b04_live_barrier before insert on public.audit_events for each row execute function public.b04_live_barrier()");
      const key=crypto.randomUUID();
      try {assert.equal((await call(`/cases/${caseId}/resolve`,"OFFICER",body,key)).status,503);}
      finally {await removeBarrier();}
      assert.equal((await detail(caseId)).status,"UNDER_REVIEW");
      assert.deepEqual(await data(`/cases/${caseId}/history`,"OFFICER"),history);
      assert.equal((await data(`/cases/${caseId}/evidence-passport`,"OFFICER")).assessmentId,assessment.id);
      assert.equal((await call(`/cases/${caseId}/resolve`,"OFFICER",body,key)).status,200);
    });
    await scenario("working authorized resolution example, immutable explanation, close and withdrawal-safe retry",async()=>{
      const {caseId,body,grant}=await workflow();
      const key=crypto.randomUUID();
      const first=await call(`/cases/${caseId}/resolve`,"OFFICER",body,key);
      assert.equal(first.status,200);
      const result=ResolutionResponseSchema.parse(await first.json()).data;
      assert.deepEqual((await (await call(`/cases/${caseId}/resolve`,"OFFICER",body,key)).json()).data,result);
      assert.equal((await data(`/cases/${caseId}/close`,"OFFICER",{expectedVersion:result.case.version})).case.status,"CLOSED");
      const decisions=CaseDecisionsResponseSchema.parse(await (await call(`/cases/${caseId}/decisions`,"OFFICER")).json()).data;
      assert.equal(decisions.items.find(decision=>decision.id===result.resolutionId)!.reason,body.reason);
      await data(`/consents/${grant.id}/revoke`,"CITIZEN_A",{expectedVersion:grant.version});
      assert.equal((await call(`/cases/${caseId}/resolve`,"OFFICER",body,key)).status,403);
      assert.equal((await detail(caseId)).status,"CLOSED");
      console.log("B04 observed example:",JSON.stringify({caseId,assessmentId:result.assessmentId,resolutionId:result.resolutionId,status:"CLOSED"}));
    });
  } finally {
    await db.query("rollback");
    await removeBarrier();
    for(const actor of cookies.keys()) await call("/auth/logout",actor,{});
    await db.end();await observer.end();
  }
});
