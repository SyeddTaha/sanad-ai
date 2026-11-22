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
    assert.deepEqual(await applyMigrations(sql), [
      "20261121000100_backend_foundation.sql", "20261121000200_session_expiry.sql",
      "20261121000300_rbac_consent.sql", "20261121000400_case_evidence.sql",
      "20261121000500_case_operation_keys.sql", "20261121000600_case_inputs_and_basis.sql",
      "20261121000700_case_input_guards.sql",
      "20261121000800_published_rules.sql", "20261121000900_officer_decisions.sql",
      "20261121001000_synthetic_program_inputs.sql",
      "20261122001100_scoped_api_keys.sql",
      "20261122001200_trusted_registry.sql",
    ]);
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
    assert.equal((await db.query("select * from public.department_memberships")).rows.length, 2);
  } finally { await db.close(); }
});
