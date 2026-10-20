import type { Tournament, TournamentStatus } from "@/data/types";
import type { Repositories } from "@/repositories";
import { roundLabel } from "./bracket";
import type { BracketDto, BracketMatchDto, TeamRefDto, TournamentSummaryDto } from "./dto";
import type { BracketService } from "./bracket-service";
import { DomainError, type Clock } from "./errors";
import { validateTournamentInput } from "./validation";

export interface CreateTournamentInput {
  gameId: number;
  title: string;
  maxParticipants: number;
  prizePool: number;
  startDate: Date;
  endDate: Date;
}

/** Allowed lifecycle moves. `start` additionally generates the bracket. */
const TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  draft: ["registration_open", "cancelled"],
  registration_open: ["registration_closed", "cancelled"],
  registration_closed: ["registration_open", "in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const canTransition = (from: TournamentStatus, to: TournamentStatus): boolean =>
  TRANSITIONS[from].includes(to);

export class TournamentService {
  constructor(
    private readonly repos: Repositories,
    private readonly brackets: BracketService,
    private readonly now: Clock,
  ) {}

  async createTournament(actorId: number, input: CreateTournamentInput): Promise<Tournament> {
    const actor = await this.repos.users.getById(actorId);
    if (!actor || (actor.role !== "organizer" && actor.role !== "admin")) {
      throw new DomainError("forbidden", "Only organizers can create tournaments.");
    }
    const validation = validateTournamentInput(input);
    if (!validation.valid) throw new DomainError("validation", "Tournament data is invalid.", validation.errors);
    if (!(await this.repos.games.getById(input.gameId))) {
      throw new DomainError("not_found", `Game ${input.gameId} not found.`);
    }
    return this.repos.tournaments.add({
      gameId: input.gameId,
      organizerId: actorId,
      title: input.title.trim(),
      format: "single_elimination",
      maxParticipants: input.maxParticipants,
      prizePool: input.prizePool,
      startDate: input.startDate,
      endDate: input.endDate,
      status: "draft",
    });
  }

  openRegistration(actorId: number, tournamentId: number) {
    return this.transition(actorId, tournamentId, "registration_open");
  }

  closeRegistration(actorId: number, tournamentId: number) {
    return this.transition(actorId, tournamentId, "registration_closed");
  }

  cancel(actorId: number, tournamentId: number) {
    return this.transition(actorId, tournamentId, "cancelled");
  }

  /** Generates the bracket and moves the tournament to in_progress, atomically. */
  async start(actorId: number, tournamentId: number): Promise<Tournament> {
    const tournament = await this.requireManaged(actorId, tournamentId);
    this.assertTransition(tournament, "in_progress");
    return this.repos.unitOfWork.run(async () => {
      await this.brackets.generateForTournament(tournamentId);
      return this.repos.tournaments.update({ ...tournament, status: "in_progress" });
    });
  }

  async list(status?: TournamentStatus): Promise<TournamentSummaryDto[]> {
    const all = status ? await this.repos.tournaments.getByStatus(status) : await this.repos.tournaments.getAll();
    const summaries = await Promise.all(all.map((t) => this.toSummary(t)));
    return summaries.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }

  async get(tournamentId: number): Promise<TournamentSummaryDto> {
    const tournament = await this.repos.tournaments.getById(tournamentId);
    if (!tournament) throw new DomainError("not_found", `Tournament ${tournamentId} not found.`);
    return this.toSummary(tournament);
  }

  async getBracket(tournamentId: number): Promise<BracketDto> {
    const matches = await this.repos.matches.getByTournament(tournamentId);
    const teamIds = [...new Set(matches.flatMap((m) => [m.teamAId, m.teamBId]).filter((id): id is number => id !== null))];
    const teams = new Map<number, TeamRefDto>();
    for (const id of teamIds) {
      const team = await this.repos.teams.getById(id);
      if (team) teams.set(id, { id: team.id, name: team.name });
    }

    const totalRounds = matches.reduce((max, m) => Math.max(max, m.round), 0);
    const rounds = new Map<number, BracketMatchDto[]>();
    for (const match of matches) {
      const confirmed = (await this.repos.matchResults.getByMatch(match.id)).find((r) => r.isConfirmed);
      const dto: BracketMatchDto = {
        id: match.id,
        round: match.round,
        position: match.bracketPosition,
        status: match.status,
        teamA: match.teamAId === null ? null : (teams.get(match.teamAId) ?? null),
        teamB: match.teamBId === null ? null : (teams.get(match.teamBId) ?? null),
        scoreA: confirmed?.scoreA ?? null,
        scoreB: confirmed?.scoreB ?? null,
        winnerTeamId: match.winnerTeamId,
      };
      rounds.set(match.round, [...(rounds.get(match.round) ?? []), dto]);
    }
    return {
      tournamentId,
      rounds: [...rounds.entries()]
        .sort(([a], [b]) => a - b)
        .map(([round, list]) => ({ round, label: roundLabel(round, totalRounds), matches: list })),
    };
  }

  private async transition(actorId: number, tournamentId: number, to: TournamentStatus): Promise<Tournament> {
    const tournament = await this.requireManaged(actorId, tournamentId);
    this.assertTransition(tournament, to);
    return this.repos.tournaments.update({ ...tournament, status: to });
  }

  private assertTransition(tournament: Tournament, to: TournamentStatus): void {
    if (!canTransition(tournament.status, to)) {
      throw new DomainError("invalid_state", `Cannot move a ${tournament.status} tournament to ${to}.`);
    }
  }

  private async requireManaged(actorId: number, tournamentId: number): Promise<Tournament> {
    const tournament = await this.repos.tournaments.getById(tournamentId);
    if (!tournament) throw new DomainError("not_found", `Tournament ${tournamentId} not found.`);
    const actor = await this.repos.users.getById(actorId);
    const allowed = actor?.role === "admin" || (actor?.role === "organizer" && tournament.organizerId === actorId);
    if (!allowed) throw new DomainError("forbidden", "Only the tournament organizer can do this.");
    return tournament;
  }

  private async toSummary(t: Tournament): Promise<TournamentSummaryDto> {
    const [game, organizer, entries] = await Promise.all([
      this.repos.games.getById(t.gameId),
      this.repos.users.getById(t.organizerId),
      this.repos.tournamentTeams.getByTournament(t.id),
    ]);
    return {
      id: t.id,
      title: t.title,
      gameName: game?.name ?? "Unknown game",
      teamSize: game?.teamSize ?? 1,
      organizerGamerTag: organizer?.gamerTag ?? "unknown",
      status: t.status,
      maxParticipants: t.maxParticipants,
      approvedTeams: entries.filter((e) => e.status === "approved").length,
      prizePool: t.prizePool,
      startDate: t.startDate,
      endDate: t.endDate,
    };
  }
}
