// A repeatable five-step curl demonstration. Credentials stay in memory/stdin.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { ApiErrorEnvelopeSchema } from "../src/contracts/v1";
import { IssueApiKeyResponseSchema } from "../src/lib/api-key-contract";

const base = process.env.B05_BASE_URL || "http://localhost:3500";
const origin = new URL(base).origin;
const cookies = new Map<string,string>();
let credentialId: string | undefined;
async function setup(path: string, actor: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(base + "/api/v1" + path, { method, headers: {origin,cookie:cookies.get(actor)!,"content-type":"application/json","idempotency-key":crypto.randomUUID()}, ...(body === undefined ? {} : {body:JSON.stringify(body)}) });
  if (!response.ok) {
    console.error("Synthetic demo request failed:", method, path, "HTTP", response.status);
    throw new Error("Synthetic demonstration setup or cleanup failed");
  }
  return (await response.json()).data;
}
async function curl(path: string, headers: Record<string,string>, body?: unknown): Promise<{status:number;body:unknown}> {
  const config = ["silent", "show-error", "url = " + JSON.stringify(base + "/api/v1" + path),
    'write-out = "\\n%{http_code}"', ...Object.entries(headers).map(([name,value]) => "header = " + JSON.stringify(name + ": " + value)),
    ...(body === undefined ? [] : ['request = "POST"', 'header = "Content-Type: application/json"',
      "header = " + JSON.stringify("Idempotency-Key: " + crypto.randomUUID()), "data = " + JSON.stringify(JSON.stringify(body))]),
  ].join("\n");
  // Keep Node's HTTP/socket event loop running while curl performs each request.
  const stdout = await new Promise<string>((resolve,reject) => {
    const child = execFile(process.platform === "win32" ? "curl.exe" : "curl", ["--config", "-"], {encoding:"utf8",timeout:45000}, (error,output) => {
      if (error) reject(new Error("curl transport failed; verify curl installation and running development server"));
      else resolve(output);
    });
    child.stdin?.on("error", () => reject(new Error("curl input unavailable")));
    child.stdin?.end(config);
  });
  const split = stdout.lastIndexOf("\n");
  return {status:Number(stdout.slice(split+1)),body:JSON.parse(stdout.slice(0,split))};
}
async function main() {
try {
  for (const actor of ["CITIZEN_A", "HELPER"]) {
    const response = await fetch(base + "/api/v1/auth/login", {method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify({
      email:actor.toLowerCase().replaceAll("_","-")+"@demo.sanad.test",password:process.env["DEMO_"+actor+"_PASSWORD"],
    })});
    assert.equal(response.status,200,"Synthetic login");
    cookies.set(actor,response.headers.get("set-cookie")!.split(";")[0]);
  }
  const helper = await setup("/session","HELPER");
  const reservation = await setup("/case-drafts","CITIZEN_A",{});
  const caseId = reservation.caseId;
  const saved = await setup(`/case-drafts/${caseId}`,"CITIZEN_A",{expectedVersion:1,noticeToken:null,messageText:"Synthetic curl demonstration dispute",disputeText:null,relatedCaseId:null},"PATCH");
  await setup(`/cases/${caseId}/consents`,"CITIZEN_A",{recipientType:"PRINCIPAL",recipientId:helper.principal.id,purpose:"synthetic_helper_assistance",actions:["READ_CASE"],expiresAt:new Date(Date.now()+3600000).toISOString()});
  await setup("/cases","CITIZEN_A",{caseId,expectedDraftVersion:saved.version});
  const issued = await curl("/api-keys",{cookie:cookies.get("HELPER")!,origin},{name:"Synthetic curl demonstration",scopes:["READ_CASE"],expiresAt:new Date(Date.now()+3600000).toISOString()});
  assert.equal(issued.status,201);
  const issuedData = IssueApiKeyResponseSchema.parse(issued.body).data;
  credentialId = issuedData.credential.id;
  assert.ok(issuedData.key, "One-time credential was returned");
  const secret = issuedData.key;
  console.log("1. curl issue scoped key: 201 (secret captured in memory, omitted)");
  assert.equal((await curl(`/cases/${caseId}`,{"X-API-Key":secret})).status,200);
  console.log("2. curl authorized Case read: 200");
  const forbidden = await curl(`/cases/${caseId}/evidence-passport`,{"X-API-Key":secret});
  assert.equal(forbidden.status,403);
  assert.equal(ApiErrorEnvelopeSchema.parse(forbidden.body).error.code,"INSUFFICIENT_SCOPE");
  console.log("3. curl forbidden evidence read: 403 INSUFFICIENT_SCOPE");
  assert.equal((await curl(`/api-keys/${credentialId}/revoke`,{cookie:cookies.get("HELPER")!,origin},{})).status,200);
  console.log("4. curl revoke key as issuing human: 200");
  const revoked = await curl(`/cases/${caseId}`,{"X-API-Key":secret});
  assert.equal(revoked.status,401);
  assert.equal(ApiErrorEnvelopeSchema.parse(revoked.body).error.code,"INVALID_API_KEY");
  console.log("5. curl access after revocation: 401 INVALID_API_KEY");
  console.log("Synthetic Case:",caseId,"Credential metadata ID:",credentialId);
} finally {
  if (credentialId) await setup(`/api-keys/${credentialId}/revoke`,"HELPER",{});
  for (const actor of cookies.keys()) await setup("/auth/logout",actor,{});
}
}
main().catch(() => { console.error("Synthetic curl demonstration failed; verify the running server, demo credentials and expected HTTP steps above. Credentials are omitted."); process.exitCode = 1; });
