import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/data/**", "src/repositories/**", "src/business/**"],
      exclude: ["src/data/seed.ts", "src/data/migrate.ts", "src/**/index.ts"],
      reporter: ["text", "html"],
    },
  },
});
