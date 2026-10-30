import path from "node:path";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema";

/** Driver-agnostic Drizzle Postgres handle: node-postgres in the app, PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type NodeDb = NodePgDatabase<typeof schema>;

export interface DbHandle {
  db: NodeDb;
  close: () => Promise<void>;
}

export const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

/**
 * Connection string for the app. Prefers the pooled Neon endpoint (right for
 * serverless request handlers); migrations and scripts use the direct one.
 */
export function getDatabaseUrl(kind: "pooled" | "direct" = "pooled"): string {
  const url =
    kind === "pooled"
      ? (process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL)
      : process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  return url;
}

/**
 * pg treats sslmode=require/prefer/verify-ca as verify-full and warns that this
 * changes in pg v9. Neon serves a CA-signed certificate, so ask for verify-full
 * explicitly: same behaviour, no warning. Strings using `uselibpqcompat` are left alone.
 */
export function withExplicitSsl(connectionString: string): string {
  if (/[?&]uselibpqcompat=/.test(connectionString)) return connectionString;
  return connectionString.replace(/([?&]sslmode=)(?:require|prefer|verify-ca)(?=&|$)/, "$1verify-full");
}

/** Opens a connection pool against Postgres (Neon). */
export function createDb(connectionString: string = getDatabaseUrl()): DbHandle {
  const pool = new Pool({ connectionString: withExplicitSsl(connectionString) });
  // An idle client dropped by the server must not crash the process.
  pool.on("error", (error) => console.error("Postgres pool error:", error.message));
  return { db: drizzle(pool, { schema }), close: () => pool.end() };
}

/** Applies pending migrations from ./drizzle. Use the direct (non-pooled) connection. */
export async function runMigrations(db: NodeDb): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
