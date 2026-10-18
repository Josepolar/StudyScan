CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`lesson` text NOT NULL,
	`data` text NOT NULL
);

--> statement-breakpoint
CREATE TABLE `classrooms` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX `classrooms_code_unique` ON `classrooms` (`code`);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`lesson` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL
);

--> statement-breakpoint
CREATE TABLE `interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`student` text NOT NULL,
	`lesson` text NOT NULL,
	`assignment` text,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`sources` text NOT NULL,
	`status` text NOT NULL,
	`flagged` integer DEFAULT 0 NOT NULL,
	`resolved` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created` text NOT NULL
);

--> statement-breakpoint
CREATE INDEX `idx_interactions_owner_created` ON `interactions` (`owner`,`created`);
--> statement-breakpoint
CREATE INDEX `idx_interactions_student_lesson` ON `interactions` (`student`,`lesson`);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`data` text NOT NULL,
	`updated` text NOT NULL
);

--> statement-breakpoint
CREATE INDEX `idx_lessons_owner` ON `lessons` (`owner`);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`classroom` text NOT NULL,
	`student` text NOT NULL
);

--> statement-breakpoint
CREATE INDEX `idx_memberships_student` ON `memberships` (`student`);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'student' NOT NULL
);

--> statement-breakpoint
CREATE TABLE `progress` (
	`id` text PRIMARY KEY NOT NULL,
	`student` text NOT NULL,
	`lesson` text NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL
);

--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
