import type { Db } from "@/data/db";
import {
  AnnouncementRepository,
  GameRepository,
  MatchRepository,
  MatchResultRepository,
  SqliteUnitOfWork,
  TeamMemberRepository,
  TeamRepository,
  TournamentRepository,
  TournamentTeamRepository,
  UserRepository,
} from "./implementations";
import type { Repositories } from "./interfaces";

export type * from "./interfaces";
export { DrizzleRepository, EntityNotFoundError, type IRepository } from "./repository";

export function createRepositories(db: Db): Repositories {
  return {
    users: new UserRepository(db),
    games: new GameRepository(db),
    teams: new TeamRepository(db),
    teamMembers: new TeamMemberRepository(db),
    tournaments: new TournamentRepository(db),
    tournamentTeams: new TournamentTeamRepository(db),
    matches: new MatchRepository(db),
    matchResults: new MatchResultRepository(db),
    announcements: new AnnouncementRepository(db),
    unitOfWork: new SqliteUnitOfWork(db),
  };
}
