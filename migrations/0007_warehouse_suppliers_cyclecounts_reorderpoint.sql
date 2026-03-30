CREATE TABLE `cycle_count_items` (
	`id` varchar(36) NOT NULL,
	`cycle_count_id` varchar(36),
	`product_id` varchar(36),
	`bin_id` varchar(36),
	`expected_quantity` int NOT NULL,
	`actual_quantity` int,
	`variance` int,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`counted_at` timestamp,
	CONSTRAINT `cycle_count_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cycle_counts` (
	`id` varchar(36) NOT NULL,
	`location_id` varchar(36),
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`started_by` varchar(36),
	`completed_at` timestamp,
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `cycle_counts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`contact_name` varchar(255),
	`email` varchar(255),
	`phone` varchar(50),
	`address` text,
	`notes` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `products` ADD `reorder_point` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `cycle_count_items` ADD CONSTRAINT `cycle_count_items_cycle_count_id_cycle_counts_id_fk` FOREIGN KEY (`cycle_count_id`) REFERENCES `cycle_counts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cycle_count_items` ADD CONSTRAINT `cycle_count_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cycle_count_items` ADD CONSTRAINT `cycle_count_items_bin_id_warehouse_bins_id_fk` FOREIGN KEY (`bin_id`) REFERENCES `warehouse_bins`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cycle_counts` ADD CONSTRAINT `cycle_counts_location_id_warehouse_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `warehouse_locations`(`id`) ON DELETE no action ON UPDATE no action;