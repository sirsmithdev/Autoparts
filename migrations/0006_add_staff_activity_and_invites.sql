CREATE TABLE `staff_activity_log` (
	`id` varchar(36) NOT NULL,
	`staff_id` varchar(36) NOT NULL,
	`action` varchar(100) NOT NULL,
	`entity` varchar(50),
	`entity_id` varchar(36),
	`details` json,
	`ip_address` varchar(45),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_invites` (
	`id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`role` enum('admin','manager','warehouse_staff','cashier') NOT NULL,
	`invited_by` varchar(36) NOT NULL,
	`status` enum('pending','accepted','expired') NOT NULL DEFAULT 'pending',
	`token` varchar(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_invites_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `staff_activity_log` ADD CONSTRAINT `staff_activity_log_staff_id_customers_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff_invites` ADD CONSTRAINT `staff_invites_invited_by_customers_id_fk` FOREIGN KEY (`invited_by`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_staff_activity_staff` ON `staff_activity_log` (`staff_id`);--> statement-breakpoint
CREATE INDEX `idx_staff_activity_action` ON `staff_activity_log` (`action`);--> statement-breakpoint
CREATE INDEX `idx_staff_activity_entity` ON `staff_activity_log` (`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_staff_activity_created` ON `staff_activity_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_staff_invites_email` ON `staff_invites` (`email`);--> statement-breakpoint
CREATE INDEX `idx_staff_invites_token` ON `staff_invites` (`token`);