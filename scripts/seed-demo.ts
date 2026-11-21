import { connectDatabase } from "./database";
import { provisionDemoAccounts } from "./demo-accounts";
import { authClients } from "../src/backend/auth/supabase";

async function main() {
  const db = await connectDatabase();
  try {
    const accounts = await provisionDemoAccounts(authClients().server.auth.admin, db);
    console.log("Synthetic accounts provisioned (passwords omitted):");
    for (const account of accounts) console.log(account.name + ": " + account.email + " [" + account.role + "]");
  } finally { await db.end(); }
}
main().catch(() => { console.error("Demo setup failed. Check migration status, administrator credentials and all six DEMO_*_PASSWORD variables. Existing passwords are never reset."); process.exitCode = 1; });
