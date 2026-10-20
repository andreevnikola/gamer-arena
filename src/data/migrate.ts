import { createDb, runMigrations } from "./db";

const handle = createDb();
runMigrations(handle.db);
handle.close();
console.log("Migrations applied.");
