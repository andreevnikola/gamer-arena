import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
  announcements,
  games,
  matchResults,
  matches,
  teamMembers,
  teams,
  tournamentTeams,
  tournaments,
  users,
} from "./schema";

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Game = InferSelectModel<typeof games>;
export type NewGame = InferInsertModel<typeof games>;
export type Team = InferSelectModel<typeof teams>;
export type NewTeam = InferInsertModel<typeof teams>;
export type TeamMember = InferSelectModel<typeof teamMembers>;
export type NewTeamMember = InferInsertModel<typeof teamMembers>;
export type Tournament = InferSelectModel<typeof tournaments>;
export type NewTournament = InferInsertModel<typeof tournaments>;
export type TournamentTeam = InferSelectModel<typeof tournamentTeams>;
export type NewTournamentTeam = InferInsertModel<typeof tournamentTeams>;
export type Match = InferSelectModel<typeof matches>;
export type NewMatch = InferInsertModel<typeof matches>;
export type MatchResult = InferSelectModel<typeof matchResults>;
export type NewMatchResult = InferInsertModel<typeof matchResults>;
export type Announcement = InferSelectModel<typeof announcements>;
export type NewAnnouncement = InferInsertModel<typeof announcements>;

export type UserRole = User["role"];
export type InvitationStatus = TeamMember["invitationStatus"];
export type TournamentStatus = Tournament["status"];
export type RegistrationStatus = TournamentTeam["status"];
export type MatchStatus = Match["status"];
export type BracketSlot = NonNullable<Match["nextSlot"]>;
