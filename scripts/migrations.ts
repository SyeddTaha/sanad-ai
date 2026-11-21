import "server-only";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

export interface MigrationDatabase {
  query(sql: string, values?: string[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export async function applyMigrations(db: MigrationDatabase) {
  await db.query("begin");
  try {
    await db.query("select pg_advisory_xact_lock(20261121, 1)");
    await db.query(`create schema if not exists sanad_private;
      revoke all on schema sanad_private from public, anon, authenticated, service_role;
      create table if not exists sanad_private.migrations (
        name text primary key, sha256 text not null, applied_at timestamptz not null default now()
      )`);
    const files = (await readdir("supabase/migrations")).filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
    const applied: string[] = [];
    for (const name of files) {
      // Windows checkouts may use CRLF. Hash the same SQL text on every teammate's OS.
      const sql = (await readFile("supabase/migrations/" + name, "utf8")).replace(/\r\n/g, "\n");
      const digest = createHash("sha256").update(sql).digest("hex");
      const previous = await db.query("select sha256 from sanad_private.migrations where name=$1", [name]);
      if (previous.rows.length) {
        if (previous.rows[0].sha256 !== digest) throw new Error("Applied migration checksum changed: " + name);
        continue;
      }
      await db.query(sql);
      await db.query("insert into sanad_private.migrations(name,sha256) values($1,$2)", [name, digest]);
      applied.push(name);
    }
    await db.query("commit");
    return applied;
  } catch (error) { await db.query("rollback"); throw error; }
}
