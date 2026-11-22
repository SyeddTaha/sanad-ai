// Synthetic records only. Real development Supabase Auth/PostgreSQL + production HTTP.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import SwaggerParser from "@apidevtools/swagger-parser";
import { connectDatabase } from "../../scripts/database";
import { ApiErrorEnvelopeSchema } from "../../src/contracts/v1";
import { IssueApiKeyResponseSchema, ApiKeyListResponseSchema } from "../../src/lib/api-key-contract";

const base = process.env.B05_BASE_URL || "http://localhost:3500";
const origin = new URL(base).origin;
test("B05 live scoped public API and credential lifecycle", async (t) => {
  const db = await connectDatabase();
  const observer = await connectDatabase();
  const cookies = new Map<string,string>();
  const ids = new Map<string,string>();
  const issuedIds: string[] = [];
  const secrets: string[] = [];
  const call = (path: string, credential: { actor?: string; key?: string }, body?: unknown, operationKey = crypto.randomUUID(), method = body === undefined ? "GET" : "POST") => fetch(base + "/api/v1" + path, {
    method, headers: { origin, ...(credential.key ? { "x-api-key": credential.key } : { cookie: cookies.get(credential.actor!)! }),
      ...(body === undefined ? {} : { "content-type": "application/json", "idempotency-key": operationKey }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  async function data(path: string, credential: {actor?: string; key?: string}, body?: unknown, status = 200, method?: string) {
    const response = await call(path, credential, body, crypto.randomUUID(), method);
    assert.equal(response.status, status, path + " status");
    return (await response.json()).data;
  }
  async function denied(path: string, key: string, status: number, code: string, body?: unknown, method?: string) {
    const response = await call(path, {key}, body, crypto.randomUUID(), method);
    assert.equal(response.status, status, path + " denial");
    assert.equal(ApiErrorEnvelopeSchema.parse(await response.json()).error.code, code);
  }
  async function issue(actor: string, scopes: string[]) {
    const response = await call("/api-keys", {actor}, {name: "B05 synthetic integration", scopes, expiresAt: new Date(Date.now()+3600000).toISOString()});
    assert.equal(response.status, 201);
    const issued = IssueApiKeyResponseSchema.parse(await response.json()).data;
    assert.ok(issued.key);
    secrets.push(issued.key!);
    issuedIds.push(issued.credential.id);
    return { key: issued.key!, credential: issued.credential };
  }
  async function sharedDraft() {
    const reservation = await data("/case-drafts", {actor:"CITIZEN_A"}, {}, 201);
    const grant = await data(`/cases/${reservation.caseId}/consents`, {actor:"CITIZEN_A"}, {recipientType:"PRINCIPAL",recipientId:ids.get("HELPER"),purpose:"synthetic_helper_assistance",
      actions:["READ_CASE","READ_EVIDENCE","WRITE_DRAFT","ADD_EVIDENCE","SUBMIT_CASE","REQUEST_ASSESSMENT"], expiresAt:new Date(Date.now()+3600000).toISOString()}, 201);
    return {caseId:reservation.caseId,grant};
  }
  let caseId = "";
  let grant: {id:string;version:number};
  let helper: Awaited<ReturnType<typeof issue>>;
  try {
    await t.test("real Auth identities, applied migration and valid public OpenAPI", async () => {
      for (const actor of ["CITIZEN_A","CITIZEN_B","HELPER","OFFICER","ADMIN","AUDITOR"]) {
        const response = await fetch(base + "/api/v1/auth/login", {method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify({
          email:actor.toLowerCase().replaceAll("_","-")+"@demo.sanad.test",password:process.env["DEMO_"+actor+"_PASSWORD"],
        })});
        assert.equal(response.status,200,actor+" login");
        ids.set(actor,(await response.json()).data.principal.id);
        cookies.set(actor,response.headers.get("set-cookie")!.split(";")[0]);
      }
      const {rows} = await db.query("select name from sanad_private.migrations where name='20261122001100_scoped_api_keys.sql'");
      assert.equal(rows.length,1);
      const response = await fetch(base + "/api/v1/openapi");
      assert.equal(response.status,200);
      const spec = await response.json();
      await SwaggerParser.validate(spec,{resolve:{external:false}});
      assert.deepEqual(spec.paths["/api/v1/cases/{caseId}"].get["x-api-key-scopes"],["READ_CASE"]);
    });
    await t.test("issue once, replay without a secret, metadata list and cryptographic hash only at rest", async () => {
      const body = {name:"B05 one-time credential",scopes:["READ_CASE","READ_EVIDENCE","WRITE_DRAFT","SUBMIT_CASE"],expiresAt:new Date(Date.now()+3600000).toISOString()};
      const operationKey = crypto.randomUUID();
      const issued = await call("/api-keys",{actor:"HELPER"},body,operationKey);
      assert.equal(issued.status,201);
      const result = IssueApiKeyResponseSchema.parse(await issued.json()).data;
      assert.ok(result.key && /^sanad_[A-Za-z0-9_-]{43}$/.test(result.key));
      helper = {key:result.key!,credential:result.credential};
      secrets.push(helper.key); issuedIds.push(helper.credential.id);
      const retry = await call("/api-keys",{actor:"HELPER"},body,operationKey);
      assert.equal(retry.status,200);
      assert.equal(IssueApiKeyResponseSchema.parse(await retry.json()).data.key,null);
      const listed = ApiKeyListResponseSchema.parse(await (await call("/api-keys?limit=100",{actor:"HELPER"})).json());
      assert.ok(listed.data.items.some(item=>item.id===helper.credential.id));
      assert.ok(!JSON.stringify(listed).includes(helper.key));
      // Storage security inspection, independent of public behavior assertions above.
      const {rows:[stored]} = await db.query("select secret_hash from public.api_keys where id=$1",[helper.credential.id]);
      assert.ok(stored.secret_hash === createHash("sha256").update(helper.key).digest("hex"),"only the hash is stored");
      const {rows:[retained]} = await db.query("select result from public.consent_operation_keys where actor_id=$1 and operation='api-key-issue' and key=$2",[ids.get("HELPER"),operationKey]);
      assert.ok(!JSON.stringify(retained).includes(helper.key),"idempotency contains no secret");
    });
    await t.test("valid scoped read and mutation, missing scope, cross-Citizen denial and role escalation denial", async () => {
      ({caseId,grant}=await sharedDraft());
      const saved = await data(`/case-drafts/${caseId}`,{key:helper.key},{expectedVersion:1,noticeToken:null,messageText:"Synthetic B05 private evidence",disputeText:null,relatedCaseId:null},200,"PATCH");
      assert.equal(saved.caseId,caseId);
      assert.equal((await data(`/case-drafts/${caseId}`,{key:helper.key})).messageText,"Synthetic B05 private evidence");
      const readOnly = await issue("HELPER",["READ_CASE"]);
      await denied(`/case-drafts/${caseId}`,readOnly.key,403,"INSUFFICIENT_SCOPE");
      const foreign = await data("/case-drafts",{actor:"CITIZEN_B"},{},201);
      await denied(`/case-drafts/${foreign.caseId}`,helper.key,403,"CONSENT_REQUIRED");
      const escalation = await call("/api-keys",{actor:"HELPER"},{name:"Escalation attempt",scopes:["RESOLVE_CASE"],expiresAt:new Date(Date.now()+3600000).toISOString()});
      assert.equal(escalation.status,403);
      await denied("/case-drafts",helper.key,403,"FORBIDDEN",{});
      await denied("/api-keys",helper.key,403,"FORBIDDEN",{});
      const submitted=await data("/cases",{key:helper.key},{caseId,expectedDraftVersion:saved.version},201);
      assert.equal(submitted.status,"PENDING_CONSENT");
      assert.equal((await data(`/cases/${caseId}`,{key:helper.key})).id,caseId);
    });
    await t.test("consent withdrawal blocks reads and completed idempotent responses immediately", async () => {
      const shared=await sharedDraft();
      const body={expectedVersion:1,noticeToken:null,messageText:"Synthetic B05 retry evidence",disputeText:null,relatedCaseId:null};
      const operationKey=crypto.randomUUID();
      assert.equal((await call(`/case-drafts/${shared.caseId}`,{key:helper.key},body,operationKey,"PATCH")).status,200);
      await data(`/consents/${shared.grant.id}/revoke`,{actor:"CITIZEN_A"},{expectedVersion:shared.grant.version});
      await denied(`/case-drafts/${shared.caseId}`,helper.key,403,"CONSENT_REQUIRED");
      const replay=await call(`/case-drafts/${shared.caseId}`,{key:helper.key},body,operationKey,"PATCH");
      assert.equal(replay.status,403);
      assert.ok(!(await replay.text()).includes(body.messageText));
    });
    await t.test("officer/admin keys reuse assignment, membership, review, escalation and close workflows",async()=>{
      const admin=await issue("ADMIN",["ASSIGN_CASE"]);
      const officer=await issue("OFFICER",["READ_CASE","READ_EVIDENCE","REVIEW_CASE","REQUEST_ASSESSMENT","RESOLVE_CASE","ESCALATE_CASE","CLOSE_CASE"]);
      const {rows:[membership]}=await db.query("select department_id from public.department_memberships where profile_id=$1 order by department_id limit 1",[ids.get("OFFICER")]);
      const departmentId=String(membership.department_id);
      await data(`/cases/${caseId}/consents`,{actor:"CITIZEN_A"},{recipientType:"DEPARTMENT",recipientId:departmentId,purpose:"synthetic_department_review",actions:["READ_CASE","READ_EVIDENCE","REVIEW_CASE","REQUEST_ASSESSMENT","RESOLVE_CASE","CLOSE_CASE","ASSIGN_CASE","ESCALATE_CASE"],expiresAt:new Date(Date.now()+3600000).toISOString()},201);
      const current=await data(`/cases/${caseId}`,{actor:"CITIZEN_A"});
      await denied(`/cases/${caseId}`,officer.key,403,"CONSENT_REQUIRED");
      await denied(`/cases/${caseId}`,admin.key,403,"INSUFFICIENT_SCOPE");
      const assigned=await data(`/cases/${caseId}/assign`,{key:admin.key},{expectedVersion:current.version,departmentId,officerId:ids.get("OFFICER"),reason:"Synthetic B05 dispatch"});
      let cursor: string | null = null;
      let queued = false;
      for (let page = 0; page < 20; page++) {
        const queue = await data("/cases?limit=100" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""), {key:officer.key});
        queued = queue.items.some((item:{caseId:string})=>item.caseId===caseId);
        cursor = queue.nextCursor;
        if (queued || !cursor) break;
      }
      assert.ok(queued,"Assigned synthetic Case appears through authorized queue pagination");
      const review=(await data(`/cases/${caseId}/start-review`,{key:officer.key},{expectedVersion:assigned.version})).case;
      const escalated=(await data(`/cases/${caseId}/escalate`,{key:officer.key},{expectedVersion:review.version,reason:"Synthetic escalation; payment remains unknown"})).case;
      const ruleResponse=await call("/rules/current",{actor:"ADMIN"});
      if(ruleResponse.status===404) await data("/rules/publish",{actor:"ADMIN"},{programRef:"program_demo",expectedCurrentVersion:null,parameters:{maxMonthlyIncomeMinor:800000,minRoutingConfidence:0.8,integrityFailurePriority:"HIGH"}},201);
      else assert.equal(ruleResponse.status,200);
      const assessment=await data(`/cases/${caseId}/assessments`,{key:officer.key},{expectedEvidenceVersion:escalated.evidenceVersion,includeAi:false},201);
      const resolved=await data(`/cases/${caseId}/resolve`,{key:officer.key},{expectedVersion:escalated.version,reviewedAssessmentId:assessment.id,reason:"Synthetic human disposition; unknown payment stays unknown and authorizes no payment."});
      assert.equal(resolved.case.status,"RESOLVED");
      assert.equal((await data(`/cases/${caseId}/close`,{key:officer.key},{expectedVersion:resolved.case.version})).case.status,"CLOSED");
      await db.query("delete from public.department_memberships where profile_id=$1 and department_id=$2",[ids.get("OFFICER"),departmentId]);
      try {await denied(`/cases/${caseId}`,officer.key,403,"CONSENT_REQUIRED");}
      finally {await db.query("insert into public.department_memberships(profile_id,department_id) values($1,$2)",[ids.get("OFFICER"),departmentId]);}
    });
    await t.test("expired/unknown credentials, malformed requests and owner-only revocation use safe envelopes",async()=>{
      const expired="sanad_"+randomBytes(32).toString("base64url");
      secrets.push(expired);
      const {rows:[row]}=await db.query(`insert into public.api_keys(principal_id,name,secret_hash,scopes,created_at,expires_at)
        values($1,'B05 expired synthetic',$2,array['READ_CASE']::public.sanad_consent_action[],clock_timestamp()-interval '2 days',clock_timestamp()-interval '1 day') returning id`,[ids.get("HELPER"),createHash("sha256").update(expired).digest("hex")]);
      issuedIds.push(row.id);
      await denied(`/cases/${caseId}`,expired,401,"INVALID_API_KEY");
      await denied(`/cases/${caseId}`,"sanad_"+randomBytes(32).toString("base64url"),401,"INVALID_API_KEY");
      const conflict=await fetch(base+`/api/v1/cases/${caseId}`,{headers:{"x-api-key":helper.key,cookie:cookies.get("HELPER")!}});
      assert.equal(conflict.status,400);
      const invalid=await call("/api-keys",{actor:"HELPER"},{name:"Invalid scope",scopes:["SUPERUSER"],expiresAt:new Date(Date.now()+3600000).toISOString()});
      assert.equal(invalid.status,422);
      const large=await call("/api-keys",{actor:"HELPER"},{name:"x".repeat(9000)});
      assert.equal(large.status,413);
      assert.equal((await call(`/api-keys/${helper.credential.id}/revoke`,{actor:"ADMIN"},{})).status,403);
    });
    await t.test("revocation serializes with an in-flight protected mutation and blocks all subsequent access",async()=>{
      const shared=await sharedDraft();
      const disposable=await issue("HELPER",["READ_EVIDENCE","WRITE_DRAFT"]);
      await db.query("begin");
      await db.query("select id from public.case_reservations where id=$1 for update",[shared.caseId]);
      const {rows:[connection]}=await db.query("select pg_backend_pid() as pid");
      const write=call(`/case-drafts/${shared.caseId}`,{key:disposable.key},{expectedVersion:1,noticeToken:null,messageText:"Synthetic B05 in-flight write",disputeText:null,relatedCaseId:null},crypto.randomUUID(),"PATCH");
      let revoke: Promise<Response> | undefined;
      try {
        const deadline=Date.now()+30000;
        let writerPid: number | undefined;
        while(Date.now()<deadline){
          const {rows}=await observer.query("select pid from pg_stat_activity where $1::int=any(pg_blocking_pids(pid))",[connection.pid]);
          if(rows.length){writerPid=Number(rows[0].pid);break;} await delay(40);
        }
        assert.ok(writerPid,"protected writer reached the reservation barrier");
        revoke=call(`/api-keys/${disposable.credential.id}/revoke`,{actor:"HELPER"},{});
        // Observe the revoker waiting on the credential row held by that protected request.
        let revokeBlocked=false;
        const revokeDeadline=Date.now()+10000;
        while(Date.now()<revokeDeadline){
          const {rows}=await observer.query("select pid from pg_stat_activity where $1::int=any(pg_blocking_pids(pid))",[writerPid]);
          if(rows.length){revokeBlocked=true;break;} await delay(40);
        }
        assert.ok(revokeBlocked,"revocation waits for protected credential lock");
      } finally {await db.query("rollback");}
      assert.equal((await write).status,200);
      assert.ok(revoke);
      assert.equal((await revoke!).status,200);
      await denied(`/case-drafts/${shared.caseId}`,disposable.key,401,"INVALID_API_KEY");
    });
    await t.test("revocation demonstration and secret-free minimal audit history",async()=>{
      assert.equal((await data(`/cases/${caseId}`,{key:helper.key})).id,caseId);
      await data(`/api-keys/${helper.credential.id}/revoke`,{actor:"HELPER"},{});
      await denied(`/cases/${caseId}`,helper.key,401,"INVALID_API_KEY");
      await data(`/consents/${grant.id}/revoke`,{actor:"CITIZEN_A"},{expectedVersion:grant.version});
      const {rows}=await db.query("select action,outcome,target_id,authorization_ref from public.audit_events where target_id=any($1::uuid[])",[issuedIds]);
      assert.ok(rows.some(row=>row.action==="API_KEY_ISSUED"));
      assert.ok(rows.some(row=>row.action==="API_KEY_REVOKED"));
      assert.ok(rows.some(row=>row.action==="API_KEY_AUTHENTICATED"));
      const serialized=JSON.stringify(rows);
      assert.ok(secrets.every(secret=>!serialized.includes(secret)));
      const {rows:privileges}=await db.query("select rolname from pg_roles where rolname in ('anon','authenticated','service_role') and has_table_privilege(rolname,'public.api_keys','SELECT')");
      assert.equal(privileges.length,0);
    });
  } finally {
    await db.query("rollback");
    for(const keyId of issuedIds) await db.query("update public.api_keys set revoked_at=clock_timestamp() where id=$1 and revoked_at is null",[keyId]);
    for(const actor of cookies.keys()) await call("/auth/logout",{actor},{});
    await db.end(); await observer.end();
  }
});
