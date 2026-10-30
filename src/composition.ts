import { createServices, type Services } from "@/business";
import { createDb } from "@/data/db";
import { createRepositories } from "@/repositories";

/**
 * Composition root: the only module that knows every layer. It opens the
 * Postgres (Neon) pool, builds repositories, and wires them into services.
 * Migrations are applied separately with `npm run db:migrate`.
 * Presentation code imports `getServices` and nothing deeper.
 */
const globalForServices = globalThis as unknown as { __gamerArenaServices?: Services };

export function getServices(): Services {
  if (!globalForServices.__gamerArenaServices) {
    const { db } = createDb();
    globalForServices.__gamerArenaServices = createServices(createRepositories(db));
  }
  return globalForServices.__gamerArenaServices;
}
