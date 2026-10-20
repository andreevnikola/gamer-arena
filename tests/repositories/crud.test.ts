import { describe, expect, it } from "vitest";
import type { IRepository } from "@/repositories";
import { EntityNotFoundError } from "@/repositories";
import { useTestDb } from "../helpers/db";
import { DAY, NOW, makeGame, makeTournament, makeUser } from "../helpers/world";

/** Every repository must satisfy the same IRepository<T> contract. */
async function expectCrud<T extends { id: number }, N>(
  repo: IRepository<T, N>,
  make: () => Promise<N>,
  change: (row: T) => T,
) {
  const baseline = (await repo.getAll()).length;
  expect(await repo.getById(9999)).toBeUndefined();

  const created = await repo.add(await make());
  expect(created.id).toBeGreaterThan(0);
  expect(await repo.getById(created.id)).toEqual(created);
  expect(await repo.getAll()).toHaveLength(baseline + 1);

  const changed = change(created);
  expect(await repo.update(changed)).toEqual(changed);
  expect(await repo.getById(created.id)).toEqual(changed);

  expect(await repo.delete(created.id)).toBe(true);
  expect(await repo.delete(created.id)).toBe(false);
  expect(await repo.getById(created.id)).toBeUndefined();
  await expect(repo.update(changed)).rejects.toBeInstanceOf(EntityNotFoundError);
}

describe("IRepository<T> contract per entity", () => {
  it("users", async () => {
    const { repos } = useTestDb();
    await expectCrud(
      repos.users,
      async () => ({ userName: "u", email: "u@x.io", passwordHash: "h", gamerTag: "GT" }),
      (u) => ({ ...u, gamerTag: "Changed", role: "organizer" as const }),
    );
  });

  it("games", async () => {
    const { repos } = useTestDb();
    await expectCrud(repos.games, async () => ({ name: "G", genre: "x", teamSize: 2 }), (g) => ({ ...g, teamSize: 5 }));
  });

  it("teams", async () => {
    const { repos } = useTestDb();
    const captain = await makeUser(repos);
    await expectCrud(
      repos.teams,
      async () => ({ name: "T", captainId: captain.id }),
      (t) => ({ ...t, name: "Renamed", isSoloEntry: true }),
    );
  });

  it("team members", async () => {
    const { repos } = useTestDb();
    const user = await makeUser(repos);
    const team = await repos.teams.add({ name: "T", captainId: user.id });
    await expectCrud(
      repos.teamMembers,
      async () => ({ teamId: team.id, userId: user.id }),
      (m) => ({ ...m, invitationStatus: "accepted" as const, joinedOn: NOW }),
    );
  });

  it("tournaments", async () => {
    const { repos } = useTestDb();
    const organizer = await makeUser(repos, "organizer");
    const game = await makeGame(repos);
    await expectCrud(
      repos.tournaments,
      async () => ({
        gameId: game.id,
        organizerId: organizer.id,
        title: "Cup",
        maxParticipants: 8,
        startDate: NOW,
        endDate: new Date(NOW.getTime() + DAY),
      }),
      (t) => ({ ...t, status: "registration_open" as const, prizePool: 99.5 }),
    );
  });

  it("tournament teams", async () => {
    const { repos } = useTestDb();
    const organizer = await makeUser(repos, "organizer");
    const tournament = await makeTournament(repos, organizer, await makeGame(repos));
    const team = await repos.teams.add({ name: "T", captainId: organizer.id });
    await expectCrud(
      repos.tournamentTeams,
      async () => ({ tournamentId: tournament.id, teamId: team.id }),
      (e) => ({ ...e, status: "approved" as const, seed: 3 }),
    );
  });

  it("matches (including self-reference)", async () => {
    const { repos } = useTestDb();
    const organizer = await makeUser(repos, "organizer");
    const tournament = await makeTournament(repos, organizer, await makeGame(repos));
    const final = await repos.matches.add({ tournamentId: tournament.id, round: 2, bracketPosition: 0 });
    await expectCrud(
      repos.matches,
      async () => ({ tournamentId: tournament.id, round: 1, bracketPosition: 0, nextMatchId: final.id, nextSlot: "A" as const }),
      (m) => ({ ...m, status: "ready" as const }),
    );
  });

  it("match results", async () => {
    const { repos } = useTestDb();
    const organizer = await makeUser(repos, "organizer");
    const tournament = await makeTournament(repos, organizer, await makeGame(repos));
    const team = await repos.teams.add({ name: "T", captainId: organizer.id });
    const match = await repos.matches.add({ tournamentId: tournament.id, round: 1, bracketPosition: 0 });
    await expectCrud(
      repos.matchResults,
      async () => ({ matchId: match.id, reportedByTeamId: team.id, scoreA: 2, scoreB: 1 }),
      (r) => ({ ...r, isConfirmed: true, proofUrl: "https://x.io/p.png" }),
    );
  });

  it("announcements (tournament optional)", async () => {
    const { repos } = useTestDb();
    const author = await makeUser(repos, "organizer");
    await expectCrud(
      repos.announcements,
      async () => ({ authorId: author.id, title: "Hi", content: "Body" }),
      (a) => ({ ...a, title: "Edited" }),
    );
  });
});
