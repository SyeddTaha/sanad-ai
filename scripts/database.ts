import "server-only";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

export async function connectDatabase() {
  const value = process.env.SUPABASE_STRING;
  if (!value) throw new Error("SUPABASE_STRING is required");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("SUPABASE_STRING must be a PostgreSQL URI"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("SUPABASE_STRING must be a PostgreSQL URI");
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  // URI ssl parameters can override pg's ssl object. Keep TLS policy under this boundary's control.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert", "ssl"]) url.searchParams.delete(key);
  const caPath = process.env.SUPABASE_DB_CA_FILE;
  const client = new Client({
    connectionString: url.toString(), connectionTimeoutMillis: 15000,
    ssl: local ? false : { rejectUnauthorized: true, ...(caPath ? { ca: await readFile(caPath, "utf8") } : {}) },
  });
  try { await client.connect(); }
  catch { await client.end(); throw new Error("Database connection failed; check URI, network and trusted CA configuration"); }
  return client;
}
