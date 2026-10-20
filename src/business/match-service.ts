import type { Match, MatchResult } from "@/data/types";
import type { Repositories } from "@/repositories";
import { DomainError, type Clock } from "./errors";
import { validateProofUrl, validateScores } from "./validation";

export interface ReportResultInput {
  matchId: number;
  reportedByTeamId: number;
  /** Always the score of slot A and slot B of the match, whoever reports. */
  scoreA: number;
  scoreB: number;
  proofUrl?: string;
}

export class MatchService {
  constructor(
    private readonly repos: Repositories,
    private readonly now: Clock,
  ) {}

  /**
   * Each side reports once (re-reporting replaces its own report).
   * Identical reports confirm the result; different ones mark the match disputed.
   */
  async reportResult(input: ReportResultInput): Promise<Match> {
    const { matchId, reportedByTeamId, scoreA, scoreB, proofUrl } = input;
    this.assertValidScore(scoreA, scoreB);
    if (proofUrl !== undefined && !validateProofUrl(proofUrl)) {
      throw new DomainError("validation", "Proof must be a valid http(s) URL.", { proofUrl: "Invalid URL." });
    }

    const match = await this.requireOpenMatch(matchId);
    if (reportedByTeamId !== match.teamAId && reportedByTeamId !== match.teamBId) {
      throw new DomainError("forbidden", "Only teams in this match can report its result.");
    }

    return this.repos.unitOfWork.run(async () => {
      const results = await this.repos.matchResults.getByMatch(matchId);
      const own = results.find((r) => r.reportedByTeamId === reportedByTeamId);
      const saved = own
        ? await this.repos.matchResults.update({
            ...own,
            scoreA,
            scoreB,
            proofUrl: proofUrl ?? own.proofUrl,
            isConfirmed: false,
            submittedOn: this.now(),
          })
        : await this.repos.matchResults.add({
            matchId,
            reportedByTeamId,
            scoreA,
            scoreB,
            proofUrl: proofUrl ?? null,
            isConfirmed: false,
            submittedOn: this.now(),
          });

      const other = results.find((r) => r.reportedByTeamId !== reportedByTeamId);
      if (!other) return match;

      if (other.scoreA === saved.scoreA && other.scoreB === saved.scoreB) {
        await this.repos.matchResults.update({ ...other, isConfirmed: true });
        await this.repos.matchResults.update({ ...saved, isConfirmed: true });
        return this.finalize(match, saved.scoreA, saved.scoreB);
      }
      return this.repos.matches.update({ ...match, status: "disputed" });
    });
  }

  /** Organizer/admin sets the final score of a disputed match. */
  async resolveDispute(actorId: number, matchId: number, scoreA: number, scoreB: number): Promise<Match> {
    this.assertValidScore(scoreA, scoreB);
    const match = await this.repos.matches.getById(matchId);
    if (!match) throw new DomainError("not_found", `Match ${matchId} not found.`);
    if (match.status !== "disputed") throw new DomainError("invalid_state", "Only disputed matches can be resolved.");

    const tournament = (await this.repos.tournaments.getById(match.tournamentId))!;
    const actor = await this.repos.users.getById(actorId);
    const allowed = actor?.role === "admin" || (actor?.role === "organizer" && tournament.organizerId === actorId);
    if (!allowed) throw new DomainError("forbidden", "Only the tournament organizer can resolve disputes.");

    return this.repos.unitOfWork.run(async () => {
      const results = await this.repos.matchResults.getByMatch(matchId);
      for (const result of results) {
        await this.repos.matchResults.update({
          ...result,
          isConfirmed: result.scoreA === scoreA && result.scoreB === scoreB,
        });
      }
      return this.finalize(match, scoreA, scoreB);
    });
  }

  async getResults(matchId: number): Promise<MatchResult[]> {
    return this.repos.matchResults.getByMatch(matchId);
  }

  private assertValidScore(scoreA: number, scoreB: number): void {
    const validation = validateScores(scoreA, scoreB);
    if (!validation.valid) throw new DomainError("validation", "Scores are invalid.", validation.errors);
    if (scoreA === scoreB) {
      throw new DomainError("validation", "Elimination matches cannot end in a tie.", {
        scoreA: "A winner is required.",
        scoreB: "A winner is required.",
      });
    }
  }

  private async requireOpenMatch(matchId: number): Promise<Match> {
    const match = await this.repos.matches.getById(matchId);
    if (!match) throw new DomainError("not_found", `Match ${matchId} not found.`);
    if (match.status === "completed") throw new DomainError("invalid_state", "This match is already completed.");
    if (match.status === "pending" || match.teamAId === null || match.teamBId === null) {
      throw new DomainError("invalid_state", "This match is still waiting for its opponents.");
    }
    const tournament = (await this.repos.tournaments.getById(match.tournamentId))!;
    if (tournament.status !== "in_progress") {
      throw new DomainError("invalid_state", "The tournament is not in progress.");
    }
    return match;
  }

  /** Records the winner, fills the next match slot, and completes the tournament after the final. */
  private async finalize(match: Match, scoreA: number, scoreB: number): Promise<Match> {
    const winnerTeamId = scoreA > scoreB ? match.teamAId! : match.teamBId!;
    const completed = await this.repos.matches.update({ ...match, winnerTeamId, status: "completed" });

    if (completed.nextMatchId === null) {
      const tournament = (await this.repos.tournaments.getById(completed.tournamentId))!;
      await this.repos.tournaments.update({ ...tournament, status: "completed" });
      return completed;
    }

    const next = (await this.repos.matches.getById(completed.nextMatchId))!;
    const filled = completed.nextSlot === "A" ? { ...next, teamAId: winnerTeamId } : { ...next, teamBId: winnerTeamId };
    await this.repos.matches.update({
      ...filled,
      status: filled.teamAId !== null && filled.teamBId !== null ? "ready" : "pending",
    });
    return completed;
  }
}
