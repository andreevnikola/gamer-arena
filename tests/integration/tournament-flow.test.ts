import { describe, expect, it } from "vitest";
import { createServices } from "@/business";
import { seedDatabase, SEED_PASSWORD } from "../../scripts/seed-data";
import { verifyPassword } from "@/business/password";
import { PG_ERROR, expectDbError, useTestDb } from "../helpers/db";
import { NOW, enrollSoloTeams, makeArena } from "../helpers/world";

describe("services on a real Postgres database", () => {
  it("runs a 6-team tournament (with byes) from registration to a champion", async () => {
    const { repos } = await useTestDb();
    const arena = await makeArena(repos);
    const teams = await enrollSoloTeams(arena, 6);
    await arena.services.tournaments.closeRegistration(arena.organizer.id, arena.tournament.id);
    await arena.services.tournaments.start(arena.organizer.id, arena.tournament.id);

    for (let round = 1; round <= 3; round++) {
      const ready = (await repos.matches.getByTournament(arena.tournament.id)).filter(
        (m) => m.round === round && m.status === "ready",
      );
      for (const match of ready) {
        for (const side of [match.teamAId!, match.teamBId!]) {
          await arena.services.matches.reportResult({
            matchId: match.id,
            reportedByTeamId: side,
            scoreA: 2,
            scoreB: 0,
          });
        }
      }
    }

    expect((await repos.tournaments.getById(arena.tournament.id))!.status).toBe("completed");
    const bracket = await arena.services.tournaments.getBracket(arena.tournament.id);
    const final = bracket.rounds.at(-1)!.matches[0];
    expect(final.status).toBe("completed");
    expect(teams.map((t) => t.id)).toContain(final.winnerTeamId);
    expect(final).toMatchObject({ scoreA: 2, scoreB: 0 });
  });

  it("start() is atomic: a failure after seeding leaves no matches and no seeds behind", async () => {
    const { repos } = await useTestDb();
    const arena = await makeArena(repos);
    await enrollSoloTeams(arena, 4);
    await arena.services.tournaments.closeRegistration(arena.organizer.id, arena.tournament.id);

    const failing = {
      ...repos,
      tournaments: Object.assign(Object.create(repos.tournaments), {
        update: async () => {
          throw new Error("disk full");
        },
      }),
    };
    const services = createServices(failing, () => NOW);
    await expect(services.tournaments.start(arena.organizer.id, arena.tournament.id)).rejects.toThrow("disk full");

    expect(await repos.matches.getByTournament(arena.tournament.id)).toEqual([]);
    const entries = await repos.tournamentTeams.getByTournament(arena.tournament.id);
    expect(entries.every((e) => e.seed === null)).toBe(true);
    expect((await repos.tournaments.getById(arena.tournament.id))!.status).toBe("registration_closed");
  });

  it("DB constraints back the services up: concurrent duplicate registration is impossible", async () => {
    const { repos } = await useTestDb();
    const arena = await makeArena(repos);
    const [team] = await enrollSoloTeams(arena, 1);
    await expectDbError(
      repos.tournamentTeams.add({ tournamentId: arena.tournament.id, teamId: team.id }),
      PG_ERROR.unique,
    );
  });
});

describe("seed", () => {
  it("builds demo data through the business rules and is idempotent", async () => {
    const { repos } = await useTestDb();
    expect(await seedDatabase(repos)).toBe(true);
    expect(await seedDatabase(repos)).toBe(false);

    const services = createServices(repos);
    const tournaments = await services.tournaments.list();
    expect(tournaments.map((t) => t.status).sort()).toEqual(["draft", "in_progress", "registration_open"]);

    const showdown = tournaments.find((t) => t.title === "Spring Showdown")!;
    const bracket = await services.tournaments.getBracket(showdown.id);
    expect(bracket.rounds.map((r) => r.matches.length)).toEqual([4, 2, 1]);
    expect(bracket.rounds[0].matches.filter((m) => m.status === "completed")).toHaveLength(3);

    const admin = await repos.users.getByUserName("admin");
    expect(admin?.role).toBe("admin");
    expect(await verifyPassword(SEED_PASSWORD, admin!.passwordHash)).toBe(true);
  });
});
