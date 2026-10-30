import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const USER_ROLES = ["player", "organizer", "admin"] as const;
export const INVITATION_STATUSES = ["pending", "accepted", "declined"] as const;
export const TOURNAMENT_FORMATS = ["single_elimination"] as const;
export const TOURNAMENT_STATUSES = [
  "draft",
  "registration_open",
  "registration_closed",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export const REGISTRATION_STATUSES = ["pending", "approved", "rejected"] as const;
export const MATCH_STATUSES = ["pending", "ready", "completed", "disputed"] as const;
export const BRACKET_SLOTS = ["A", "B"] as const;

const id = () => integer("id").primaryKey().generatedAlwaysAsIdentity();
const timestampColumn = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = (name: string) => timestampColumn(name).notNull().defaultNow();

export const users = pgTable("users", {
  id: id(),
  userName: text("user_name").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  gamerTag: text("gamer_tag").notNull().unique(),
  role: text("role", { enum: USER_ROLES }).notNull().default("player"),
  registeredOn: createdAt("registered_on"),
});

export const games = pgTable(
  "games",
  {
    id: id(),
    name: text("name").notNull().unique(),
    genre: text("genre").notNull(),
    teamSize: integer("team_size").notNull(),
  },
  (t) => [check("games_team_size_positive", sql`${t.teamSize} >= 1`)],
);

export const teams = pgTable("teams", {
  id: id(),
  name: text("name").notNull().unique(),
  captainId: integer("captain_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  isSoloEntry: boolean("is_solo_entry").notNull().default(false),
  createdOn: createdAt("created_on"),
});

export const teamMembers = pgTable(
  "team_members",
  {
    id: id(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invitationStatus: text("invitation_status", { enum: INVITATION_STATUSES })
      .notNull()
      .default("pending"),
    joinedOn: timestampColumn("joined_on"),
  },
  (t) => [unique("team_members_team_user").on(t.teamId, t.userId)],
);

export const tournaments = pgTable(
  "tournaments",
  {
    id: id(),
    gameId: integer("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "restrict" }),
    organizerId: integer("organizer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    format: text("format", { enum: TOURNAMENT_FORMATS }).notNull().default("single_elimination"),
    maxParticipants: integer("max_participants").notNull(),
    prizePool: doublePrecision("prize_pool").notNull().default(0),
    startDate: timestampColumn("start_date").notNull(),
    endDate: timestampColumn("end_date").notNull(),
    status: text("status", { enum: TOURNAMENT_STATUSES }).notNull().default("draft"),
  },
  (t) => [
    check("tournaments_max_participants", sql`${t.maxParticipants} >= 2`),
    check("tournaments_prize_non_negative", sql`${t.prizePool} >= 0`),
    check("tournaments_dates_ordered", sql`${t.endDate} >= ${t.startDate}`),
  ],
);

export const tournamentTeams = pgTable(
  "tournament_teams",
  {
    id: id(),
    tournamentId: integer("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    status: text("status", { enum: REGISTRATION_STATUSES }).notNull().default("pending"),
    seed: integer("seed"),
    registeredOn: createdAt("registered_on"),
  },
  (t) => [unique("tournament_teams_tournament_team").on(t.tournamentId, t.teamId)],
);

export const matches = pgTable("matches", {
  id: id(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  teamAId: integer("team_a_id").references(() => teams.id, { onDelete: "restrict" }),
  teamBId: integer("team_b_id").references(() => teams.id, { onDelete: "restrict" }),
  winnerTeamId: integer("winner_team_id").references(() => teams.id, { onDelete: "restrict" }),
  nextMatchId: integer("next_match_id").references((): AnyPgColumn => matches.id, {
    onDelete: "set null",
  }),
  // Which slot of the next match the winner fills. Not in the original ERD; required to advance winners.
  nextSlot: text("next_slot", { enum: BRACKET_SLOTS }),
  round: integer("round").notNull(),
  bracketPosition: integer("bracket_position").notNull(),
  scheduledTime: timestampColumn("scheduled_time"),
  status: text("status", { enum: MATCH_STATUSES }).notNull().default("pending"),
});

export const matchResults = pgTable(
  "match_results",
  {
    id: id(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    reportedByTeamId: integer("reported_by_team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    scoreA: integer("score_a").notNull(),
    scoreB: integer("score_b").notNull(),
    proofUrl: text("proof_url"),
    isConfirmed: boolean("is_confirmed").notNull().default(false),
    submittedOn: createdAt("submitted_on"),
  },
  (t) => [
    unique("match_results_match_team").on(t.matchId, t.reportedByTeamId),
    check("match_results_scores_non_negative", sql`${t.scoreA} >= 0 and ${t.scoreB} >= 0`),
  ],
);

export const announcements = pgTable("announcements", {
  id: id(),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tournamentId: integer("tournament_id").references(() => tournaments.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  publishedOn: createdAt("published_on"),
});
