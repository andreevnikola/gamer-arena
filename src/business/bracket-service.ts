import type { Match } from "@/data/types";
import type { Repositories } from "@/repositories";
import { generateBracket } from "./bracket";
import { DomainError } from "./errors";

export class BracketService {
  constructor(private readonly repos: Repositories) {}

  /**
   * Seeds the approved teams (existing seed first, then registration order)
   * and persists the whole bracket atomically. Rounds are inserted from the
   * final backwards so every match already knows its nextMatchId.
   */
  async generateForTournament(tournamentId: number): Promise<Match[]> {
    const tournament = await this.repos.tournaments.getById(tournamentId);
    if (!tournament) throw new DomainError("not_found", `Tournament ${tournamentId} not found.`);
    if ((await this.repos.matches.getByTournament(tournamentId)).length > 0) {
      throw new DomainError("conflict", "A bracket has already been generated.");
    }

    const approved = (await this.repos.tournamentTeams.getByTournament(tournamentId))
      .filter((entry) => entry.status === "approved")
      .sort((a, b) => (a.seed ?? Infinity) - (b.seed ?? Infinity) || a.id - b.id);
    if (approved.length < 2) {
      throw new DomainError("invalid_state", "At least 2 approved teams are required to start.");
    }
    if (approved.length > tournament.maxParticipants) {
      throw new DomainError("invalid_state", "More approved teams than the tournament allows.");
    }

    const plan = generateBracket(approved.map((entry) => entry.teamId));
    const rounds = Math.max(...plan.map((m) => m.round));

    return this.repos.unitOfWork.run(async () => {
      for (const [index, entry] of approved.entries()) {
        await this.repos.tournamentTeams.update({ ...entry, seed: index + 1 });
      }
      const ids = new Map<string, number>();
      const created: Match[] = [];
      for (let round = rounds; round >= 1; round--) {
        for (const planned of plan.filter((m) => m.round === round)) {
          const nextId = planned.next ? ids.get(`${planned.next.round}:${planned.next.position}`)! : null;
          const match = await this.repos.matches.add({
            tournamentId,
            teamAId: planned.teamAId,
            teamBId: planned.teamBId,
            winnerTeamId: planned.winnerTeamId,
            nextMatchId: nextId,
            nextSlot: planned.next?.slot ?? null,
            round: planned.round,
            bracketPosition: planned.position,
            status: planned.status,
          });
          ids.set(`${round}:${planned.position}`, match.id);
          created.push(match);
        }
      }
      return created.sort((a, b) => a.round - b.round || a.bracketPosition - b.bracketPosition);
    });
  }
}
