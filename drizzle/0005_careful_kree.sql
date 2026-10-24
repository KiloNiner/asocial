CREATE TABLE `oidc_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`issuer` text NOT NULL,
	`subject` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oidc_identities_subject_uq` ON `oidc_identities` (`issuer`,`subject`);--> statement-breakpoint
CREATE INDEX `oidc_identities_user_idx` ON `oidc_identities` (`user_id`);