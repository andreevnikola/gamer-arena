import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

export interface DbHandle {
  db: Db;
  close: () => void;
}

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");
export const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "gamerarena.db");

/**
 * Opens a SQLite database with foreign keys enforced.
 * Pass ":memory:" for an isolated database (used by tests).
 */
export function createDb(file: string = DEFAULT_DB_PATH): DbHandle {
  if (file !== ":memory:") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const sqlite = new Database(file);
  sqlite.pragma("foreign_keys = ON");
  if (file !== ":memory:") {
    sqlite.pragma("journal_mode = WAL");
  }
  return { db: drizzle(sqlite, { schema }), close: () => sqlite.close() };
}

export function runMigrations(db: Db): void {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

/** Opens a database and applies all migrations. */
export function createMigratedDb(file?: string): DbHandle {
  const handle = createDb(file);
  runMigrations(handle.db);
  return handle;
}
