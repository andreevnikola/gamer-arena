import type { MatchStatus, TournamentStatus } from "@/data/types";

export interface TeamRefDto {
  id: number;
  name: string;
}

export interface BracketMatchDto {
  id: number;
  round: number;
  position: number;
  status: MatchStatus;
  teamA: TeamRefDto | null;
  teamB: TeamRefDto | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerTeamId: number | null;
}

export interface BracketRoundDto {
  round: number;
  label: string;
  matches: BracketMatchDto[];
}

export interface BracketDto {
  tournamentId: number;
  rounds: BracketRoundDto[];
}

export interface TournamentSummaryDto {
  id: number;
  title: string;
  gameName: string;
  teamSize: number;
  organizerGamerTag: string;
  status: TournamentStatus;
  maxParticipants: number;
  approvedTeams: number;
  prizePool: number;
  startDate: Date;
  endDate: Date;
}

export interface Eligibility {
  allowed: boolean;
  code:
    | "ok"
    | "tournament_not_found"
    | "team_not_found"
    | "not_captain"
    | "registration_closed"
    | "deadline_passed"
    | "already_registered"
    | "tournament_full"
    | "team_too_small"
    | "solo_not_allowed";
  reason: string;
}
