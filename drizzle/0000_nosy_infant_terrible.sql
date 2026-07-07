CREATE TABLE `circle_contact_prefs` (
	`circle_id` text NOT NULL,
	`contact_type_id` text NOT NULL,
	`weight` integer NOT NULL,
	PRIMARY KEY(`circle_id`, `contact_type_id`),
	FOREIGN KEY (`circle_id`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_type_id`) REFERENCES `contact_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `circles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`interval_days` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `circles_user_name_uq` ON `circles` (`user_id`,`name`);--> statement-breakpoint
CREATE INDEX `circles_user_idx` ON `circles` (`user_id`);--> statement-breakpoint
CREATE TABLE `contact_types` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text,
	`emoji` text,
	`default_weight` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contact_types_user_idx` ON `contact_types` (`user_id`);--> statement-breakpoint
CREATE TABLE `friend_circles` (
	`friend_id` text NOT NULL,
	`circle_id` text NOT NULL,
	PRIMARY KEY(`friend_id`, `circle_id`),
	FOREIGN KEY (`friend_id`) REFERENCES `friends`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`circle_id`) REFERENCES `circles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `fc_circle_idx` ON `friend_circles` (`circle_id`);--> statement-breakpoint
CREATE TABLE `friend_contact_prefs` (
	`friend_id` text NOT NULL,
	`contact_type_id` text NOT NULL,
	`weight` integer NOT NULL,
	PRIMARY KEY(`friend_id`, `contact_type_id`),
	FOREIGN KEY (`friend_id`) REFERENCES `friends`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_type_id`) REFERENCES `contact_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `friends` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`interval_override_days` integer,
	`autoschedule` integer DEFAULT true NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`birth_month` integer,
	`birth_day` integer,
	`birth_year` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `friends_user_idx` ON `friends` (`user_id`,`archived`);--> statement-breakpoint
CREATE TABLE `interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`friend_id` text NOT NULL,
	`contact_type_id` text NOT NULL,
	`occurred_on` text NOT NULL,
	`note` text,
	`task_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`friend_id`) REFERENCES `friends`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_type_id`) REFERENCES `contact_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `interactions_friend_date_idx` ON `interactions` (`friend_id`,`occurred_on`);--> statement-breakpoint
CREATE INDEX `interactions_user_idx` ON `interactions` (`user_id`);--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`email` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_by` text,
	`used_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`used_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_token_hash_unique` ON `invites` (`token_hash`);--> statement-breakpoint
CREATE TABLE `job_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`job` text NOT NULL,
	`run_date` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`detail` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_runs_job_date_uq` ON `job_runs` (`job`,`run_date`);--> statement-breakpoint
CREATE TABLE `notification_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notif_channel_user_uq` ON `notification_channels` (`user_id`,`channel`);--> statement-breakpoint
CREATE TABLE `notification_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`kind` text NOT NULL,
	`digest_date` text NOT NULL,
	`task_ids` text DEFAULT '[]' NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`sent_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notif_dedupe_idx` ON `notification_log` (`user_id`,`channel`,`kind`,`digest_date`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`friend_id` text NOT NULL,
	`kind` text DEFAULT 'contact' NOT NULL,
	`suggested_type_id` text NOT NULL,
	`due_date` text NOT NULL,
	`window_days` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`origin` text NOT NULL,
	`snooze_count` integer DEFAULT 0 NOT NULL,
	`interaction_id` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`friend_id`) REFERENCES `friends`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`suggested_type_id`) REFERENCES `contact_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tasks_user_status_due_idx` ON `tasks` (`user_id`,`status`,`due_date`);--> statement-breakpoint
CREATE INDEX `tasks_friend_status_idx` ON `tasks` (`friend_id`,`status`);--> statement-breakpoint
CREATE TABLE `user_contact_prefs` (
	`user_id` text NOT NULL,
	`contact_type_id` text NOT NULL,
	`weight` integer NOT NULL,
	PRIMARY KEY(`user_id`, `contact_type_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_type_id`) REFERENCES `contact_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`timezone` text DEFAULT 'Europe/Copenhagen' NOT NULL,
	`action_window_days` integer DEFAULT 7 NOT NULL,
	`jitter_pct` integer DEFAULT 25 NOT NULL,
	`digest_hour` integer DEFAULT 8 NOT NULL,
	`default_interval_days` integer DEFAULT 30 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);