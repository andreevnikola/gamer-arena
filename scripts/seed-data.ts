import { createServices } from "@/business";
import type { Repositories } from "@/repositories";

export const SEED_PASSWORD = "Password1";

const DAY = 24 * 60 * 60 * 1000;

const PLAYERS = [
  "NovaStrike",
  "PixelWitch",
  "ByteBard",
  "RogueEcho",
  "QuantumFox",
  "IronLynx",
  "SilentVolt",
  "ZenithRay",
] as const;

/**
 * Fills an empty database with demo data through the business layer, so
 * every seeded row obeys the same rules as real data. Returns false when
 * data already exists (idempotent).
 */
export async function seedDatabase(repos: Repositories, now: Date = new Date()): Promise<boolean> {
  if ((await repos.users.getAll()).length > 0) return false;

  // Registrations happen "ten days ago" so they precede tournament start dates.
  const past = new Date(now.getTime() - 10 * DAY);
  const services = createServices(repos, () => past);

  const admin = await services.users.register({
    userName: "admin",
    email: "admin@gamerarena.local",
    password: SEED_PASSWORD,
    gamerTag: "ArenaAdmin",
  });
  await repos.users.update({ ...admin, role: "admin" });

  const organizer = await services.users.register({
    userName: "organizer",
    email: "organizer@gamerarena.local",
    password: SEED_PASSWORD,
    gamerTag: "ArenaHost",
  });
  await repos.users.update({ ...organizer, role: "organizer" });

  const players = [];
  for (const tag of PLAYERS) {
    players.push(
      await services.users.register({
        userName: tag.toLowerCase(),
        email: `${tag.toLowerCase()}@gamerarena.local`,
        password: SEED_PASSWORD,
        gamerTag: tag,
      }),
    );
  }

  const sf6 = await services.games.createGame(admin.id, { name: "Street Fighter 6", genre: "Fighting", teamSize: 1 });
  const rocketLeague = await services.games.createGame(admin.id, { name: "Rocket League", genre: "Sports", teamSize: 3 });

  // In-progress 1v1 tournament: 8 solo entries, first round partly played.
  const showdown = await services.tournaments.createTournament(organizer.id, {
    gameId: sf6.id,
    title: "Spring Showdown",
    maxParticipants: 8,
    prizePool: 500,
    startDate: new Date(now.getTime() - 2 * DAY),
    endDate: new Date(now.getTime() + 5 * DAY),
  });
  await services.tournaments.openRegistration(organizer.id, showdown.id);
  const soloTeams = [];
  for (const player of players) {
    const team = await services.teams.getOrCreateSoloTeam(player.id);
    const entry = await services.registrations.register(player.id, team.id, showdown.id);
    await services.registrations.approve(organizer.id, entry.id);
    soloTeams.push(team);
  }
  await services.tournaments.closeRegistration(organizer.id, showdown.id);
  await services.tournaments.start(organizer.id, showdown.id);

  const bracket = await services.tournaments.getBracket(showdown.id);
  const firstRound = bracket.rounds[0].matches;
  const playedScores: Array<[number, number]> = [
    [2, 0],
    [1, 2],
    [2, 1],
  ];
  const reportingServices = createServices(repos, () => new Date(now.getTime() - DAY));
  for (const [index, [a, b]] of playedScores.entries()) {
    const match = firstRound[index];
    for (const team of [match.teamA!, match.teamB!]) {
      await reportingServices.matches.reportResult({
        matchId: match.id,
        reportedByTeamId: team.id,
        scoreA: a,
        scoreB: b,
      });
    }
  }
  // Fourth match: only one side has reported so far.
  const waiting = firstRound[3];
  await reportingServices.matches.reportResult({
    matchId: waiting.id,
    reportedByTeamId: waiting.teamA!.id,
    scoreA: 2,
    scoreB: 0,
  });

  // Open 3v3 tournament with one approved team and one waiting for approval.
  const cup = await services.tournaments.createTournament(organizer.id, {
    gameId: rocketLeague.id,
    title: "Rocket Cup",
    maxParticipants: 16,
    prizePool: 1200,
    startDate: new Date(now.getTime() + 14 * DAY),
    endDate: new Date(now.getTime() + 15 * DAY),
  });
  await services.tournaments.openRegistration(organizer.id, cup.id);
  const squads = [
    { name: "Turbo Trio", members: players.slice(0, 3) },
    { name: "Boost Brigade", members: players.slice(3, 6) },
  ];
  for (const [index, squad] of squads.entries()) {
    const [captain, ...rest] = squad.members;
    const team = await services.teams.createTeam(captain.id, squad.name);
    for (const member of rest) {
      await services.teams.invite(captain.id, team.id, member.id);
      await services.teams.respondToInvitation(member.id, team.id, true);
    }
    const entry = await services.registrations.register(captain.id, team.id, cup.id);
    if (index === 0) await services.registrations.approve(organizer.id, entry.id);
  }

  // Draft tournament.
  await services.tournaments.createTournament(organizer.id, {
    gameId: sf6.id,
    title: "Winter Invitational",
    maxParticipants: 32,
    prizePool: 2500,
    startDate: new Date(now.getTime() + 60 * DAY),
    endDate: new Date(now.getTime() + 62 * DAY),
  });

  return true;
}
