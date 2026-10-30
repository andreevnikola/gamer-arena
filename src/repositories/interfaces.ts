import type {
  Announcement,
  Game,
  Match,
  MatchResult,
  NewAnnouncement,
  NewGame,
  NewMatch,
  NewMatchResult,
  NewTeam,
  NewTeamMember,
  NewTournament,
  NewTournamentTeam,
  NewUser,
  Team,
  TeamMember,
  Tournament,
  TournamentTeam,
  User,
} from "@/data/types";
import type { IRepository } from "./repository";

export interface IUserRepository extends IRepository<User, NewUser> {
  getByEmail(email: string): Promise<User | undefined>;
  getByUserName(userName: string): Promise<User | undefined>;
  getByGamerTag(gamerTag: string): Promise<User | undefined>;
}

export type IGameRepository = IRepository<Game, NewGame>;

export interface ITeamRepository extends IRepository<Team, NewTeam> {
  getByCaptain(captainId: number): Promise<Team[]>;
  getByName(name: string): Promise<Team | undefined>;
}

export interface ITeamMemberRepository extends IRepository<TeamMember, NewTeamMember> {
  getByTeam(teamId: number): Promise<TeamMember[]>;
  getByUser(userId: number): Promise<TeamMember[]>;
  getByTeamAndUser(teamId: number, userId: number): Promise<TeamMember | undefined>;
}

export interface ITournamentRepository extends IRepository<Tournament, NewTournament> {
  getByOrganizer(organizerId: number): Promise<Tournament[]>;
  getByStatus(status: Tournament["status"]): Promise<Tournament[]>;
}

export interface ITournamentTeamRepository extends IRepository<TournamentTeam, NewTournamentTeam> {
  getByTournament(tournamentId: number): Promise<TournamentTeam[]>;
  getByTournamentAndTeam(tournamentId: number, teamId: number): Promise<TournamentTeam | undefined>;
}

export interface IMatchRepository extends IRepository<Match, NewMatch> {
  /** Ordered by round, then bracket position. */
  getByTournament(tournamentId: number): Promise<Match[]>;
}

export interface IMatchResultRepository extends IRepository<MatchResult, NewMatchResult> {
  getByMatch(matchId: number): Promise<MatchResult[]>;
}

export interface IAnnouncementRepository extends IRepository<Announcement, NewAnnouncement> {
  getByTournament(tournamentId: number): Promise<Announcement[]>;
}

/**
 * Runs several repository calls atomically. The callback must only await
 * repository calls (no external I/O): the transaction, and the lock that
 * serialises units of work, are held for the whole callback.
 */
export interface IUnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}

export interface Repositories {
  users: IUserRepository;
  games: IGameRepository;
  teams: ITeamRepository;
  teamMembers: ITeamMemberRepository;
  tournaments: ITournamentRepository;
  tournamentTeams: ITournamentTeamRepository;
  matches: IMatchRepository;
  matchResults: IMatchResultRepository;
  announcements: IAnnouncementRepository;
  unitOfWork: IUnitOfWork;
}
