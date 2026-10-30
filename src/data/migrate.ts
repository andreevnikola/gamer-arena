import { createDb, getDatabaseUrl, runMigrations } from "./db";

async function main() {
  const handle = createDb(getDatabaseUrl("direct"));
  try {
    await runMigrations(handle.db);
    console.log("Migrations applied.");
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
