import { beforeEach, describe, expect, it } from "vitest";
import type { Team } from "@/data/types";
import { createFakeRepositories } from "../helpers/fakes";
import { enrollSoloTeams, makeArena, type Arena } from "../helpers/world";

let arena: Arena;
let teams: Team[];

async function startWith(count: number) {
  arena = await makeArena(createFakeRepositories(), 8);
  teams = await enrollSoloTeams(arena, count);
  await arena.services.tournaments.closeRegistration(arena.organizer.id, arena.tournament.id);
  await arena.services.tournaments.start(arena.organizer.id, arena.tournament.id);
  return (await arena.repos.matches.getByTournament(arena.tournament.id)).filter((m) => m.round === 1);
}

const report = (matchId: number, teamId: number, scoreA: number, scoreB: number, proofUrl?: string) =>
  arena.services.matches.reportResult({ matchId, reportedByTeamId: teamId, scoreA, scoreB, proofUrl });

describe("reportResult", () => {
  let first: Awaited<ReturnType<typeof startWith>>[number];
  beforeEach(async () => {
    [first] = await startWith(4);
  });

  it("a single report leaves the match ready and unconfirmed", async () => {
    const match = await report(first.id, first.teamAId!, 2, 0);
    expect(match.status).toBe("ready");
    const [result] = await arena.repos.matchResults.getByMatch(first.id);
    expect(result.isConfirmed).toBe(false);
  });

  it("matching reports confirm, set the winner and advance them to the correct slot", async () => {
    await report(first.id, first.teamAId!, 2, 1);
    const done = await report(first.id, first.teamBId!, 2, 1);
    expect(done).toMatchObject({ status: "completed", winnerTeamId: first.teamAId });

    const results = await arena.repos.matchResults.getByMatch(first.id);
    expect(results.every((r) => r.isConfirmed)).toBe(true);

    const next = (await arena.repos.matches.getById(first.nextMatchId!))!;
    expect(first.nextSlot === "A" ? next.teamAId : next.teamBId).toBe(first.teamAId);
    expect(next.status).toBe("pending"); // other semi-final not played yet
  });

  it("when both semi-finals finish the final becomes ready", async () => {
    const round1 = (await arena.repos.matches.getByTournament(arena.tournament.id)).filter((m) => m.round === 1);
    for (const m of round1) {
      await report(m.id, m.teamAId!, 1, 0);
      await report(m.id, m.teamBId!, 1, 0);
    }
    const final = (await arena.repos.matches.getByTournament(arena.tournament.id)).find((m) => m.round === 2)!;
    expect(final.status).toBe("ready");
    expect(final.teamAId).not.toBeNull();
    expect(final.teamBId).not.toBeNull();
  });

  it("different reports dispute the match; re-reporting to agree resolves it", async () => {
    await report(first.id, first.teamAId!, 2, 0);
    const disputed = await report(first.id, first.teamBId!, 0, 2);
    expect(disputed.status).toBe("disputed");

    const resolved = await report(first.id, first.teamBId!, 2, 0);
    expect(resolved).toMatchObject({ status: "completed", winnerTeamId: first.teamAId });
    expect(await arena.repos.matchResults.getByMatch(first.id)).toHaveLength(2); // replaced, not duplicated
  });

  it("organizer can settle a dispute; strangers cannot", async () => {
    await report(first.id, first.teamAId!, 2, 0);
    await report(first.id, first.teamBId!, 0, 2);

    await expect(arena.services.matches.resolveDispute(teams[0].captainId, first.id, 2, 0)).rejects.toMatchObject({
      code: "forbidden",
    });
    const settled = await arena.services.matches.resolveDispute(arena.organizer.id, first.id, 0, 2);
    expect(settled).toMatchObject({ status: "completed", winnerTeamId: first.teamBId });
    const results = await arena.repos.matchResults.getByMatch(first.id);
    expect(results.find((r) => r.reportedByTeamId === first.teamBId)!.isConfirmed).toBe(true);
    expect(results.find((r) => r.reportedByTeamId === first.teamAId)!.isConfirmed).toBe(false);
  });

  it("cannot resolve a match that is not disputed", async () => {
    await expect(arena.services.matches.resolveDispute(arena.organizer.id, first.id, 1, 0)).rejects.toMatchObject({
      code: "invalid_state",
    });
  });

  it("rejects ties, negative and fractional scores", async () => {
    await expect(report(first.id, first.teamAId!, 1, 1)).rejects.toMatchObject({ code: "validation" });
    await expect(report(first.id, first.teamAId!, -1, 1)).rejects.toMatchObject({ code: "validation" });
    await expect(report(first.id, first.teamAId!, 1.5, 0)).rejects.toMatchObject({ code: "validation" });
  });

  it("rejects bad proof URLs", async () => {
    await expect(report(first.id, first.teamAId!, 1, 0, "javascript:alert(1)")).rejects.toMatchObject({
      code: "validation",
    });
    await expect(report(first.id, first.teamAId!, 1, 0, "https://example.com/proof.png")).resolves.toBeDefined();
  });

  it("only participating teams may report", async () => {
    const outsider = teams.find((t) => t.id !== first.teamAId && t.id !== first.teamBId)!;
    await expect(report(first.id, outsider.id, 1, 0)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("cannot report on completed, pending or unknown matches", async () => {
    await report(first.id, first.teamAId!, 1, 0);
    await report(first.id, first.teamBId!, 1, 0);
    await expect(report(first.id, first.teamAId!, 1, 0)).rejects.toMatchObject({ code: "invalid_state" });

    const final = (await arena.repos.matches.getByTournament(arena.tournament.id)).find((m) => m.round === 2)!;
    await expect(report(final.id, first.teamAId!, 1, 0)).rejects.toMatchObject({ code: "invalid_state" });
    await expect(report(9999, first.teamAId!, 1, 0)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("full tournament", () => {
  it("playing every match completes the tournament and crowns the final winner", async () => {
    await startWith(8);
    for (let round = 1; round <= 3; round++) {
      const matches = (await arena.repos.matches.getByTournament(arena.tournament.id)).filter(
        (m) => m.round === round,
      );
      for (const m of matches) {
        await report(m.id, m.teamAId!, 3, 1);
        await report(m.id, m.teamBId!, 3, 1);
      }
    }
    const tournament = (await arena.repos.tournaments.getById(arena.tournament.id))!;
    expect(tournament.status).toBe("completed");

    const all = await arena.repos.matches.getByTournament(arena.tournament.id);
    const final = all.find((m) => m.nextMatchId === null)!;
    expect(final.winnerTeamId).toBe(teams[0].id); // Team A always wins and seed 1 is always slot A in its path
  });

  it("a bye bracket (5 teams) can be played to the end", async () => {
    await startWith(5);
    for (let round = 1; round <= 3; round++) {
      const matches = (await arena.repos.matches.getByTournament(arena.tournament.id)).filter(
        (m) => m.round === round && m.status === "ready",
      );
      for (const m of matches) {
        await report(m.id, m.teamAId!, 1, 0);
        await report(m.id, m.teamBId!, 1, 0);
      }
    }
    expect((await arena.repos.tournaments.getById(arena.tournament.id))!.status).toBe("completed");
  });

  it("reports are refused once the tournament is not in progress", async () => {
    const [match] = await startWith(4);
    await arena.services.tournaments.cancel(arena.organizer.id, arena.tournament.id);
    await expect(report(match.id, match.teamAId!, 1, 0)).rejects.toMatchObject({ code: "invalid_state" });
  });
});
