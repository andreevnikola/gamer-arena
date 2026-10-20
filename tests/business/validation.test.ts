import { describe, expect, it } from "vitest";
import {
  isNonNegativeInteger,
  isPositiveInteger,
  isValidEmail,
  isValidGamerTag,
  isValidPassword,
  isValidUserName,
  validateGame,
  validateProofUrl,
  validateScores,
  validateTeamName,
  validateTournamentInput,
  validateUserRegistration,
} from "@/business/validation";

describe("email", () => {
  it.each(["a@b.co", "first.last@example.com", "user+tag@sub.domain.org", "x_y-z@my-host.io"])(
    "accepts %s",
    (email) => expect(isValidEmail(email)).toBe(true),
  );

  it.each([
    "",
    "plain",
    "@no-local.com",
    "no-domain@",
    "no-tld@host",
    "two@@at.com",
    "spaces in@x.com",
    "dot..dot@x.com",
    ".lead@x.com",
    "trail.@x.com",
    "a@-bad.com",
    "a@bad-.com",
    `${"a".repeat(65)}@x.com`,
  ])("rejects %j", (email) => expect(isValidEmail(email)).toBe(false));
});

describe("gamer tag / user name / password", () => {
  it("gamer tag: 3-16 letters, digits, underscore", () => {
    expect(isValidGamerTag("abc")).toBe(true);
    expect(isValidGamerTag("A_1".repeat(5) + "x")).toBe(true); // 16 chars
    expect(isValidGamerTag("ab")).toBe(false);
    expect(isValidGamerTag("a".repeat(17))).toBe(false);
    expect(isValidGamerTag("has space")).toBe(false);
    expect(isValidGamerTag("emoji😀")).toBe(false);
  });

  it("user name allows . and -", () => {
    expect(isValidUserName("jane.doe-1")).toBe(true);
    expect(isValidUserName("no")).toBe(false);
    expect(isValidUserName("bad name")).toBe(false);
  });

  it("password needs 8+ chars with letter and digit", () => {
    expect(isValidPassword("abcdefg1")).toBe(true);
    expect(isValidPassword("short1")).toBe(false);
    expect(isValidPassword("onlyletters")).toBe(false);
    expect(isValidPassword("12345678")).toBe(false);
  });
});

describe("number guards", () => {
  it("positive integer", () => {
    expect(isPositiveInteger(1)).toBe(true);
    expect(isPositiveInteger(0)).toBe(false);
    expect(isPositiveInteger(-3)).toBe(false);
    expect(isPositiveInteger(2.5)).toBe(false);
    expect(isPositiveInteger(Number.NaN)).toBe(false);
    expect(isPositiveInteger("3")).toBe(false);
  });
  it("non-negative integer", () => {
    expect(isNonNegativeInteger(0)).toBe(true);
    expect(isNonNegativeInteger(-1)).toBe(false);
    expect(isNonNegativeInteger(1.1)).toBe(false);
  });
});

describe("validateUserRegistration", () => {
  const valid = { userName: "jane_doe", email: "jane@example.com", password: "Passw0rdX", gamerTag: "Jane" };

  it("passes valid input", () => expect(validateUserRegistration(valid)).toEqual({ valid: true, errors: {} }));

  it("reports every bad field at once", () => {
    const result = validateUserRegistration({ userName: "x", email: "bad", password: "weak", gamerTag: "!" });
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(["email", "gamerTag", "password", "userName"]);
  });
});

describe("validateTournamentInput", () => {
  const start = new Date("2026-07-01T10:00:00Z");
  const valid = { title: "Summer Cup", maxParticipants: 16, prizePool: 0, startDate: start, endDate: start };

  it("accepts boundaries (2 and 128 participants, zero prize, same-day end)", () => {
    expect(validateTournamentInput(valid).valid).toBe(true);
    expect(validateTournamentInput({ ...valid, maxParticipants: 2 }).valid).toBe(true);
    expect(validateTournamentInput({ ...valid, maxParticipants: 128 }).valid).toBe(true);
  });

  it.each([1, 0, -4, 129, 2.5, Number.NaN])("rejects maxParticipants %s", (maxParticipants) => {
    expect(validateTournamentInput({ ...valid, maxParticipants }).errors.maxParticipants).toBeDefined();
  });

  it("rejects negative or non-finite prize", () => {
    expect(validateTournamentInput({ ...valid, prizePool: -1 }).errors.prizePool).toBeDefined();
    expect(validateTournamentInput({ ...valid, prizePool: Number.POSITIVE_INFINITY }).errors.prizePool).toBeDefined();
  });

  it("rejects end before start and invalid dates", () => {
    const earlier = new Date(start.getTime() - 1);
    expect(validateTournamentInput({ ...valid, endDate: earlier }).errors.endDate).toBeDefined();
    expect(validateTournamentInput({ ...valid, startDate: new Date("nope") }).errors.startDate).toBeDefined();
  });

  it("rejects short or over-long titles", () => {
    expect(validateTournamentInput({ ...valid, title: "  a " }).errors.title).toBeDefined();
    expect(validateTournamentInput({ ...valid, title: "x".repeat(81) }).errors.title).toBeDefined();
  });
});

describe("other validators", () => {
  it("team name is trimmed before length check", () => {
    expect(validateTeamName("  ab  ").valid).toBe(false);
    expect(validateTeamName(" Wolves ").valid).toBe(true);
    expect(validateTeamName("x".repeat(33)).valid).toBe(false);
  });

  it("game needs a positive team size", () => {
    expect(validateGame({ name: "Chess", genre: "Board", teamSize: 1 }).valid).toBe(true);
    expect(validateGame({ name: "Chess", genre: "Board", teamSize: 0 }).errors.teamSize).toBeDefined();
    expect(validateGame({ name: "", genre: "", teamSize: 1 }).valid).toBe(false);
  });

  it("scores must be non-negative integers", () => {
    expect(validateScores(0, 3).valid).toBe(true);
    expect(validateScores(-1, 3).errors.scoreA).toBeDefined();
    expect(validateScores(1, 2.5).errors.scoreB).toBeDefined();
  });

  it("proof URL must be http(s)", () => {
    expect(validateProofUrl("https://imgur.com/a.png")).toBe(true);
    expect(validateProofUrl("javascript:alert(1)")).toBe(false);
    expect(validateProofUrl("not a url")).toBe(false);
  });
});
