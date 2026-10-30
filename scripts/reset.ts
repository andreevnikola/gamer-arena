import { sql } from "drizzle-orm";
import { createDb, getDatabaseUrl } from "@/data/db";

/** Drops every table and the migration history. Destructive: run only against a demo database. */
async function main() {
  const handle = createDb(getDatabaseUrl("direct"));
  try {
    await handle.db.execute(sql`drop schema if exists drizzle cascade`);
    await handle.db.execute(sql`drop schema if exists public cascade`);
    await handle.db.execute(sql`create schema public`);
    console.log("Schema dropped.");
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
