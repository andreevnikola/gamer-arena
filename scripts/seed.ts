import { createDb, getDatabaseUrl } from "@/data/db";
import { createRepositories } from "@/repositories";
import { SEED_PASSWORD, seedDatabase } from "./seed-data";

async function main() {
  const handle = createDb(getDatabaseUrl("direct"));
  try {
    const seeded = await seedDatabase(createRepositories(handle.db));
    console.log(
      seeded
        ? `Seeded demo data. All demo accounts use the password "${SEED_PASSWORD}" (admin / organizer / novastrike ...).`
        : "Database already contains data - seed skipped. Run `npm run db:reset` to start fresh.",
    );
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
