import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { applyMigrations } from "../../scripts/migrations";
import { provisionDemoAccounts } from "../../scripts/demo-accounts";

test("synthetic setup provisions every role and two citizens without duplicating accounts on repeat", async () => {
  const db = new PGlite();
  const users: { id: string; email: string; app_metadata: Record<string, unknown> }[] = [];
  const transport: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === "/auth/v1/admin/users" && init?.method === "GET") return Response.json({ users });
    if (path === "/auth/v1/admin/users" && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      const user = { id: crypto.randomUUID(), email: body.email, app_metadata: body.app_metadata };
      users.push(user);
      await db.query("insert into auth.users(id) values ($1)", [user.id]);
      return Response.json(user);
    }
    throw new Error("Unexpected Auth provider operation");
  };
  const admin = createClient("https://supabase.example.test", "test-secret", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: transport },
  }).auth.admin;
  const sql = {
    query: async (statement: string, values?: string[]) => {
      if (values) return db.query<Record<string, unknown>>(statement, values);
      await db.exec(statement);
      return { rows: [] };
    },
  };
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create table auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz);`);
    assert.equal((await applyMigrations(sql)).length, 2);
    assert.deepEqual(await applyMigrations(sql), []);
    const passwords = Object.fromEntries(["CITIZEN_A", "CITIZEN_B", "HELPER", "OFFICER", "ADMIN", "AUDITOR"]
      .map((name) => ["DEMO_" + name + "_PASSWORD", "synthetic-test-password-9381"]));
    const first = await provisionDemoAccounts(admin, sql, passwords);
    const second = await provisionDemoAccounts(admin, sql, passwords);
    assert.deepEqual(first, second);
    assert.equal(users.length, 6);
    const { rows } = await db.query<{ role: string; count: number }>("select role,count(*)::int as count from public.role_assignments group by role order by role");
    assert.deepEqual(rows, [
      { role: "CITIZEN", count: 2 }, { role: "HELPER", count: 1 }, { role: "OFFICER", count: 1 },
      { role: "ADMIN", count: 1 }, { role: "AUDITOR", count: 1 },
    ]);
    assert.equal((await db.query("select * from public.department_memberships")).rows.length, 1);
  } finally { await db.close(); }
});
