import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/data/db";
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
import { DrizzleRepository } from "./repository";

export class UserRepository extends DrizzleRepository<typeof users> implements IUserRepository {
  constructor(db: Db) {
    super(db, users, "User");
  }
  async getByEmail(email: string) {
    return this.db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
  }
  async getByUserName(userName: string) {
    return this.db.select().from(users).where(eq(users.userName, userName)).get();
  }
  async getByGamerTag(gamerTag: string) {
    return this.db.select().from(users).where(eq(users.gamerTag, gamerTag)).get();
  }
}

export class GameRepository extends DrizzleRepository<typeof games> implements IGameRepository {
  constructor(db: Db) {
    super(db, games, "Game");
  }
}

export class TeamRepository extends DrizzleRepository<typeof teams> implements ITeamRepository {
  constructor(db: Db) {
    super(db, teams, "Team");
  }
  async getByCaptain(captainId: number) {
    return this.db.select().from(teams).where(eq(teams.captainId, captainId)).all();
  }
  async getByName(name: string) {
    return this.db.select().from(teams).where(eq(teams.name, name)).get();
  }
}

export class TeamMemberRepository
  extends DrizzleRepository<typeof teamMembers>
  implements ITeamMemberRepository
{
  constructor(db: Db) {
    super(db, teamMembers, "TeamMember");
  }
  async getByTeam(teamId: number) {
    return this.db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId)).all();
  }
  async getByUser(userId: number) {
    return this.db.select().from(teamMembers).where(eq(teamMembers.userId, userId)).all();
  }
  async getByTeamAndUser(teamId: number, userId: number) {
    return this.db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .get();
  }
}

export class TournamentRepository
  extends DrizzleRepository<typeof tournaments>
  implements ITournamentRepository
{
  constructor(db: Db) {
    super(db, tournaments, "Tournament");
  }
  async getByOrganizer(organizerId: number) {
    return this.db.select().from(tournaments).where(eq(tournaments.organizerId, organizerId)).all();
  }
  async getByStatus(status: (typeof tournaments.$inferSelect)["status"]) {
    return this.db.select().from(tournaments).where(eq(tournaments.status, status)).all();
  }
}

export class TournamentTeamRepository
  extends DrizzleRepository<typeof tournamentTeams>
  implements ITournamentTeamRepository
{
  constructor(db: Db) {
    super(db, tournamentTeams, "TournamentTeam");
  }
  async getByTournament(tournamentId: number) {
    return this.db
      .select()
      .from(tournamentTeams)
      .where(eq(tournamentTeams.tournamentId, tournamentId))
      .orderBy(asc(tournamentTeams.id))
      .all();
  }
  async getByTournamentAndTeam(tournamentId: number, teamId: number) {
    return this.db
      .select()
      .from(tournamentTeams)
      .where(and(eq(tournamentTeams.tournamentId, tournamentId), eq(tournamentTeams.teamId, teamId)))
      .get();
  }
}

export class MatchRepository extends DrizzleRepository<typeof matches> implements IMatchRepository {
  constructor(db: Db) {
    super(db, matches, "Match");
  }
  async getByTournament(tournamentId: number) {
    return this.db
      .select()
      .from(matches)
      .where(eq(matches.tournamentId, tournamentId))
      .orderBy(asc(matches.round), asc(matches.bracketPosition))
      .all();
  }
}

export class MatchResultRepository
  extends DrizzleRepository<typeof matchResults>
  implements IMatchResultRepository
{
  constructor(db: Db) {
    super(db, matchResults, "MatchResult");
  }
  async getByMatch(matchId: number) {
    return this.db.select().from(matchResults).where(eq(matchResults.matchId, matchId)).all();
  }
}

export class AnnouncementRepository
  extends DrizzleRepository<typeof announcements>
  implements IAnnouncementRepository
{
  constructor(db: Db) {
    super(db, announcements, "Announcement");
  }
  async getByTournament(tournamentId: number) {
    return this.db
      .select()
      .from(announcements)
      .where(eq(announcements.tournamentId, tournamentId))
      .all();
  }
}

/**
 * Explicit BEGIN/COMMIT around an async callback. Safe because the callback
 * only awaits repository calls, which resolve on the microtask queue and so
 * cannot interleave with another request on the same connection.
 */
export class SqliteUnitOfWork implements IUnitOfWork {
  private depth = 0;

  constructor(private readonly db: Db) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.depth > 0) return work();
    this.db.run("BEGIN IMMEDIATE");
    this.depth++;
    try {
      const result = await work();
      this.db.run("COMMIT");
      return result;
    } catch (error) {
      this.db.run("ROLLBACK");
      throw error;
    } finally {
      this.depth--;
    }
  }
}
