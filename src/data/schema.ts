import { sql } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
  unique,
  check,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

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

const createdAt = (name: string) =>
  integer(name, { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userName: text("user_name").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  gamerTag: text("gamer_tag").notNull().unique(),
  role: text("role", { enum: USER_ROLES }).notNull().default("player"),
  registeredOn: createdAt("registered_on"),
});

export const games = sqliteTable(
  "games",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
    genre: text("genre").notNull(),
    teamSize: integer("team_size").notNull(),
  },
  (t) => [check("games_team_size_positive", sql`${t.teamSize} >= 1`)],
);

export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  captainId: integer("captain_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  isSoloEntry: integer("is_solo_entry", { mode: "boolean" }).notNull().default(false),
  createdOn: createdAt("created_on"),
});

export const teamMembers = sqliteTable(
  "team_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invitationStatus: text("invitation_status", { enum: INVITATION_STATUSES })
      .notNull()
      .default("pending"),
    joinedOn: integer("joined_on", { mode: "timestamp" }),
  },
  (t) => [unique("team_members_team_user").on(t.teamId, t.userId)],
);

export const tournaments = sqliteTable(
  "tournaments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameId: integer("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "restrict" }),
    organizerId: integer("organizer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    format: text("format", { enum: TOURNAMENT_FORMATS }).notNull().default("single_elimination"),
    maxParticipants: integer("max_participants").notNull(),
    prizePool: real("prize_pool").notNull().default(0),
    startDate: integer("start_date", { mode: "timestamp" }).notNull(),
    endDate: integer("end_date", { mode: "timestamp" }).notNull(),
    status: text("status", { enum: TOURNAMENT_STATUSES }).notNull().default("draft"),
  },
  (t) => [
    check("tournaments_max_participants", sql`${t.maxParticipants} >= 2`),
    check("tournaments_prize_non_negative", sql`${t.prizePool} >= 0`),
    check("tournaments_dates_ordered", sql`${t.endDate} >= ${t.startDate}`),
  ],
);

export const tournamentTeams = sqliteTable(
  "tournament_teams",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
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

export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  teamAId: integer("team_a_id").references(() => teams.id, { onDelete: "restrict" }),
  teamBId: integer("team_b_id").references(() => teams.id, { onDelete: "restrict" }),
  winnerTeamId: integer("winner_team_id").references(() => teams.id, { onDelete: "restrict" }),
  nextMatchId: integer("next_match_id").references((): AnySQLiteColumn => matches.id, {
    onDelete: "set null",
  }),
  // Which slot of the next match the winner fills. Not in the original ERD; required to advance winners.
  nextSlot: text("next_slot", { enum: BRACKET_SLOTS }),
  round: integer("round").notNull(),
  bracketPosition: integer("bracket_position").notNull(),
  scheduledTime: integer("scheduled_time", { mode: "timestamp" }),
  status: text("status", { enum: MATCH_STATUSES }).notNull().default("pending"),
});

export const matchResults = sqliteTable(
  "match_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    reportedByTeamId: integer("reported_by_team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    scoreA: integer("score_a").notNull(),
    scoreB: integer("score_b").notNull(),
    proofUrl: text("proof_url"),
    isConfirmed: integer("is_confirmed", { mode: "boolean" }).notNull().default(false),
    submittedOn: createdAt("submitted_on"),
  },
  (t) => [
    unique("match_results_match_team").on(t.matchId, t.reportedByTeamId),
    check("match_results_scores_non_negative", sql`${t.scoreA} >= 0 and ${t.scoreB} >= 0`),
  ],
);

export const announcements = sqliteTable("announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
