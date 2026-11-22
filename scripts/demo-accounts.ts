import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { MigrationDatabase } from "./migrations";

export const demoAccounts = [
  { name: "CITIZEN_A", email: "citizen-a@demo.sanad.test", role: "CITIZEN" },
  { name: "CITIZEN_B", email: "citizen-b@demo.sanad.test", role: "CITIZEN" },
  { name: "HELPER", email: "helper@demo.sanad.test", role: "HELPER" },
  { name: "OFFICER", email: "officer@demo.sanad.test", role: "OFFICER" },
  { name: "ADMIN", email: "admin@demo.sanad.test", role: "ADMIN" },
  { name: "AUDITOR", email: "auditor@demo.sanad.test", role: "AUDITOR" },
] as const;

const departmentId = "d0000000-0000-4000-8000-000000000001";
type AuthAdmin = Pick<SupabaseClient["auth"]["admin"], "listUsers" | "createUser">;

export async function provisionDemoAccounts(admin: AuthAdmin, db: MigrationDatabase,
  environment: Record<string, string | undefined> = process.env) {
  const passwords = demoAccounts.map((account) => {
    const key = "DEMO_" + account.name + "_PASSWORD";
    const parsed = z.string().min(16).max(128).safeParse(environment[key]);
    if (!parsed.success) throw new Error(key + " must contain 16–128 characters");
    return parsed.data;
  });
  await db.query("begin");
  try {
    await db.query("select pg_advisory_xact_lock(20261121, 2)");
    const existing = new Map<string, { id: string; app_metadata: Record<string, unknown> }>();
    for (let page = 1; ; page++) {
      const { data, error } = await admin.listUsers({ page, perPage: 100 });
      if (error) throw new Error("Cannot list demo users");
      for (const user of data.users) if (user.email) existing.set(user.email.toLowerCase(), user);
      if (data.users.length < 100) break;
    }
    await db.query(`insert into public.departments(id,name) values($1,'Synthetic Relief Department') on conflict(id) do nothing`, [departmentId]);
    const result: { name: string; id: string; email: string; role: string }[] = [];
    for (const [index, account] of demoAccounts.entries()) {
      let user = existing.get(account.email);
      if (user && user.app_metadata.sanad_demo !== true) throw new Error("Refusing to adopt an account not marked as a SANAD demo");
      if (!user) {
        const created = await admin.createUser({
          email: account.email, password: passwords[index], email_confirm: true,
          app_metadata: { sanad_demo: true },
        });
        if (created.error || !created.data.user) throw new Error("Cannot create synthetic demo account");
        user = created.data.user;
      }
      await db.query("insert into public.profiles(id,active) values($1,true) on conflict(id) do nothing", [user.id]);
      await db.query("insert into public.role_assignments(profile_id,role) values($1,$2::public.sanad_role) on conflict do nothing", [user.id, account.role]);
      if (account.role === "OFFICER" || account.role === "ADMIN") {
        await db.query("insert into public.department_memberships(profile_id,department_id) values($1,$2) on conflict do nothing", [user.id, departmentId]);
      }
      result.push({ name: account.name, id: user.id, email: account.email, role: account.role });
    }
    await db.query(`insert into public.audit_events(request_id,action,outcome) values(gen_random_uuid(),'DEMO_SETUP','ALLOWED')`);
    await db.query("commit");
    return result;
  } catch (error) { await db.query("rollback"); throw error; }
}
