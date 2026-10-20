import { afterEach } from "vitest";
import { createMigratedDb, type DbHandle } from "@/data/db";
import { createRepositories } from "@/repositories";

const open: DbHandle[] = [];

afterEach(() => {
  while (open.length) open.pop()!.close();
});

/** A fresh, fully migrated in-memory SQLite database; closed automatically after each test. */
export function useTestDb() {
  const handle = createMigratedDb(":memory:");
  open.push(handle);
  return { ...handle, repos: createRepositories(handle.db) };
}
