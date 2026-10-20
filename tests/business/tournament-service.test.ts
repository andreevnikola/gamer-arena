import { beforeEach, describe, expect, it } from "vitest";
import { canTransition } from "@/business";
import { TOURNAMENT_STATUSES } from "@/data/schema";
import { createFakeRepositories } from "../helpers/fakes";
import { DAY, NOW, enrollSoloTeams, makeArena, makeUser, type Arena } from "../helpers/world";

let arena: Arena;
beforeEach(async () => {
  arena = await makeArena(createFakeRepositories());
});

const input = (gameId: number) => ({
  gameId,
  title: "New Cup",
  maxParticipants: 16,
  prizePool: 250,
  startDate: new Date(NOW.getTime() + DAY),
  endDate: new Date(NOW.getTime() + 2 * DAY),
});

describe("createTournament", () => {
  it("organizers and admins create draft tournaments owned by them", async () => {
    const created = await arena.services.tournaments.createTournament(arena.organizer.id, input(arena.game.id));
    expect(created).toMatchObject({ status: "draft", organizerId: arena.organizer.id, format: "single_elimination" });
    await expect(arena.services.tournaments.createTournament(arena.admin.id, input(arena.game.id))).resolves.toBeDefined();
  });

  it("players cannot create tournaments", async () => {
    const player = await makeUser(arena.repos);
    await expect(arena.services.tournaments.createTournament(player.id, input(arena.game.id))).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("reports field errors for invalid data and unknown games", async () => {
    await expect(
      arena.services.tournaments.createTournament(arena.organizer.id, { ...input(arena.game.id), maxParticipants: 1, prizePool: -5 }),
    ).rejects.toMatchObject({ code: "validation", fields: { maxParticipants: expect.any(String), prizePool: expect.any(String) } });
    await expect(arena.services.tournaments.createTournament(arena.organizer.id, input(999))).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("lifecycle", () => {
  it("walks draft -> open -> closed -> in_progress", async () => {
    const draft = await arena.services.tournaments.createTournament(arena.organizer.id, input(arena.game.id));
    const open = await arena.services.tournaments.openRegistration(arena.organizer.id, draft.id);
    expect(open.status).toBe("registration_open");
    expect((await arena.services.tournaments.closeRegistration(arena.organizer.id, draft.id)).status).toBe(
      "registration_closed",
    );
  });

  it("transition table: completed and cancelled are terminal", () => {
    for (const to of TOURNAMENT_STATUSES) {
      expect(canTransition("completed", to)).toBe(false);
      expect(canTransition("cancelled", to)).toBe(false);
    }
    expect(canTransition("draft", "in_progress")).toBe(false);
  });

  it("rejects illegal transitions", async () => {
    await expect(arena.services.tournaments.closeRegistration(arena.organizer.id, arena.tournament.id)).resolves.toBeDefined();
    await expect(arena.services.tournaments.cancel(arena.organizer.id, arena.tournament.id)).resolves.toBeDefined();
    await expect(arena.services.tournaments.openRegistration(arena.organizer.id, arena.tournament.id)).rejects.toMatchObject({
      code: "invalid_state",
    });
  });

  it("only the owning organizer or an admin manages a tournament", async () => {
    const rival = await makeUser(arena.repos, "organizer");
    const player = await makeUser(arena.repos);
    await expect(arena.services.tournaments.closeRegistration(rival.id, arena.tournament.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(arena.services.tournaments.closeRegistration(player.id, arena.tournament.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(arena.services.tournaments.closeRegistration(arena.admin.id, arena.tournament.id)).resolves.toBeDefined();
    await expect(arena.services.tournaments.closeRegistration(arena.admin.id, 404)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("start", () => {
  it("needs at least 2 approved teams and leaves status untouched on failure", async () => {
    await enrollSoloTeams(arena, 1);
    await arena.services.tournaments.closeRegistration(arena.organizer.id, arena.tournament.id);
    await expect(arena.services.tournaments.start(arena.organizer.id, arena.tournament.id)).rejects.toMatchObject({
      code: "invalid_state",
    });
    expect((await arena.repos.tournaments.getById(arena.tournament.id))!.status).toBe("registration_closed");
  });

  it("cannot start while registration is still open", async () => {
    await enrollSoloTeams(arena, 2);
    await expect(arena.services.tournaments.start(arena.organizer.id, arena.tournament.id)).rejects.toMatchObject({
      code: "invalid_state",
    });
  });

  it("assigns seeds, builds the bracket and exposes it as a DTO", async () => {
    const teams = await enrollSoloTeams(arena, 6);
    await arena.services.tournaments.closeRegistration(arena.organizer.id, arena.tournament.id);
    const started = await arena.services.tournaments.start(arena.organizer.id, arena.tournament.id);
    expect(started.status).toBe("in_progress");

    const entries = await arena.repos.tournamentTeams.getByTournament(arena.tournament.id);
    expect(entries.map((e) => e.seed)).toEqual([1, 2, 3, 4, 5, 6]);

    const bracket = await arena.services.tournaments.getBracket(arena.tournament.id);
    expect(bracket.rounds.map((r) => r.label)).toEqual(["Quarter-final", "Semi-final", "Final"]);
    expect(bracket.rounds.map((r) => r.matches.length)).toEqual([4, 2, 1]);
    const names = bracket.rounds[0].matches.flatMap((m) => [m.teamA?.name, m.teamB?.name]).filter(Boolean);
    expect(names.sort()).toEqual(teams.map((t) => t.name).sort());
  });

  it("keeps an organizer-chosen seed order", async () => {
    const teams = await enrollSoloTeams(arena, 4);
    const entries = await arena.repos.tournamentTeams.getByTournament(arena.tournament.id);
    await arena.repos.tournamentTeams.update({ ...entries[3], seed: 1 }); // last registrant becomes top seed
    await arena.services.tournaments.closeRegistration(arena.organizer.id, arena.tournament.id);
    await arena.services.tournaments.start(arena.organizer.id, arena.tournament.id);
    const round1 = (await arena.repos.matches.getByTournament(arena.tournament.id)).filter((m) => m.round === 1);
    expect(round1[0].teamAId).toBe(teams[3].id);
  });

  it("refuses to generate a bracket twice", async () => {
    await enrollSoloTeams(arena, 2);
    await arena.services.tournaments.closeRegistration(arena.organizer.id, arena.tournament.id);
    await arena.services.tournaments.start(arena.organizer.id, arena.tournament.id);
    await expect(
      arena.services.tournaments.start(arena.organizer.id, arena.tournament.id),
    ).rejects.toMatchObject({ code: "invalid_state" });
  });
});

describe("queries", () => {
  it("lists summaries sorted by start date, optionally filtered by status", async () => {
    await arena.services.tournaments.createTournament(arena.organizer.id, {
      ...input(arena.game.id),
      startDate: new Date(NOW.getTime() + DAY),
    });
    await enrollSoloTeams(arena, 2);
    const all = await arena.services.tournaments.list();
    expect(all).toHaveLength(2);
    expect(all[0].startDate.getTime()).toBeLessThanOrEqual(all[1].startDate.getTime());
    expect(all.find((t) => t.id === arena.tournament.id)).toMatchObject({
      approvedTeams: 2,
      gameName: arena.game.name,
      organizerGamerTag: arena.organizer.gamerTag,
    });
    expect(await arena.services.tournaments.list("draft")).toHaveLength(1);
    await expect(arena.services.tournaments.get(404)).rejects.toMatchObject({ code: "not_found" });
  });
});
