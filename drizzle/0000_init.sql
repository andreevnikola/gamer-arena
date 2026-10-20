CREATE TABLE `announcements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`author_id` integer NOT NULL,
	`tournament_id` integer,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`published_on` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`genre` text NOT NULL,
	`team_size` integer NOT NULL,
	CONSTRAINT "games_team_size_positive" CHECK("games"."team_size" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_name_unique` ON `games` (`name`);--> statement-breakpoint
CREATE TABLE `match_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`reported_by_team_id` integer NOT NULL,
	`score_a` integer NOT NULL,
	`score_b` integer NOT NULL,
	`proof_url` text,
	`is_confirmed` integer DEFAULT false NOT NULL,
	`submitted_on` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reported_by_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "match_results_scores_non_negative" CHECK("match_results"."score_a" >= 0 and "match_results"."score_b" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_results_match_team` ON `match_results` (`match_id`,`reported_by_team_id`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tournament_id` integer NOT NULL,
	`team_a_id` integer,
	`team_b_id` integer,
	`winner_team_id` integer,
	`next_match_id` integer,
	`next_slot` text,
	`round` integer NOT NULL,
	`bracket_position` integer NOT NULL,
	`scheduled_time` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_a_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`team_b_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`winner_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`next_match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`invitation_status` text DEFAULT 'pending' NOT NULL,
	`joined_on` integer,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_team_user` ON `team_members` (`team_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`captain_id` integer NOT NULL,
	`is_solo_entry` integer DEFAULT false NOT NULL,
	`created_on` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`captain_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_name_unique` ON `teams` (`name`);--> statement-breakpoint
CREATE TABLE `tournament_teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tournament_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`seed` integer,
	`registered_on` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournament_teams_tournament_team` ON `tournament_teams` (`tournament_id`,`team_id`);--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`organizer_id` integer NOT NULL,
	`title` text NOT NULL,
	`format` text DEFAULT 'single_elimination' NOT NULL,
	`max_participants` integer NOT NULL,
	`prize_pool` real DEFAULT 0 NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`organizer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "tournaments_max_participants" CHECK("tournaments"."max_participants" >= 2),
	CONSTRAINT "tournaments_prize_non_negative" CHECK("tournaments"."prize_pool" >= 0),
	CONSTRAINT "tournaments_dates_ordered" CHECK("tournaments"."end_date" >= "tournaments"."start_date")
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`gamer_tag` text NOT NULL,
	`role` text DEFAULT 'player' NOT NULL,
	`registered_on` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_user_name_unique` ON `users` (`user_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_gamer_tag_unique` ON `users` (`gamer_tag`);