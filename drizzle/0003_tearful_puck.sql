CREATE TABLE `rideShares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareFromUserId` int NOT NULL,
	`shareToUserId` int NOT NULL,
	`rideId` varchar(64) NOT NULL,
	`note` text,
	`canComment` int NOT NULL DEFAULT 1,
	`canLike` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rideShares_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shareComments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareId` int NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shareComments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shareLikes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shareLikes_id` PRIMARY KEY(`id`)
);
