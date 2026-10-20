import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const UI = ["@/app", "@/app/*", "@/components", "@/components/*", "@/composition"];
const DB = ["@/data/db", "@/data/schema", "drizzle-orm", "drizzle-orm/*", "better-sqlite3"];

/** Forbids imports of the listed patterns inside the matched files. */
const forbid = (files, group, message) => ({
  files,
  rules: { "no-restricted-imports": ["error", { patterns: [{ group, message }] }] },
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Layer rule: Presentation -> Business -> Repositories -> Data. Never upwards, never skipping.
  forbid(
    ["src/business/**/*.ts"],
    [...DB, ...UI],
    "Business depends on repository interfaces and entity types only (see CLAUDE.md, Architecture).",
  ),
  forbid(
    ["src/repositories/**/*.ts"],
    ["@/business", "@/business/*", ...UI],
    "Repositories must not depend on business or presentation code.",
  ),
  forbid(
    ["src/data/**/*.ts"],
    ["@/repositories", "@/repositories/*", "@/business", "@/business/*", ...UI],
    "The data layer depends on nothing above it.",
  ),
  forbid(
    ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    [...DB, "@/repositories", "@/repositories/*"],
    "Presentation talks to services via @/composition only. Never to repositories or the database.",
  ),
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "coverage/**", ".vitest/**", "graphify-out/**"]),
]);

export default eslintConfig;
