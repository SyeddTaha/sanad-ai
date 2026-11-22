import "server-only";
import { readFile } from "node:fs/promises";
import { Client, type ClientConfig } from "pg";

export async function databaseConfig(env: Partial<NodeJS.ProcessEnv> = process.env): Promise<ClientConfig> {
  const value = env.SUPABASE_STRING;
  if (!value) throw new Error("SUPABASE_STRING is required");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("SUPABASE_STRING must be a PostgreSQL URI"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("SUPABASE_STRING must be a PostgreSQL URI");
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  // URI ssl parameters can override pg's ssl object. Keep TLS policy under this boundary's control.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert", "ssl"]) url.searchParams.delete(key);
  const caPath = env.SUPABASE_DB_CA_FILE;
  // Hosted runtimes cannot read a developer's workstation path. PEM stays server-only.
  const ca = env.SUPABASE_DB_CA_PEM || (caPath ? await readFile(caPath, "utf8") : undefined);
  return {
    connectionString: url.toString(), connectionTimeoutMillis: 15000,
    ssl: local ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
  };
}

export async function connectDatabase() {
  const client = new Client(await databaseConfig());
  try { await client.connect(); }
  catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "UNKNOWN";
    const safeCode = /^(?:E[A-Z_]+|[A-Z_]*CERT[A-Z_]*|[0-9A-Z]{5})$/.test(code) ? code : "UNKNOWN";
    console.error(JSON.stringify({ event: "database_connection_failed", code: safeCode }));
    await client.end();
    throw new Error("Database connection failed; check URI, network and trusted CA configuration");
  }
  return client;
}
