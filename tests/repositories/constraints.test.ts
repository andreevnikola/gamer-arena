import { describe, expect, it } from "vitest";
import { PG_ERROR, expectDbError, useTestDb } from "../helpers/db";
import { DAY, NOW, makeGame, makeTournament, makeUser } from "../helpers/world";

describe("schema constraints (Postgres enforces what the ERD promises)", () => {
  it("rejects duplicate email, user name and gamer tag", async () => {
    const { repos } = await useTestDb();
    const base = { userName: "a", email: "a@x.io", passwordHash: "h", gamerTag: "AAA" };
    await repos.users.add(base);
    await expectDbError(repos.users.add({ ...base, userName: "b", gamerTag: "BBB" }), PG_ERROR.unique);
    await expectDbError(repos.users.add({ ...base, email: "b@x.io", gamerTag: "BBB" }), PG_ERROR.unique);
    await expectDbError(repos.users.add({ ...base, email: "b@x.io", userName: "b" }), PG_ERROR.unique);
  });

  it("rejects dangling foreign keys", async () => {
    const { repos } = await useTestDb();
    await expectDbError(repos.teams.add({ name: "T", captainId: 999 }), PG_ERROR.foreignKey);
  });

  it("restricts deleting a user who captains a team, cascades team members", async () => {
    const { repos } = await useTestDb();
    const captain = await makeUser(repos);
    const team = await repos.teams.add({ name: "T", captainId: captain.id });
    await repos.teamMembers.add({ teamId: team.id, userId: captain.id });

    await expectDbError(repos.users.delete(captain.id), PG_ERROR.restrict);
    expect(await repos.teams.delete(team.id)).toBe(true);
    expect(await repos.teamMembers.getAll()).toEqual([]);
  });

  it("deleting a tournament cascades to registrations and matches; announcements keep existing", async () => {
    const { repos } = await useTestDb();
    const organizer = await makeUser(repos, "organizer");
    const tournament = await makeTournament(repos, organizer, await makeGame(repos));
    const team = await repos.teams.add({ name: "T", captainId: organizer.id });
    await repos.tournamentTeams.add({ tournamentId: tournament.id, teamId: team.id });
    await repos.matches.add({ tournamentId: tournament.id, round: 1, bracketPosition: 0 });
    const note = await repos.announcements.add({
      authorId: organizer.id,
      tournamentId: tournament.id,
      title: "t",
      content: "c",
    });

    await repos.tournaments.delete(tournament.id);
    expect(await repos.tournamentTeams.getAll()).toEqual([]);
    expect(await repos.matches.getAll()).toEqual([]);
    expect((await repos.announcements.getById(note.id))!.tournamentId).toBeNull();
  });

  it("one membership per user per team, one registration per team per tournament, one report per team per match", async () => {
    const { repos } = await useTestDb();
    const organizer = await makeUser(repos, "organizer");
    const tournament = await makeTournament(repos, organizer, await makeGame(repos));
    const team = await repos.teams.add({ name: "T", captainId: organizer.id });
    const match = await repos.matches.add({ tournamentId: tournament.id, round: 1, bracketPosition: 0 });

    await repos.teamMembers.add({ teamId: team.id, userId: organizer.id });
    await expectDbError(repos.teamMembers.add({ teamId: team.id, userId: organizer.id }), PG_ERROR.unique);

    await repos.tournamentTeams.add({ tournamentId: tournament.id, teamId: team.id });
    await expectDbError(repos.tournamentTeams.add({ tournamentId: tournament.id, teamId: team.id }), PG_ERROR.unique);

    const result = { matchId: match.id, reportedByTeamId: team.id, scoreA: 1, scoreB: 0 };
    await repos.matchResults.add(result);
    await expectDbError(repos.matchResults.add(result), PG_ERROR.unique);
  });

  it("CHECK constraints guard numbers and dates", async () => {
    const { repos } = await useTestDb();
    const organizer = await makeUser(repos, "organizer");
    const game = await makeGame(repos);
    const valid = {
      gameId: game.id,
      organizerId: organizer.id,
      title: "Cup",
      maxParticipants: 8,
      startDate: NOW,
      endDate: new Date(NOW.getTime() + DAY),
    };
    await expectDbError(repos.games.add({ name: "Bad", genre: "x", teamSize: 0 }), PG_ERROR.check);
    await expectDbError(repos.tournaments.add({ ...valid, maxParticipants: 1 }), PG_ERROR.check);
    await expectDbError(repos.tournaments.add({ ...valid, prizePool: -1 }), PG_ERROR.check);
    await expectDbError(repos.tournaments.add({ ...valid, endDate: new Date(NOW.getTime() - DAY) }), PG_ERROR.check);

    const t = await repos.tournaments.add(valid);
    const team = await repos.teams.add({ name: "T", captainId: organizer.id });
    const m = await repos.matches.add({ tournamentId: t.id, round: 1, bracketPosition: 0 });
    await expectDbError(
      repos.matchResults.add({ matchId: m.id, reportedByTeamId: team.id, scoreA: -1, scoreB: 0 }),
      PG_ERROR.check,
    );
  });

  it("applies column defaults", async () => {
    const { repos } = await useTestDb();
    const user = await repos.users.add({ userName: "a", email: "a@x.io", passwordHash: "h", gamerTag: "AAA" });
    expect(user.role).toBe("player");
    expect(user.registeredOn).toBeInstanceOf(Date);
    const team = await repos.teams.add({ name: "T", captainId: user.id });
    expect(team.isSoloEntry).toBe(false);
  });
});
