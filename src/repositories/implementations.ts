import { and, asc, eq } from "drizzle-orm";
import {
  announcements,
  games,
  matchResults,
  matches,
  teamMembers,
  teams,
  tournamentTeams,
  tournaments,
  users,
} from "@/data/schema";
import type {
  IAnnouncementRepository,
  IGameRepository,
  IMatchRepository,
  IMatchResultRepository,
  ITeamMemberRepository,
  ITeamRepository,
  ITournamentRepository,
  ITournamentTeamRepository,
  IUnitOfWork,
  IUserRepository,
} from "./interfaces";
import { DbContext, DrizzleRepository, first } from "./repository";

export class UserRepository extends DrizzleRepository<typeof users> implements IUserRepository {
  constructor(context: DbContext) {
    super(context, users, "User");
  }
  async getByEmail(email: string) {
    return first(await this.db.select().from(users).where(eq(users.email, email.toLowerCase())));
  }
  async getByUserName(userName: string) {
    return first(await this.db.select().from(users).where(eq(users.userName, userName)));
  }
  async getByGamerTag(gamerTag: string) {
    return first(await this.db.select().from(users).where(eq(users.gamerTag, gamerTag)));
  }
}

export class GameRepository extends DrizzleRepository<typeof games> implements IGameRepository {
  constructor(context: DbContext) {
    super(context, games, "Game");
  }
}

export class TeamRepository extends DrizzleRepository<typeof teams> implements ITeamRepository {
  constructor(context: DbContext) {
    super(context, teams, "Team");
  }
  async getByCaptain(captainId: number) {
    return this.db.select().from(teams).where(eq(teams.captainId, captainId)).orderBy(asc(teams.id));
  }
  async getByName(name: string) {
    return first(await this.db.select().from(teams).where(eq(teams.name, name)));
  }
}

export class TeamMemberRepository
  extends DrizzleRepository<typeof teamMembers>
  implements ITeamMemberRepository
{
  constructor(context: DbContext) {
    super(context, teamMembers, "TeamMember");
  }
  async getByTeam(teamId: number) {
    return this.db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId)).orderBy(asc(teamMembers.id));
  }
  async getByUser(userId: number) {
    return this.db.select().from(teamMembers).where(eq(teamMembers.userId, userId)).orderBy(asc(teamMembers.id));
  }
  async getByTeamAndUser(teamId: number, userId: number) {
    return first(
      await this.db
        .select()
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId))),
    );
  }
}

export class TournamentRepository
  extends DrizzleRepository<typeof tournaments>
  implements ITournamentRepository
{
  constructor(context: DbContext) {
    super(context, tournaments, "Tournament");
  }
  async getByOrganizer(organizerId: number) {
    return this.db
      .select()
      .from(tournaments)
      .where(eq(tournaments.organizerId, organizerId))
      .orderBy(asc(tournaments.id));
  }
  async getByStatus(status: (typeof tournaments.$inferSelect)["status"]) {
    return this.db.select().from(tournaments).where(eq(tournaments.status, status)).orderBy(asc(tournaments.id));
  }
}

export class TournamentTeamRepository
  extends DrizzleRepository<typeof tournamentTeams>
  implements ITournamentTeamRepository
{
  constructor(context: DbContext) {
    super(context, tournamentTeams, "TournamentTeam");
  }
  async getByTournament(tournamentId: number) {
    return this.db
      .select()
      .from(tournamentTeams)
      .where(eq(tournamentTeams.tournamentId, tournamentId))
      .orderBy(asc(tournamentTeams.id));
  }
  async getByTournamentAndTeam(tournamentId: number, teamId: number) {
    return first(
      await this.db
        .select()
        .from(tournamentTeams)
        .where(and(eq(tournamentTeams.tournamentId, tournamentId), eq(tournamentTeams.teamId, teamId))),
    );
  }
}

export class MatchRepository extends DrizzleRepository<typeof matches> implements IMatchRepository {
  constructor(context: DbContext) {
    super(context, matches, "Match");
  }
  async getByTournament(tournamentId: number) {
    return this.db
      .select()
      .from(matches)
      .where(eq(matches.tournamentId, tournamentId))
      .orderBy(asc(matches.round), asc(matches.bracketPosition));
  }
}

export class MatchResultRepository
  extends DrizzleRepository<typeof matchResults>
  implements IMatchResultRepository
{
  constructor(context: DbContext) {
    super(context, matchResults, "MatchResult");
  }
  async getByMatch(matchId: number) {
    return this.db.select().from(matchResults).where(eq(matchResults.matchId, matchId)).orderBy(asc(matchResults.id));
  }
}

export class AnnouncementRepository
  extends DrizzleRepository<typeof announcements>
  implements IAnnouncementRepository
{
  constructor(context: DbContext) {
    super(context, announcements, "Announcement");
  }
  async getByTournament(tournamentId: number) {
    return this.db
      .select()
      .from(announcements)
      .where(eq(announcements.tournamentId, tournamentId))
      .orderBy(asc(announcements.id));
  }
}

/**
 * Postgres transaction around an async callback. Repositories pick up the
 * transaction automatically through `DbContext`; see `runInTransaction`.
 */
export class PostgresUnitOfWork implements IUnitOfWork {
  constructor(private readonly context: DbContext) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.context.runInTransaction(work);
  }
}
