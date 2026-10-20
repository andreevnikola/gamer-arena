import { beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/business";
import { evaluateRegistration, type RegistrationContext } from "@/business/registration-service";
import { createFakeRepositories } from "../helpers/fakes";
import { DAY, NOW, enrollSoloTeams, makeArena, makeGame, makeTournament, makeUser, type Arena } from "../helpers/world";

const ctx = (overrides: Partial<RegistrationContext> = {}): RegistrationContext => ({
  actorId: 1,
  team: { id: 10, name: "T", captainId: 1, isSoloEntry: false, createdOn: NOW },
  members: [
    { id: 1, teamId: 10, userId: 1, invitationStatus: "accepted", joinedOn: NOW },
    { id: 2, teamId: 10, userId: 2, invitationStatus: "accepted", joinedOn: NOW },
  ],
  tournament: {
    id: 5,
    gameId: 1,
    organizerId: 9,
    title: "Cup",
    format: "single_elimination",
    maxParticipants: 4,
    prizePool: 0,
    startDate: new Date(NOW.getTime() + DAY),
    endDate: new Date(NOW.getTime() + 2 * DAY),
    status: "registration_open",
  },
  game: { id: 1, name: "Duo Game", genre: "x", teamSize: 2 },
  registrations: [],
  now: NOW,
  ...overrides,
});

describe("evaluateRegistration (pure access check)", () => {
  it("allows a complete team from its captain", () => {
    expect(evaluateRegistration(ctx())).toMatchObject({ allowed: true, code: "ok" });
  });

  it("only the captain may register", () => {
    expect(evaluateRegistration(ctx({ actorId: 2 })).code).toBe("not_captain");
  });

  it.each(["draft", "registration_closed", "in_progress", "completed", "cancelled"] as const)(
    "blocks when tournament is %s",
    (status) => {
      const base = ctx();
      expect(evaluateRegistration({ ...base, tournament: { ...base.tournament, status } }).code).toBe(
        "registration_closed",
      );
    },
  );

  it("blocks after the start date", () => {
    expect(evaluateRegistration(ctx({ now: new Date(NOW.getTime() + 3 * DAY) })).code).toBe("deadline_passed");
  });

  it("blocks duplicates, including previously rejected entries", () => {
    const entry = { id: 1, tournamentId: 5, teamId: 10, status: "rejected" as const, seed: null, registeredOn: NOW };
    expect(evaluateRegistration(ctx({ registrations: [entry] })).code).toBe("already_registered");
  });

  it("counts pending and approved entries toward capacity, not rejected ones", () => {
    const other = (id: number, status: "pending" | "approved" | "rejected") => ({
      id,
      tournamentId: 5,
      teamId: 100 + id,
      status,
      seed: null,
      registeredOn: NOW,
    });
    const full = [other(1, "pending"), other(2, "approved"), other(3, "approved"), other(4, "pending")];
    expect(evaluateRegistration(ctx({ registrations: full })).code).toBe("tournament_full");
    const withRejected = [other(1, "rejected"), other(2, "approved"), other(3, "approved"), other(4, "pending")];
    expect(evaluateRegistration(ctx({ registrations: withRejected })).allowed).toBe(true);
  });

  it("requires enough accepted members; pending and declined do not count", () => {
    const base = ctx();
    const members = [
      base.members[0],
      { ...base.members[1], invitationStatus: "pending" as const },
      { id: 3, teamId: 10, userId: 3, invitationStatus: "declined" as const, joinedOn: null },
    ];
    expect(evaluateRegistration({ ...base, members }).code).toBe("team_too_small");
  });

  it("allows substitutes beyond the team size", () => {
    const base = ctx();
    const members = [...base.members, { id: 3, teamId: 10, userId: 3, invitationStatus: "accepted" as const, joinedOn: NOW }];
    expect(evaluateRegistration({ ...base, members }).allowed).toBe(true);
  });

  it("solo entries are only valid for 1v1 games", () => {
    const base = ctx();
    expect(evaluateRegistration({ ...base, team: { ...base.team, isSoloEntry: true } }).code).toBe("solo_not_allowed");
  });
});

describe("RegistrationService", () => {
  let arena: Arena;
  beforeEach(async () => {
    arena = await makeArena(createFakeRepositories(), 2);
  });

  it("registers a solo player as pending and organizer approves", async () => {
    const player = await makeUser(arena.repos);
    const team = await arena.services.teams.getOrCreateSoloTeam(player.id);
    const entry = await arena.services.registrations.register(player.id, team.id, arena.tournament.id);
    expect(entry.status).toBe("pending");
    const approved = await arena.services.registrations.approve(arena.organizer.id, entry.id);
    expect(approved.status).toBe("approved");
  });

  it("throws typed errors for each failure class", async () => {
    const player = await makeUser(arena.repos);
    const team = await arena.services.teams.getOrCreateSoloTeam(player.id);
    const stranger = await makeUser(arena.repos);

    await expect(arena.services.registrations.register(stranger.id, team.id, arena.tournament.id)).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(arena.services.registrations.register(player.id, 999, arena.tournament.id)).rejects.toMatchObject({
      code: "not_found",
    });
    await arena.services.registrations.register(player.id, team.id, arena.tournament.id);
    await expect(arena.services.registrations.register(player.id, team.id, arena.tournament.id)).rejects.toMatchObject({
      code: "conflict",
    });
  });

  it("stops registrations once the tournament is full", async () => {
    await enrollSoloTeams(arena, 2);
    const late = await makeUser(arena.repos);
    const team = await arena.services.teams.getOrCreateSoloTeam(late.id);
    const eligibility = await arena.services.registrations.canTeamRegister(late.id, team.id, arena.tournament.id);
    expect(eligibility).toMatchObject({ allowed: false, code: "tournament_full" });
  });

  it("only the tournament's organizer (or an admin) can decide", async () => {
    const player = await makeUser(arena.repos);
    const team = await arena.services.teams.getOrCreateSoloTeam(player.id);
    const entry = await arena.services.registrations.register(player.id, team.id, arena.tournament.id);

    const otherOrganizer = await makeUser(arena.repos, "organizer");
    await expect(arena.services.registrations.approve(otherOrganizer.id, entry.id)).rejects.toBeInstanceOf(DomainError);
    await expect(arena.services.registrations.approve(player.id, entry.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(arena.services.registrations.reject(arena.admin.id, entry.id)).resolves.toMatchObject({
      status: "rejected",
    });
  });

  it("approving beyond capacity is refused", async () => {
    await enrollSoloTeams(arena, 2);
    const extra = await makeUser(arena.repos);
    const team = await arena.services.teams.getOrCreateSoloTeam(extra.id);
    // Bypass the eligibility gate to prove the approval guard on its own.
    const entry = await arena.repos.tournamentTeams.add({
      tournamentId: arena.tournament.id,
      teamId: team.id,
      status: "pending",
    });
    await expect(arena.services.registrations.approve(arena.organizer.id, entry.id)).rejects.toMatchObject({
      code: "conflict",
    });
  });

  it("decisions are locked once the tournament is running", async () => {
    const [team] = await enrollSoloTeams(arena, 1);
    const entry = (await arena.repos.tournamentTeams.getByTournamentAndTeam(arena.tournament.id, team.id))!;
    await arena.repos.tournaments.update({ ...arena.tournament, status: "in_progress" });
    await expect(arena.services.registrations.reject(arena.organizer.id, entry.id)).rejects.toMatchObject({
      code: "invalid_state",
    });
  });

  it("team of 3 needs 3 accepted players for a 3v3 game", async () => {
    const game = await makeGame(arena.repos, 3);
    const tournament = await makeTournament(arena.repos, arena.organizer, game);
    const [captain, p2, p3] = [await makeUser(arena.repos), await makeUser(arena.repos), await makeUser(arena.repos)];
    const team = await arena.services.teams.createTeam(captain.id, "Triple Threat");
    await arena.services.teams.invite(captain.id, team.id, p2.id);
    await arena.services.teams.invite(captain.id, team.id, p3.id);
    await arena.services.teams.respondToInvitation(p2.id, team.id, true);

    expect((await arena.services.registrations.canTeamRegister(captain.id, team.id, tournament.id)).code).toBe(
      "team_too_small",
    );
    await arena.services.teams.respondToInvitation(p3.id, team.id, true);
    expect((await arena.services.registrations.canTeamRegister(captain.id, team.id, tournament.id)).allowed).toBe(true);
  });
});
