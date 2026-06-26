CREATE TABLE `rideComments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`rideId` varchar(64) NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rideComments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rideInteractions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`rideId` varchar(64) NOT NULL,
	`isLiked` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rideInteractions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `locationShares` ADD `batteryLevel` int DEFAULT -1;