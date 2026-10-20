import type { IRepository, Repositories } from "@/repositories";
import type {
  Announcement,
  Game,
  Match,
  MatchResult,
  Team,
  TeamMember,
  Tournament,
  TournamentTeam,
  User,
} from "@/data/types";

/** In-memory IRepository used to unit test the business layer without a database. */
class InMemoryRepository<T extends { id: number }, TNew = Omit<T, "id">> implements IRepository<T, TNew> {
  protected rows = new Map<number, T>();
  private sequence = 0;

  constructor(private readonly defaults: () => Partial<T> = () => ({})) {}

  async getAll() {
    return [...this.rows.values()].map((r) => ({ ...r }));
  }
  async getById(id: number) {
    const row = this.rows.get(id);
    return row ? { ...row } : undefined;
  }
  async add(entity: TNew) {
    const row = { ...this.defaults(), ...(entity as object), id: ++this.sequence } as T;
    this.rows.set(row.id, row);
    return { ...row };
  }
  async update(entity: T) {
    if (!this.rows.has(entity.id)) throw new Error(`missing ${entity.id}`);
    this.rows.set(entity.id, { ...entity });
    return { ...entity };
  }
  async delete(id: number) {
    return this.rows.delete(id);
  }
  protected where(predicate: (row: T) => boolean) {
    return [...this.rows.values()].filter(predicate).map((r) => ({ ...r }));
  }
  protected find(predicate: (row: T) => boolean) {
    return this.where(predicate)[0];
  }
}

const now = () => new Date("2026-01-01T00:00:00Z");

class FakeUsers extends InMemoryRepository<User> {
  constructor() {
    super(() => ({ role: "player", registeredOn: now() }));
  }
  async getByEmail(email: string) {
    return this.find((u) => u.email === email.toLowerCase());
  }
  async getByUserName(userName: string) {
    return this.find((u) => u.userName === userName);
  }
  async getByGamerTag(gamerTag: string) {
    return this.find((u) => u.gamerTag === gamerTag);
  }
}

class FakeTeams extends InMemoryRepository<Team> {
  constructor() {
    super(() => ({ isSoloEntry: false, createdOn: now() }));
  }
  async getByCaptain(captainId: number) {
    return this.where((t) => t.captainId === captainId);
  }
  async getByName(name: string) {
    return this.find((t) => t.name === name);
  }
}

class FakeTeamMembers extends InMemoryRepository<TeamMember> {
  constructor() {
    super(() => ({ invitationStatus: "pending", joinedOn: null }));
  }
  async getByTeam(teamId: number) {
    return this.where((m) => m.teamId === teamId);
  }
  async getByUser(userId: number) {
    return this.where((m) => m.userId === userId);
  }
  async getByTeamAndUser(teamId: number, userId: number) {
    return this.find((m) => m.teamId === teamId && m.userId === userId);
  }
}

class FakeTournaments extends InMemoryRepository<Tournament> {
  constructor() {
    super(() => ({ format: "single_elimination", prizePool: 0, status: "draft" }));
  }
  async getByOrganizer(organizerId: number) {
    return this.where((t) => t.organizerId === organizerId);
  }
  async getByStatus(status: Tournament["status"]) {
    return this.where((t) => t.status === status);
  }
}

class FakeTournamentTeams extends InMemoryRepository<TournamentTeam> {
  constructor() {
    super(() => ({ status: "pending", seed: null, registeredOn: now() }));
  }
  async getByTournament(tournamentId: number) {
    return this.where((e) => e.tournamentId === tournamentId);
  }
  async getByTournamentAndTeam(tournamentId: number, teamId: number) {
    return this.find((e) => e.tournamentId === tournamentId && e.teamId === teamId);
  }
}

class FakeMatches extends InMemoryRepository<Match> {
  constructor() {
    super(() => ({
      teamAId: null,
      teamBId: null,
      winnerTeamId: null,
      nextMatchId: null,
      nextSlot: null,
      scheduledTime: null,
      status: "pending",
    }));
  }
  async getByTournament(tournamentId: number) {
    return this.where((m) => m.tournamentId === tournamentId).sort(
      (a, b) => a.round - b.round || a.bracketPosition - b.bracketPosition,
    );
  }
}

class FakeMatchResults extends InMemoryRepository<MatchResult> {
  constructor() {
    super(() => ({ proofUrl: null, isConfirmed: false, submittedOn: now() }));
  }
  async getByMatch(matchId: number) {
    return this.where((r) => r.matchId === matchId);
  }
}

class FakeAnnouncements extends InMemoryRepository<Announcement> {
  constructor() {
    super(() => ({ tournamentId: null, publishedOn: now() }));
  }
  async getByTournament(tournamentId: number) {
    return this.where((a) => a.tournamentId === tournamentId);
  }
}

export function createFakeRepositories(): Repositories {
  return {
    users: new FakeUsers(),
    games: new InMemoryRepository<Game>(),
    teams: new FakeTeams(),
    teamMembers: new FakeTeamMembers(),
    tournaments: new FakeTournaments(),
    tournamentTeams: new FakeTournamentTeams(),
    matches: new FakeMatches(),
    matchResults: new FakeMatchResults(),
    announcements: new FakeAnnouncements(),
    unitOfWork: { run: <T>(work: () => Promise<T>) => work() },
  } as unknown as Repositories;
}
