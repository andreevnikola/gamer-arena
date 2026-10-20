import { createServices, type Services } from "@/business";
import { createMigratedDb } from "@/data/db";
import { createRepositories } from "@/repositories";

/**
 * Composition root: the only module that knows every layer. It opens the
 * SQLite file (applying pending migrations), builds repositories, and wires
 * them into services. Presentation code imports `getServices` and nothing deeper.
 */
const globalForServices = globalThis as unknown as { __gamerArenaServices?: Services };

export function getServices(): Services {
  if (!globalForServices.__gamerArenaServices) {
    const { db } = createMigratedDb();
    globalForServices.__gamerArenaServices = createServices(createRepositories(db));
  }
  return globalForServices.__gamerArenaServices;
}
