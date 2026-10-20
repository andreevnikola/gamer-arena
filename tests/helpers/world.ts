import { createServices, type Services } from "@/business";
import type { Repositories } from "@/repositories";
import type { Game, Team, Tournament, User, UserRole } from "@/data/types";

export const NOW = new Date("2026-06-01T12:00:00Z");
export const DAY = 24 * 60 * 60 * 1000;

let counter = 0;

/** Inserts a user straight through the repository (skips password hashing for speed). */
export async function makeUser(repos: Repositories, role: UserRole = "player", tag?: string): Promise<User> {
  const n = ++counter;
  return repos.users.add({
    userName: `user_${n}`,
    email: `user${n}@test.dev`,
    passwordHash: "x",
    gamerTag: tag ?? `Gamer_${n}`,
    role,
    registeredOn: NOW,
  });
}

export const makeGame = (repos: Repositories, teamSize = 1): Promise<Game> =>
  repos.games.add({ name: `Game ${++counter}`, genre: "Test", teamSize });

export function makeTournament(
  repos: Repositories,
  organizer: User,
  game: Game,
  overrides: Partial<Tournament> = {},
): Promise<Tournament> {
  return repos.tournaments.add({
    gameId: game.id,
    organizerId: organizer.id,
    title: "Test Cup",
    maxParticipants: 8,
    prizePool: 100,
    startDate: new Date(NOW.getTime() + 7 * DAY),
    endDate: new Date(NOW.getTime() + 8 * DAY),
    status: "registration_open",
    ...overrides,
  });
}

export interface Arena {
  repos: Repositories;
  services: Services;
  organizer: User;
  admin: User;
  game: Game;
  tournament: Tournament;
}

/** Organizer + admin + a 1v1 game + an open-registration tournament. */
export async function makeArena(repos: Repositories, maxParticipants = 8): Promise<Arena> {
  const services = createServices(repos, () => NOW);
  const organizer = await makeUser(repos, "organizer");
  const admin = await makeUser(repos, "admin");
  const game = await makeGame(repos, 1);
  const tournament = await makeTournament(repos, organizer, game, { maxParticipants });
  return { repos, services, organizer, admin, game, tournament };
}

/** Registers and approves `count` solo entrants. Returns their teams in registration order. */
export async function enrollSoloTeams(arena: Arena, count: number): Promise<Team[]> {
  const teams: Team[] = [];
  for (let i = 0; i < count; i++) {
    const player = await makeUser(arena.repos);
    const team = await arena.services.teams.getOrCreateSoloTeam(player.id);
    const entry = await arena.services.registrations.register(player.id, team.id, arena.tournament.id);
    await arena.services.registrations.approve(arena.organizer.id, entry.id);
    teams.push(team);
  }
  return teams;
}
