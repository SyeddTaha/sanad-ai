import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { handleLogin, handleLogout } from "../../src/backend/auth/password";
import { authClients } from "../../src/backend/auth/supabase";
import { SessionResponseSchema } from "../../src/lib/auth/session-contract";
import { ApiErrorEnvelopeSchema } from "../../src/contracts/v1";

const actor = "00000000-0000-4000-8000-000000000002";
const sessionId = "00000000-0000-4000-8000-000000000020";
const token = "e30." + Buffer.from(JSON.stringify({ session_id: sessionId })).toString("base64url") + ".test";

function provider(state = "valid") {
  return authClients("https://supabase.example.test", "public-test", "server-test", async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/rest/v1/audit_events") {
      assert.doesNotMatch(String(init?.body), /password|access_token|refresh_token/);
      return new Response(null, { status: 201 });
    }
    if (url.pathname === "/auth/v1/token") {
      if (state === "bad-password") return Response.json({ message: "Invalid login credentials" }, { status: 400 });
      return Response.json({ access_token: token, refresh_token: "never-persist-this", expires_in: 3600,
        token_type: "bearer", user: { id: actor } });
    }
    if (url.pathname === "/auth/v1/user") return Response.json({ id: actor });
    if (url.pathname === "/auth/v1/logout") {
      assert.equal(url.searchParams.get("scope"), "local");
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/rest/v1/rpc/sanad_session_context") return Response.json({
      principal: { id: actor, kind: "HUMAN", active: state !== "inactive", roles: ["CITIZEN"] }, departmentIds: [],
    });
    throw new Error("Unexpected provider operation");
  });
}

function loginRequest(body: unknown = { email: "citizen-a@demo.sanad.test", password: "synthetic-password" }) {
  return new NextRequest("https://sanad.test/api/v1/auth/login", {
    method: "POST", headers: { origin: "https://sanad.test", "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

test("cross-origin login and logout are denied before the session is changed", async () => {
  const clients = authClients("https://supabase.example.test", "public-test", "server-test", async input => {
    assert.match(String(input), /\/rest\/v1\/audit_events$/);
    return new Response(null, { status: 201 });
  });
  for (const operation of [handleLogin, handleLogout]) {
    const request = new NextRequest("https://sanad.test/auth", { method: "POST", headers: { origin: "https://other.test" } });
    const response = await operation(request, clients);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("set-cookie"), null);
  }
});

test("email/password login returns validated identity and only an HttpOnly strict session cookie", async () => {
  const response = await handleLogin(loginRequest(), provider());
  assert.equal(response.status, 200);
  assert.equal(SessionResponseSchema.parse(await response.json()).data.principal.id, actor);
  const cookie = response.headers.get("set-cookie") ?? "";
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=strict/);
  assert.match(cookie, /Max-Age=3600/);
  assert.doesNotMatch(cookie, /never-persist-this/);
});

test("login rejects incorrect passwords, inactive users and client-supplied roles without setting cookies", async () => {
  for (const [body, state, status] of [
    [undefined, "bad-password", 401], [undefined, "inactive", 403],
    [{ email: "citizen-a@demo.sanad.test", password: "synthetic-password", roles: ["ADMIN"] }, "valid", 422],
  ] as const) {
    const response = await handleLogin(loginRequest(body), provider(state));
    assert.equal(response.status, status);
    ApiErrorEnvelopeSchema.parse(await response.json());
    assert.equal(response.headers.get("set-cookie"), null);
  }
});

test("logout revokes only the current provider session and expires the HttpOnly cookie", async () => {
  const request = new NextRequest("https://sanad.test/api/v1/auth/logout", {
    method: "POST", headers: { origin: "https://sanad.test", cookie: "sanad-session=" + token },
  });
  const response = await handleLogout(request, provider());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
});
