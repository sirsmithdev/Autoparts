ALTER TABLE `customers` MODIFY COLUMN `auth_provider` enum('email','google','garage') NOT NULL DEFAULT 'email';--> statement-breakpoint
ALTER TABLE `customers` ADD `garage_user_id` varchar(36);--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_garage_user_id_unique` UNIQUE(`garage_user_id`);