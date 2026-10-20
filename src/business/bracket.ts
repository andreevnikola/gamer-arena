import type { BracketSlot } from "@/data/types";

export interface PlannedMatch {
  round: number;
  position: number;
  teamAId: number | null;
  teamBId: number | null;
  winnerTeamId: number | null;
  status: "pending" | "ready" | "completed";
  next: { round: number; position: number; slot: BracketSlot } | null;
}

export const nextPowerOfTwo = (n: number): number => 2 ** Math.ceil(Math.log2(n));

/** Standard bracket slot order: seeds 1 and 2 can only meet in the final. seedOrder(8) = [1,8,4,5,2,7,3,6]. */
export function seedOrder(size: number): number[] {
  if (size === 2) return [1, 2];
  return seedOrder(size / 2).flatMap((seed) => [seed, size + 1 - seed]);
}

/**
 * Builds a single-elimination bracket. `teamIdsBySeed[0]` is seed 1.
 * Non-power-of-two fields get byes for the top seeds: the match is
 * created already completed and the team is placed in round 2.
 * Pure function: no database, no clock.
 */
export function generateBracket(teamIdsBySeed: number[]): PlannedMatch[] {
  const count = teamIdsBySeed.length;
  if (count < 2) throw new RangeError("A bracket needs at least 2 teams.");
  if (new Set(teamIdsBySeed).size !== count) throw new RangeError("Teams must be unique.");

  const size = nextPowerOfTwo(count);
  const rounds = Math.log2(size);
  const order = seedOrder(size);
  const teamForSeed = (seed: number) => teamIdsBySeed[seed - 1] ?? null;

  const matches: PlannedMatch[] = [];
  for (let round = 1; round <= rounds; round++) {
    const inRound = size / 2 ** round;
    for (let position = 0; position < inRound; position++) {
      matches.push({
        round,
        position,
        teamAId: round === 1 ? teamForSeed(order[position * 2]) : null,
        teamBId: round === 1 ? teamForSeed(order[position * 2 + 1]) : null,
        winnerTeamId: null,
        status: "pending",
        next:
          round === rounds
            ? null
            : { round: round + 1, position: Math.floor(position / 2), slot: position % 2 === 0 ? "A" : "B" },
      });
    }
  }

  const find = (round: number, position: number) =>
    matches.find((m) => m.round === round && m.position === position)!;

  for (const match of matches.filter((m) => m.round === 1)) {
    const hasBye = match.teamAId === null || match.teamBId === null;
    if (hasBye) {
      const winner = match.teamAId ?? match.teamBId;
      match.winnerTeamId = winner;
      match.status = "completed";
      const target = find(match.next!.round, match.next!.position);
      if (match.next!.slot === "A") target.teamAId = winner;
      else target.teamBId = winner;
    }
  }
  for (const match of matches) {
    if (match.status === "pending" && match.teamAId !== null && match.teamBId !== null) {
      match.status = "ready";
    }
  }
  return matches;
}

export function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semi-final";
  if (fromEnd === 2) return "Quarter-final";
  return `Round of ${2 ** (fromEnd + 1)}`;
}
