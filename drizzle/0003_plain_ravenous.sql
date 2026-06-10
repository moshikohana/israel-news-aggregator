CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor_open_id` varchar(64),
	`actor_name` varchar(255),
	`action` varchar(64) NOT NULL,
	`entity` varchar(64) NOT NULL,
	`entity_id` varchar(64),
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `members` ADD `support_level` enum('תומך','נוטה','מתלבט','מתנגד','לא ידוע') DEFAULT 'לא ידוע' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `vote_status` enum('טרם הצביע','הצביע') DEFAULT 'טרם הצביע' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `assigned_activist` varchar(255);