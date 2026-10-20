import { describe, expect, it } from "vitest";
import { useTestDb } from "../helpers/db";
import { DAY, NOW, makeGame, makeTournament, makeUser } from "../helpers/world";

describe("schema constraints (SQLite enforces what the ERD promises)", () => {
  it("rejects duplicate email, user name and gamer tag", async () => {
    const { repos } = useTestDb();
    const base = { userName: "a", email: "a@x.io", passwordHash: "h", gamerTag: "AAA" };
    await repos.users.add(base);
    await expect(repos.users.add({ ...base, userName: "b", gamerTag: "BBB" })).rejects.toThrow(/UNIQUE/);
    await expect(repos.users.add({ ...base, email: "b@x.io", gamerTag: "BBB" })).rejects.toThrow(/UNIQUE/);
    await expect(repos.users.add({ ...base, email: "b@x.io", userName: "b" })).rejects.toThrow(/UNIQUE/);
  });

  it("rejects dangling foreign keys", async () => {
    const { repos } = useTestDb();
    await expect(repos.teams.add({ name: "T", captainId: 999 })).rejects.toThrow(/FOREIGN KEY/);
  });

  it("restricts deleting a user who captains a team, cascades team members", async () => {
    const { repos } = useTestDb();
    const captain = await makeUser(repos);
    const team = await repos.teams.add({ name: "T", captainId: captain.id });
    await repos.teamMembers.add({ teamId: team.id, userId: captain.id });

    await expect(repos.users.delete(captain.id)).rejects.toThrow(/FOREIGN KEY/);
    expect(await repos.teams.delete(team.id)).toBe(true);
    expect(await repos.teamMembers.getAll()).toEqual([]);
  });

  it("deleting a tournament cascades to registrations and matches; announcements keep existing", async () => {
    const { repos } = useTestDb();
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
    const { repos } = useTestDb();
    const organizer = await makeUser(repos, "organizer");
    const tournament = await makeTournament(repos, organizer, await makeGame(repos));
    const team = await repos.teams.add({ name: "T", captainId: organizer.id });
    const match = await repos.matches.add({ tournamentId: tournament.id, round: 1, bracketPosition: 0 });

    await repos.teamMembers.add({ teamId: team.id, userId: organizer.id });
    await expect(repos.teamMembers.add({ teamId: team.id, userId: organizer.id })).rejects.toThrow(/UNIQUE/);

    await repos.tournamentTeams.add({ tournamentId: tournament.id, teamId: team.id });
    await expect(repos.tournamentTeams.add({ tournamentId: tournament.id, teamId: team.id })).rejects.toThrow(/UNIQUE/);

    const result = { matchId: match.id, reportedByTeamId: team.id, scoreA: 1, scoreB: 0 };
    await repos.matchResults.add(result);
    await expect(repos.matchResults.add(result)).rejects.toThrow(/UNIQUE/);
  });

  it("CHECK constraints guard numbers and dates", async () => {
    const { repos } = useTestDb();
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
    await expect(repos.games.add({ name: "Bad", genre: "x", teamSize: 0 })).rejects.toThrow(/CHECK/);
    await expect(repos.tournaments.add({ ...valid, maxParticipants: 1 })).rejects.toThrow(/CHECK/);
    await expect(repos.tournaments.add({ ...valid, prizePool: -1 })).rejects.toThrow(/CHECK/);
    await expect(repos.tournaments.add({ ...valid, endDate: new Date(NOW.getTime() - DAY) })).rejects.toThrow(/CHECK/);

    const t = await repos.tournaments.add(valid);
    const team = await repos.teams.add({ name: "T", captainId: organizer.id });
    const m = await repos.matches.add({ tournamentId: t.id, round: 1, bracketPosition: 0 });
    await expect(
      repos.matchResults.add({ matchId: m.id, reportedByTeamId: team.id, scoreA: -1, scoreB: 0 }),
    ).rejects.toThrow(/CHECK/);
  });

  it("applies column defaults", async () => {
    const { repos } = useTestDb();
    const user = await repos.users.add({ userName: "a", email: "a@x.io", passwordHash: "h", gamerTag: "AAA" });
    expect(user.role).toBe("player");
    expect(user.registeredOn).toBeInstanceOf(Date);
    const team = await repos.teams.add({ name: "T", captainId: user.id });
    expect(team.isSoloEntry).toBe(false);
  });
});
