import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, expect } from "vitest";
import { MIGRATIONS_FOLDER } from "@/data/db";
import * as schema from "@/data/schema";
import { createRepositories } from "@/repositories";

type TestDb = ReturnType<typeof drizzle<typeof schema, PGlite>>;

/** One migrated in-process Postgres (PGlite) per test file; tests get it emptied. */
let shared: { pglite: PGlite; db: TestDb } | undefined;

afterAll(async () => {
  await shared?.pglite.close();
  shared = undefined;
});

const TABLES = [
  "announcements",
  "match_results",
  "matches",
  "tournament_teams",
  "tournaments",
  "team_members",
  "teams",
  "games",
  "users",
];

/** A real, fully migrated, empty Postgres database (ids restart at 1). Isolated per test. */
export async function useTestDb() {
  if (!shared) {
    const pglite = new PGlite();
    const db = drizzle(pglite, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    shared = { pglite, db };
  }
  const { db } = shared;
  await db.execute(sql.raw(`truncate ${TABLES.map((t) => `"${t}"`).join(", ")} restart identity cascade`));
  return { db, repos: createRepositories(db) };
}

/** SQLSTATE codes of the Postgres errors the schema is expected to raise. */
export const PG_ERROR = {
  unique: "23505",
  foreignKey: "23503",
  restrict: "23001",
  check: "23514",
} as const;

/** Asserts a query failed with the given SQLSTATE (Drizzle wraps the driver error in `cause`). */
export async function expectDbError(query: Promise<unknown>, code: string) {
  const error = (await query.then(
    () => undefined,
    (e: unknown) => e,
  )) as { code?: string; cause?: { code?: string } } | undefined;
  expect(error, "expected the query to fail").toBeDefined();
  expect(error?.cause?.code ?? error?.code).toBe(code);
}
