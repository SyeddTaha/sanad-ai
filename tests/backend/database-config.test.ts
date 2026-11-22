import assert from "node:assert/strict";
import { test } from "node:test";
import { databaseConfig } from "../../scripts/database";

test("hosted SQL accepts inline CA without a workstation file and retains certificate verification", async () => {
  const config = await databaseConfig({ SUPABASE_STRING: "postgresql://user:password@db.example.test/db?sslmode=no-verify",
    SUPABASE_DB_CA_PEM: "synthetic-test-ca", SUPABASE_DB_CA_FILE: "C:/absent/workstation-ca.crt" });
  assert.deepEqual(config.ssl, { rejectUnauthorized: true, ca: "synthetic-test-ca" });
  assert.equal(new URL(config.connectionString!).searchParams.has("sslmode"), false);
});

test("SQL configuration fails closed without a URI and allows unencrypted loopback only", async () => {
  await assert.rejects(databaseConfig({}), /SUPABASE_STRING is required/);
  await assert.rejects(databaseConfig({ SUPABASE_STRING: "https://example.test" }), /PostgreSQL URI/);
  assert.equal((await databaseConfig({ SUPABASE_STRING: "postgres://localhost/test" })).ssl, false);
  assert.deepEqual((await databaseConfig({ SUPABASE_STRING: "postgres://db.example.test/test" })).ssl, { rejectUnauthorized: true });
});
