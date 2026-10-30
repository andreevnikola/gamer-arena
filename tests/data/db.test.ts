import { describe, expect, it } from "vitest";
import { withExplicitSsl } from "@/data/db";

const BASE = "postgresql://u:p@host.neon.tech/db";

describe("withExplicitSsl", () => {
  it.each(["require", "prefer", "verify-ca"])("rewrites sslmode=%s to verify-full", (mode) => {
    expect(withExplicitSsl(`${BASE}?sslmode=${mode}`)).toBe(`${BASE}?sslmode=verify-full`);
    expect(withExplicitSsl(`${BASE}?channel_binding=require&sslmode=${mode}&x=1`)).toBe(
      `${BASE}?channel_binding=require&sslmode=verify-full&x=1`,
    );
  });

  it("leaves verify-full, disable, no sslmode and libpq-compat strings alone", () => {
    for (const url of [
      `${BASE}?sslmode=verify-full`,
      `${BASE}?sslmode=disable`,
      BASE,
      `${BASE}?uselibpqcompat=true&sslmode=require`,
    ]) {
      expect(withExplicitSsl(url)).toBe(url);
    }
  });
});
