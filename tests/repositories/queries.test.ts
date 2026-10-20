import { describe, expect, it } from "vitest";
import { useTestDb } from "../helpers/db";
import { makeGame, makeTournament, makeUser } from "../helpers/world";

describe("specific repository queries", () => {
  it("users: lookups by email (case-insensitive input), user name and gamer tag", async () => {
    const { repos } = useTestDb();
    const u = await repos.users.add({ userName: "jane", email: "jane@x.io", passwordHash: "h", gamerTag: "Jane" });
    expect((await repos.users.getByEmail("JANE@x.io"))?.id).toBe(u.id);
    expect((await repos.users.getByUserName("jane"))?.id).toBe(u.id);
    expect((await repos.users.getByGamerTag("Jane"))?.id).toBe(u.id);
    expect(await repos.users.getByEmail("nobody@x.io")).toBeUndefined();
  });

  it("teams and members", async () => {
    const { repos } = useTestDb();
    const [a, b] = [await makeUser(repos), await makeUser(repos)];
    const t1 = await repos.teams.add({ name: "One", captainId: a.id });
    await repos.teams.add({ name: "Two", captainId: b.id });
    expect((await repos.teams.getByCaptain(a.id)).map((t) => t.id)).toEqual([t1.id]);
    expect((await repos.teams.getByName("Two"))?.captainId).toBe(b.id);

    await repos.teamMembers.add({ teamId: t1.id, userId: a.id });
    await repos.teamMembers.add({ teamId: t1.id, userId: b.id });
    expect(await repos.teamMembers.getByTeam(t1.id)).toHaveLength(2);
    expect(await repos.teamMembers.getByUser(b.id)).toHaveLength(1);
    expect((await repos.teamMembers.getByTeamAndUser(t1.id, b.id))?.userId).toBe(b.id);
    expect(await repos.teamMembers.getByTeamAndUser(t1.id, 999)).toBeUndefined();
  });

  it("tournaments by organizer and status; registrations by tournament", async () => {
    const { repos } = useTestDb();
    const [o1, o2] = [await makeUser(repos, "organizer"), await makeUser(repos, "organizer")];
    const game = await makeGame(repos);
    const t1 = await makeTournament(repos, o1, game, { status: "draft" });
    const t2 = await makeTournament(repos, o2, game, { status: "registration_open" });
    expect((await repos.tournaments.getByOrganizer(o1.id)).map((t) => t.id)).toEqual([t1.id]);
    expect((await repos.tournaments.getByStatus("registration_open")).map((t) => t.id)).toEqual([t2.id]);

    const team = await repos.teams.add({ name: "T", captainId: o1.id });
    const entry = await repos.tournamentTeams.add({ tournamentId: t2.id, teamId: team.id });
    expect((await repos.tournamentTeams.getByTournament(t2.id)).map((e) => e.id)).toEqual([entry.id]);
    expect(await repos.tournamentTeams.getByTournament(t1.id)).toEqual([]);
    expect((await repos.tournamentTeams.getByTournamentAndTeam(t2.id, team.id))?.id).toBe(entry.id);
  });

  it("matches come back ordered by round then position; results and announcements by parent", async () => {
    const { repos } = useTestDb();
    const organizer = await makeUser(repos, "organizer");
    const tournament = await makeTournament(repos, organizer, await makeGame(repos));
    await repos.matches.add({ tournamentId: tournament.id, round: 2, bracketPosition: 0 });
    await repos.matches.add({ tournamentId: tournament.id, round: 1, bracketPosition: 1 });
    await repos.matches.add({ tournamentId: tournament.id, round: 1, bracketPosition: 0 });
    const order = (await repos.matches.getByTournament(tournament.id)).map((m) => [m.round, m.bracketPosition]);
    expect(order).toEqual([
      [1, 0],
      [1, 1],
      [2, 0],
    ]);

    const [match] = await repos.matches.getByTournament(tournament.id);
    const team = await repos.teams.add({ name: "T", captainId: organizer.id });
    await repos.matchResults.add({ matchId: match.id, reportedByTeamId: team.id, scoreA: 1, scoreB: 0 });
    expect(await repos.matchResults.getByMatch(match.id)).toHaveLength(1);

    await repos.announcements.add({ authorId: organizer.id, tournamentId: tournament.id, title: "a", content: "b" });
    await repos.announcements.add({ authorId: organizer.id, title: "global", content: "b" });
    expect(await repos.announcements.getByTournament(tournament.id)).toHaveLength(1);
  });
});

describe("unit of work", () => {
  it("commits all writes when the callback succeeds", async () => {
    const { repos } = useTestDb();
    await repos.unitOfWork.run(async () => {
      await makeUser(repos);
      await makeUser(repos);
    });
    expect(await repos.users.getAll()).toHaveLength(2);
  });

  it("rolls everything back when the callback throws, and rethrows", async () => {
    const { repos } = useTestDb();
    await expect(
      repos.unitOfWork.run(async () => {
        await makeUser(repos);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await repos.users.getAll()).toEqual([]);
  });

  it("nested runs join the outer transaction", async () => {
    const { repos } = useTestDb();
    await expect(
      repos.unitOfWork.run(async () => {
        await repos.unitOfWork.run(() => makeUser(repos));
        throw new Error("outer fails");
      }),
    ).rejects.toThrow("outer fails");
    expect(await repos.users.getAll()).toEqual([]);

    await repos.unitOfWork.run(() => makeUser(repos)); // connection still usable afterwards
    expect(await repos.users.getAll()).toHaveLength(1);
  });
});
