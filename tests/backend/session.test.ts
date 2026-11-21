import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { ApiErrorEnvelopeSchema, ApiSuccessSchema, PrincipalSchema } from "../../src/contracts/v1";
import { handleSession } from "../../src/backend/auth/session";
import { authClients } from "../../src/backend/auth/supabase";
import { z } from "zod";

const actor = "00000000-0000-4000-8000-000000000002";
const session = "00000000-0000-4000-8000-000000000020";
const token = ["eyJhbGciOiJIUzI1NiJ9", Buffer.from(JSON.stringify({ sub: actor, session_id: session })).toString("base64url"), "signature"].join(".");
function endpoint(headers: Record<string,string>, state = "valid") {
  const transport: typeof fetch = async (input) => {
    const path = new URL(String(input instanceof Request ? input.url : input)).pathname;
    if (path === "/auth/v1/user") {
      if (state === "unavailable") return Response.json({ message: "provider internal details" }, { status: 503 });
      return state === "expired" ? Response.json({ message: "expired" }, { status: 401 })
        : Response.json({ id: actor, user_metadata: { roles: ["ADMIN"] } });
    }
    if (path === "/rest/v1/rpc/sanad_session_context") {
      return Response.json(state === "revoked" ? null : {
        principal: { id: state === "wrong-principal" ? session : actor, kind: "HUMAN", active: state !== "inactive", roles: state === "roleless" ? [] : ["CITIZEN"] },
        departmentIds: [],
      });
    }
    if (path === "/rest/v1/audit_events") return new Response(null, { status: 201 });
    throw new Error("Unexpected provider path");
  };
  const clients = authClients("https://project.example.test", "public-test", "server-test", transport);
  return handleSession(new NextRequest("https://sanad.test/api/v1/session?role=ADMIN", { headers }), clients);
}
test("session endpoint authenticates the user and returns only database-backed roles and departments", async () => {
  const response = await endpoint({ authorization: "Bearer " + token, "x-user-id": session, "x-roles": "ADMIN" });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  const { data } = ApiSuccessSchema(z.strictObject({ principal: PrincipalSchema, departmentIds: z.array(z.uuid()) })).parse(await response.json());
  assert.deepEqual(data, { principal: { id: actor, kind: "HUMAN", roles: ["CITIZEN"], active: true }, departmentIds: [] });
});

for (const [description, headers, state, status, code] of [
  ["missing session", {}, "valid", 401, "UNAUTHENTICATED"],
  ["expired JWT", { authorization: "Bearer " + token }, "expired", 401, "UNAUTHENTICATED"],
  ["revoked session", { cookie: "sanad-session=" + token }, "revoked", 401, "UNAUTHENTICATED"],
  ["inactive profile", { authorization: "Bearer " + token }, "inactive", 403, "FORBIDDEN"],
  ["profile without roles", { authorization: "Bearer " + token }, "roleless", 403, "FORBIDDEN"],
  ["mismatched principal", { authorization: "Bearer " + token }, "wrong-principal", 503, "SERVICE_UNAVAILABLE"],
  ["unavailable Auth provider", { authorization: "Bearer " + token }, "unavailable", 503, "SERVICE_UNAVAILABLE"],
  ["conflicting credentials", { cookie: "sanad-session=" + token, authorization: "Bearer " + token }, "valid", 400, "MALFORMED_REQUEST"],
  ["self-asserted API key", { "x-api-key": "demo" }, "valid", 401, "INVALID_API_KEY"],
] as const) {
  test("session endpoint rejects " + description, async () => {
    const response = await endpoint(headers, state);
    assert.equal(response.status, status);
    assert.equal(ApiErrorEnvelopeSchema.parse(await response.json()).error.code, code);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  });
}
