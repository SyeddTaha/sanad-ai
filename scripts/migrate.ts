import { connectDatabase } from "./database";
import { applyMigrations } from "./migrations";

async function main() {
  const db = await connectDatabase();
  try {
    const applied = await applyMigrations(db);
    console.log("Database connection verified. Applied migrations:", applied.length ? applied.join(", ") : "none (already current)");
  } finally { await db.end(); }
}
main().catch(() => { console.error("Migration failed. Check database configuration and migration history; credentials are omitted."); process.exitCode = 1; });
