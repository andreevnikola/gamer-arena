import { describe, expect, it } from "vitest";
import { generateBracket, nextPowerOfTwo, roundLabel, seedOrder } from "@/business/bracket";

const teams = (n: number) => Array.from({ length: n }, (_, i) => 100 + i);

describe("seedOrder", () => {
  it("places seeds so 1 and 2 can only meet in the final", () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe("nextPowerOfTwo", () => {
  it.each([
    [2, 2],
    [3, 4],
    [4, 4],
    [5, 8],
    [16, 16],
    [17, 32],
  ])("%i -> %i", (n, expected) => expect(nextPowerOfTwo(n)).toBe(expected));
});

describe("generateBracket", () => {
  it("rejects fewer than 2 teams and duplicates", () => {
    expect(() => generateBracket([])).toThrow(RangeError);
    expect(() => generateBracket([1])).toThrow(RangeError);
    expect(() => generateBracket([1, 1])).toThrow(RangeError);
  });

  it("2 teams: a single ready final", () => {
    const [final, ...rest] = generateBracket([7, 9]);
    expect(rest).toHaveLength(0);
    expect(final).toMatchObject({ round: 1, teamAId: 7, teamBId: 9, status: "ready", next: null });
  });

  it("3 teams: top seed gets a bye into the final", () => {
    const plan = generateBracket([1, 2, 3]);
    expect(plan).toHaveLength(3);
    const bye = plan.find((m) => m.round === 1 && m.status === "completed")!;
    expect(bye.winnerTeamId).toBe(1);
    const final = plan.find((m) => m.round === 2)!;
    expect(final.teamAId).toBe(1);
    expect(final.teamBId).toBeNull();
    expect(final.status).toBe("pending");
  });

  it("8 teams: no byes, round 1 all ready, 7 matches", () => {
    const plan = generateBracket(teams(8));
    expect(plan).toHaveLength(7);
    const round1 = plan.filter((m) => m.round === 1);
    expect(round1.every((m) => m.status === "ready")).toBe(true);
    expect(plan.filter((m) => m.round > 1).every((m) => m.status === "pending")).toBe(true);
  });

  it("seeds 1 and 2 are in opposite halves and seed 1 plays the lowest seed", () => {
    const plan = generateBracket(teams(8));
    const round1 = plan.filter((m) => m.round === 1);
    expect(round1[0]).toMatchObject({ teamAId: 100, teamBId: 107 });
    const half = (id: number) => round1.findIndex((m) => m.teamAId === id || m.teamBId === id) < 2;
    expect(half(100)).not.toBe(half(101));
  });

  it.each(Array.from({ length: 39 }, (_, i) => i + 2))("invariants hold for %i teams", (n) => {
    const plan = generateBracket(teams(n));
    const size = nextPowerOfTwo(n);

    expect(plan).toHaveLength(size - 1);
    expect(plan.filter((m) => m.next === null)).toHaveLength(1); // exactly one final
    expect(plan.filter((m) => m.status === "completed")).toHaveLength(size - n); // one bye per missing team

    // Every team starts in exactly one round-1 slot or is carried to round 2 by a bye.
    const placed = plan.flatMap((m) => (m.round === 1 ? [m.teamAId, m.teamBId] : [])).filter((id) => id !== null);
    expect([...placed].sort()).toEqual(teams(n));

    // Every non-final match feeds a real slot, and no slot is fed twice.
    const feeds = new Set<string>();
    for (const m of plan.filter((x) => x.next)) {
      const target = plan.find((t) => t.round === m.next!.round && t.position === m.next!.position);
      expect(target).toBeDefined();
      const key = `${m.next!.round}:${m.next!.position}:${m.next!.slot}`;
      expect(feeds.has(key)).toBe(false);
      feeds.add(key);
    }

    // Statuses are consistent with the teams present.
    for (const m of plan) {
      if (m.status === "ready") expect(m.teamAId !== null && m.teamBId !== null).toBe(true);
      if (m.status === "completed") expect(m.winnerTeamId).not.toBeNull();
    }
  });
});

describe("roundLabel", () => {
  it("names the last rounds", () => {
    expect(roundLabel(4, 4)).toBe("Final");
    expect(roundLabel(3, 4)).toBe("Semi-final");
    expect(roundLabel(2, 4)).toBe("Quarter-final");
    expect(roundLabel(1, 4)).toBe("Round of 16");
  });
});
