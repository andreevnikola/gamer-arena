import type { Game, Team, TeamMember, Tournament, TournamentTeam } from "@/data/types";
import type { Repositories } from "@/repositories";
import type { Eligibility } from "./dto";
import { DomainError, type Clock } from "./errors";

export interface RegistrationContext {
  actorId: number;
  team: Team;
  members: TeamMember[];
  tournament: Tournament;
  game: Game;
  /** Existing TournamentTeam rows for this tournament (any status). */
  registrations: TournamentTeam[];
  now: Date;
}

const deny = (code: Eligibility["code"], reason: string): Eligibility => ({ allowed: false, code, reason });

/**
 * Pure access check - the GamerArena counterpart of "CanUserAccessWorkout":
 * may this actor enter this team into this tournament right now?
 */
export function evaluateRegistration(ctx: RegistrationContext): Eligibility {
  const { actorId, team, members, tournament, game, registrations, now } = ctx;

  if (team.captainId !== actorId) return deny("not_captain", "Only the team captain can register the team.");
  if (tournament.status !== "registration_open") {
    return deny("registration_closed", "Registration is not open for this tournament.");
  }
  if (now > tournament.startDate) return deny("deadline_passed", "The tournament has already started.");
  if (registrations.some((r) => r.teamId === team.id)) {
    return deny("already_registered", "This team is already registered.");
  }
  const active = registrations.filter((r) => r.status !== "rejected").length;
  if (active >= tournament.maxParticipants) return deny("tournament_full", "The tournament is full.");
  if (team.isSoloEntry && game.teamSize !== 1) {
    return deny("solo_not_allowed", `${game.name} requires teams of ${game.teamSize}.`);
  }
  const accepted = members.filter((m) => m.invitationStatus === "accepted").length;
  if (accepted < game.teamSize) {
    return deny("team_too_small", `${game.name} needs ${game.teamSize} accepted players; the team has ${accepted}.`);
  }
  return { allowed: true, code: "ok", reason: "Team can register." };
}

export class RegistrationService {
  constructor(
    private readonly repos: Repositories,
    private readonly now: Clock,
  ) {}

  async canTeamRegister(actorId: number, teamId: number, tournamentId: number): Promise<Eligibility> {
    const [team, tournament] = await Promise.all([
      this.repos.teams.getById(teamId),
      this.repos.tournaments.getById(tournamentId),
    ]);
    if (!team) return deny("team_not_found", "Team not found.");
    if (!tournament) return deny("tournament_not_found", "Tournament not found.");
    const game = (await this.repos.games.getById(tournament.gameId))!;
    const [members, registrations] = await Promise.all([
      this.repos.teamMembers.getByTeam(teamId),
      this.repos.tournamentTeams.getByTournament(tournamentId),
    ]);
    return evaluateRegistration({ actorId, team, members, tournament, game, registrations, now: this.now() });
  }

  async register(actorId: number, teamId: number, tournamentId: number): Promise<TournamentTeam> {
    const eligibility = await this.canTeamRegister(actorId, teamId, tournamentId);
    if (!eligibility.allowed) {
      const code =
        eligibility.code === "not_captain"
          ? "forbidden"
          : eligibility.code.endsWith("not_found")
            ? "not_found"
            : "conflict";
      throw new DomainError(code, eligibility.reason);
    }
    return this.repos.tournamentTeams.add({ tournamentId, teamId, status: "pending", registeredOn: this.now() });
  }

  async approve(actorId: number, tournamentTeamId: number): Promise<TournamentTeam> {
    const { entry, tournament } = await this.loadForDecision(actorId, tournamentTeamId);
    if (entry.status === "approved") return entry;
    const approved = (await this.repos.tournamentTeams.getByTournament(tournament.id)).filter(
      (r) => r.status === "approved",
    ).length;
    if (approved >= tournament.maxParticipants) throw new DomainError("conflict", "The tournament is full.");
    return this.repos.tournamentTeams.update({ ...entry, status: "approved" });
  }

  async reject(actorId: number, tournamentTeamId: number): Promise<TournamentTeam> {
    const { entry } = await this.loadForDecision(actorId, tournamentTeamId);
    return this.repos.tournamentTeams.update({ ...entry, status: "rejected" });
  }

  private async loadForDecision(actorId: number, tournamentTeamId: number) {
    const entry = await this.repos.tournamentTeams.getById(tournamentTeamId);
    if (!entry) throw new DomainError("not_found", `Registration ${tournamentTeamId} not found.`);
    const tournament = (await this.repos.tournaments.getById(entry.tournamentId))!;
    const actor = await this.repos.users.getById(actorId);
    const mayDecide = actor?.role === "admin" || (actor?.role === "organizer" && tournament.organizerId === actorId);
    if (!mayDecide) throw new DomainError("forbidden", "Only the tournament organizer can decide registrations.");
    if (tournament.status !== "registration_open" && tournament.status !== "registration_closed") {
      throw new DomainError("invalid_state", "Registrations can no longer be changed.");
    }
    return { entry, tournament };
  }
}
