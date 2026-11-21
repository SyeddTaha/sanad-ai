import { before, after } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server";
import { authClients } from "../../src/backend/auth/supabase";
export const db = new PGlite();
export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const roles = ["CITIZEN", "CITIZEN", "HELPER", "OFFICER", "ADMIN", "AUDITOR"];
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);`);
  for (const file of (await readdir("supabase/migrations")).sort()) await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  for (const [i, role] of roles.entries()) {
    await db.query("insert into auth.users values($1)", [id(i + 1)]);
    await db.query("insert into auth.sessions values($1,$2,null)", [id(i + 101), id(i + 1)]);
    await db.query("insert into public.profiles(id,active) values($1,true)", [id(i + 1)]);
    await db.query("insert into public.role_assignments(profile_id,role) values($1,$2)", [id(i + 1), role]);
  }
  await db.query("insert into public.departments(id,name) values($1,'Synthetic Department')", [id(30)]);
  await db.query("insert into public.department_memberships values($1,$2,now())", [id(4), id(30)]);
  await db.query("insert into public.department_memberships values($1,$2,now())", [id(5), id(30)]);
});
after(async () => { await db.close(); });

export function dependencies(actor: number) {
  const transport: typeof fetch = async (input) => {
    const path = new URL(String(input instanceof Request ? input.url : input)).pathname;
    if (path === "/auth/v1/user") return Response.json({ id: id(actor), user_metadata: { roles: ["ADMIN"] } });
    if (path === "/rest/v1/rpc/sanad_session_context") return Response.json({ principal: { id: id(actor), kind: "HUMAN", roles: [roles[actor - 1]], active: true }, departmentIds: [4,5].includes(actor) ? [id(30)] : [] });
    throw new Error("Unexpected Auth request");
  };
  return { clients: authClients("https://project.example.test", "public-test", "secret-test", transport),
    database: async () => ({ query: (sql: string, values?: unknown[]) => db.query<Record<string, unknown>>(sql, values), end: async () => {} }) };
}
export function request(actor: number, body?: unknown, key = crypto.randomUUID(), extra: Record<string,string> = {}) {
  const token = ["header", Buffer.from(JSON.stringify({ session_id: id(actor + 100) })).toString("base64url"), "signature"].join(".");
  return new NextRequest("https://sanad.test/api/v1/case-drafts", {
    method: body === undefined ? "GET" : "POST", headers: { authorization: "Bearer " + token, origin: "https://sanad.test", "content-type": "application/json", "idempotency-key": key, ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

