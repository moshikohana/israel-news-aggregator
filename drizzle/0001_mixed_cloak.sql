CREATE TABLE `contact_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`member_id` int NOT NULL,
	`date` date NOT NULL,
	`channel` varchar(32) NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`full_name` varchar(255) NOT NULL,
	`phone` varchar(64),
	`email` varchar(320),
	`city` varchar(128),
	`region` varchar(128),
	`address` varchar(512),
	`birthday` date,
	`family_events` text,
	`party_status` varchar(64),
	`activists_count` int NOT NULL DEFAULT 0,
	`notes` text,
	`tags` varchar(512),
	`last_contact_date` date,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `members_id` PRIMARY KEY(`id`)
);
