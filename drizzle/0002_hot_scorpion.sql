CREATE TABLE `import_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`file_name` varchar(512) NOT NULL,
	`row_count` int NOT NULL DEFAULT 0,
	`inserted_count` int NOT NULL DEFAULT 0,
	`skipped_count` int NOT NULL DEFAULT 0,
	`imported_by` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `import_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `members` ADD `source_type` enum('manual','import') DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `source_file` varchar(512);--> statement-breakpoint
ALTER TABLE `members` ADD `import_batch_id` int;--> statement-breakpoint
ALTER TABLE `members` ADD `imported_at` timestamp;