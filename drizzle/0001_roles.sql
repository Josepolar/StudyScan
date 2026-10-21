CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_created` ON `audit_logs` (`created`);--> statement-breakpoint
ALTER TABLE `profiles` ADD `status` text DEFAULT 'active' NOT NULL;