import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file (CI): rely on variables already in the environment.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/data/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
