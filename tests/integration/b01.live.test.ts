// Opt-in: real Supabase Auth, hosted PostgreSQL and a running Next.js server. No providers are mocked.
import assert from "node:assert/strict";
import { test } from "node:test";
import { connectDatabase } from "../../scripts/database";
import { applyMigrations } from "../../scripts/migrations";
import { provisionDemoAccounts } from "../../scripts/demo-accounts";
import { authClients } from "../../src/backend/auth/supabase";
import { SessionResponseSchema } from "../../src/lib/auth/session-contract";
import { ApiErrorEnvelopeSchema } from "../../src/contracts/v1";

const base = process.env.B01_BASE_URL ?? "http://localhost:3100";
const origin = new URL(base).origin;

test("B01 live Supabase/PostgreSQL/HTTP acceptance", async (t) => {
  const db = await connectDatabase();
  const clients = authClients();
  const cookies = new Map<string, string>();
  const request = (path: string, cookie?: string, extra: RequestInit = {}) => fetch(base + path, {
    ...extra, headers: { ...(cookie ? { cookie } : {}), ...extra.headers }, redirect: "manual",
  });
  async function expectError(response: Response, status: number, code: string) {
    assert.equal(response.status, status);
    const payload = await response.json();
    assert.equal(ApiErrorEnvelopeSchema.parse(payload).error.code, code);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    assert.doesNotMatch(JSON.stringify(payload), /access_token|refresh_token|password|sb_secret_/);
  }
  let accounts: Awaited<ReturnType<typeof provisionDemoAccounts>> = [];
  try {
    await t.test("database connects and applied migrations are current on repeat", async () => {
      assert.deepEqual(await applyMigrations(db), []);
      const { rows } = await db.query("select name from sanad_private.migrations");
      for (const name of ["20261121000100_backend_foundation.sql", "20261121000200_session_expiry.sql", "20261121000300_rbac_consent.sql"]) {
        assert.ok(rows.some(row => row.name === name), "Required foundation migration: " + name);
      }
    });
    await t.test("all five roles and two citizens provision idempotently against real Auth and PostgreSQL", async () => {
      accounts = await provisionDemoAccounts(clients.server.auth.admin, db);
      assert.deepEqual(await provisionDemoAccounts(clients.server.auth.admin, db), accounts);
      assert.equal(new Set(accounts.map((account) => account.id)).size, 6);
      const counts = await db.query("select count(*)::int as profiles from public.profiles where id=any($1::uuid[])", [accounts.map((account) => account.id)]);
      assert.equal(counts.rows[0].profiles, 6);
    });
    await t.test("every synthetic account authenticates through HTTP and resolves database-backed identity", async () => {
      for (const account of accounts) {
        const response = await request("/api/v1/auth/login", undefined, {
          method: "POST", headers: { origin, "content-type": "application/json" },
          body: JSON.stringify({ email: account.email, password: process.env["DEMO_" + account.name + "_PASSWORD"] }),
        });
        assert.equal(response.status, 200, account.name + " login");
        const { data } = SessionResponseSchema.parse(await response.json());
        assert.equal(data.principal.id, account.id);
        assert.deepEqual(data.principal.roles, [account.role]);
        assert.equal(data.principal.active, true);
        assert.equal(data.departmentIds.length, ["OFFICER", "ADMIN"].includes(account.role) ? 1 : 0);
        const cookie = response.headers.get("set-cookie") ?? "";
        assert.match(cookie, /HttpOnly/);
        assert.match(cookie, /SameSite=strict/);
        cookies.set(account.name, cookie.split(";")[0]);
        const protectedResponse = await request("/api/v1/session", cookies.get(account.name));
        assert.equal(protectedResponse.status, 200);
        assert.deepEqual(SessionResponseSchema.parse(await protectedResponse.json()).data, data);
      }
      assert.equal(accounts.length, 6);
    });
    await t.test("unauthenticated and invalid or expired tokens are rejected", async () => {
      await expectError(await request("/api/v1/session"), 401, "UNAUTHENTICATED");
      await expectError(await request("/api/v1/session", undefined, { headers: { authorization: "Bearer invalid" } }), 401, "UNAUTHENTICATED");
      const cookie = cookies.get("CITIZEN_A");
      assert.ok(cookie);
      const token = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
      const segments = token.split(".");
      const claims = JSON.parse(Buffer.from(segments[1], "base64url").toString());
      // Keep the signature while expiring the payload: this is an invalid/expired-claim token, not a freshly signed expired JWT.
      claims.exp = 1;
      segments[1] = Buffer.from(JSON.stringify(claims)).toString("base64url");
      await expectError(await request("/api/v1/session", undefined, { headers: { authorization: "Bearer " + segments.join(".") } }), 401, "UNAUTHENTICATED");
    });
    await t.test("client identity and role assertions cannot elevate a citizen", async () => {
      const response = await request("/api/v1/session?role=ADMIN", cookies.get("CITIZEN_A"), {
        headers: { "x-user-id": accounts.find((account) => account.name === "ADMIN")!.id, "x-roles": "ADMIN" },
      });
      assert.equal(response.status, 200);
      const { data } = SessionResponseSchema.parse(await response.json());
      assert.equal(data.principal.id, accounts.find((account) => account.name === "CITIZEN_A")!.id);
      assert.deepEqual(data.principal.roles, ["CITIZEN"]);
    });
    await t.test("inactive profiles immediately lose protected access", async () => {
      const id = accounts.find((account) => account.name === "CITIZEN_B")!.id;
      const original = await db.query("select active from public.profiles where id=$1", [id]);
      try {
        await db.query("update public.profiles set active=false where id=$1", [id]);
        await expectError(await request("/api/v1/session", cookies.get("CITIZEN_B")), 403, "FORBIDDEN");
      } finally { await db.query("update public.profiles set active=$2 where id=$1", [id, original.rows[0].active]); }
    });
    await t.test("a real Auth session past its database expiry is rejected despite a valid access token", async () => {
      const cookie = cookies.get("CITIZEN_B")!;
      const jwt = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
      const sessionId = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).session_id;
      const original = await db.query("select not_after from auth.sessions where id=$1", [sessionId]);
      assert.equal(original.rows.length, 1);
      try {
        await db.query("update auth.sessions set not_after=now()-interval '1 minute' where id=$1", [sessionId]);
        await expectError(await request("/api/v1/session", cookie), 401, "UNAUTHENTICATED");
      } finally { await db.query("update auth.sessions set not_after=$2 where id=$1", [sessionId, original.rows[0].not_after]); }
    });
    await t.test("anonymous and citizen SQL roles cannot read another citizen's existing records or self-promote", async () => {
      const citizenA = accounts.find((account) => account.name === "CITIZEN_A")!.id;
      const citizenB = accounts.find((account) => account.name === "CITIZEN_B")!.id;
      await db.query("begin");
      try {
        const reservation = await db.query("insert into public.case_reservations(citizen_id) values($1) returning id", [citizenB]);
        await db.query("insert into public.cases(id,citizen_id,status) values($1,$2,'PENDING_CONSENT')", [reservation.rows[0].id, citizenB]);
        for (const role of ["anon", "authenticated"]) {
          await db.query("savepoint permission_probe");
          await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: citizenA, role })]);
          await db.query("set local role " + role);
          await assert.rejects(db.query("select * from public.cases where citizen_id=$1", [citizenB]), { code: "42501" });
          await db.query("rollback to savepoint permission_probe");
          await db.query("savepoint promotion_probe");
          await db.query("set local role " + role);
          await assert.rejects(db.query("insert into public.role_assignments(profile_id,role) values($1,'ADMIN')", [citizenA]), { code: "42501" });
          await db.query("rollback to savepoint promotion_probe");
        }
      } finally { await db.query("rollback"); }
    });
    await t.test("direct Supabase REST calls deny anonymous reads and citizen self-promotion", async () => {
      const url = process.env.SUPABASE_URL!;
      const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
      const anonymous = await fetch(url + "/rest/v1/profiles?select=id", { headers: { apikey: key } });
      assert.ok([401, 403].includes(anonymous.status));
      const cookie = cookies.get("CITIZEN_A")!;
      const jwt = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
      const headers = { apikey: key, authorization: "Bearer " + jwt, "content-type": "application/json" };
      const read = await fetch(url + "/rest/v1/cases?select=id", { headers });
      assert.equal(read.status, 403);
      const promote = await fetch(url + "/rest/v1/role_assignments", {
        method: "POST", headers, body: JSON.stringify({ profile_id: accounts.find((a) => a.name === "CITIZEN_A")!.id, role: "ADMIN" }),
      });
      assert.equal(promote.status, 403);
      const changeRole = await fetch(url + "/rest/v1/role_assignments?profile_id=eq." + accounts.find((a) => a.name === "CITIZEN_A")!.id, {
        method: "PATCH", headers, body: JSON.stringify({ role: "ADMIN" }),
      });
      assert.equal(changeRole.status, 403);
    });
    await t.test("cross-origin authentication mutations are denied", async () => {
      for (const operation of ["login", "logout"]) {
        await expectError(await request("/api/v1/auth/" + operation, cookies.get("CITIZEN_A"), {
          method: "POST", headers: { origin: "https://untrusted.example.test" },
        }), 403, "FORBIDDEN");
      }
    });
    await t.test("logout invalidates replay of the previously valid token", async () => {
      const oldCookie = cookies.get("CITIZEN_A")!;
      const response = await request("/api/v1/auth/logout", oldCookie, { method: "POST", headers: { origin } });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/);
      cookies.delete("CITIZEN_A");
      await expectError(await request("/api/v1/session", oldCookie), 401, "UNAUTHENTICATED");
    });
  } finally {
    try {
      for (const cookie of cookies.values()) {
        const response = await request("/api/v1/auth/logout", cookie, { method: "POST", headers: { origin } });
        assert.equal(response.status, 200, "test-session cleanup");
      }
    } finally { await db.end(); }
  }
});
