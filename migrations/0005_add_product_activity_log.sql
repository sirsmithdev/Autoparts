CREATE TABLE `product_activity_log` (
	`id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`action` varchar(50) NOT NULL,
	`details` json,
	`performed_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `product_activity_log` ADD CONSTRAINT `product_activity_log_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_product_activity_product` ON `product_activity_log` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_product_activity_created` ON `product_activity_log` (`created_at`);