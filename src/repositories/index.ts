import type { Db } from "@/data/db";
import {
  AnnouncementRepository,
  GameRepository,
  MatchRepository,
  MatchResultRepository,
  PostgresUnitOfWork,
  TeamMemberRepository,
  TeamRepository,
  TournamentRepository,
  TournamentTeamRepository,
  UserRepository,
} from "./implementations";
import type { Repositories } from "./interfaces";
import { DbContext } from "./repository";

export type * from "./interfaces";
export { DbContext, DrizzleRepository, EntityNotFoundError, type IRepository } from "./repository";

export function createRepositories(db: Db): Repositories {
  const context = new DbContext(db);
  return {
    users: new UserRepository(context),
    games: new GameRepository(context),
    teams: new TeamRepository(context),
    teamMembers: new TeamMemberRepository(context),
    tournaments: new TournamentRepository(context),
    tournamentTeams: new TournamentTeamRepository(context),
    matches: new MatchRepository(context),
    matchResults: new MatchResultRepository(context),
    announcements: new AnnouncementRepository(context),
    unitOfWork: new PostgresUnitOfWork(context),
  };
}
