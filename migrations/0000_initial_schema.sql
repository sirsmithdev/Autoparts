CREATE TABLE `customers` (
	`id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password` text,
	`first_name` text,
	`last_name` text,
	`phone` text,
	`address` text,
	`parish` text,
	`auth_provider` enum('email','google') NOT NULL DEFAULT 'email',
	`google_id` varchar(255),
	`profile_image_url` text,
	`email_verified` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_email_unique` UNIQUE(`email`),
	CONSTRAINT `customers_google_id_unique` UNIQUE(`google_id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_zones` (
	`id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`parishes` json NOT NULL,
	`delivery_fee` decimal(10,2) NOT NULL,
	`oversized_surcharge` decimal(10,2) NOT NULL DEFAULT '0.00',
	`estimated_days` int NOT NULL DEFAULT 1,
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `delivery_zones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `online_order_number_sequence` (
	`year` int NOT NULL,
	`last_number` int NOT NULL DEFAULT 0,
	CONSTRAINT `online_order_number_sequence_year` PRIMARY KEY(`year`)
);
--> statement-breakpoint
CREATE TABLE `online_return_number_sequence` (
	`year` int NOT NULL,
	`last_number` int NOT NULL DEFAULT 0,
	CONSTRAINT `online_return_number_sequence_year` PRIMARY KEY(`year`)
);
--> statement-breakpoint
CREATE TABLE `online_store_order_items` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`product_name` text NOT NULL,
	`product_number` varchar(100) NOT NULL,
	`quantity` int NOT NULL,
	`unit_price` decimal(10,2) NOT NULL,
	`line_total` decimal(10,2) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `online_store_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `online_store_orders` (
	`id` varchar(36) NOT NULL,
	`order_number` varchar(50) NOT NULL,
	`customer_id` varchar(36) NOT NULL,
	`status` enum('pending_payment','placed','confirmed','picking','packed','shipped','out_for_delivery','delivered','cancelled','refund_pending') NOT NULL DEFAULT 'pending_payment',
	`delivery_method` enum('local_delivery','pickup') NOT NULL,
	`delivery_zone_id` varchar(36),
	`delivery_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
	`delivery_address` text,
	`delivery_parish` varchar(100),
	`delivery_notes` text,
	`estimated_delivery_date` timestamp,
	`subtotal` decimal(10,2) NOT NULL DEFAULT '0.00',
	`tax_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`total` decimal(10,2) NOT NULL DEFAULT '0.00',
	`payment_transaction_id` varchar(36),
	`payment_status` enum('pending','paid','refunded','voided') DEFAULT 'pending',
	`pick_list_id` varchar(36),
	`tracking_number` text,
	`customer_name` text,
	`customer_email` text,
	`customer_phone` text,
	`staff_notes` text,
	`placed_at` timestamp,
	`confirmed_at` timestamp,
	`packed_at` timestamp,
	`packed_by` varchar(36),
	`shipped_at` timestamp,
	`delivered_at` timestamp,
	`pickup_ready_at` timestamp,
	`picked_up_at` timestamp,
	`picked_up_by` text,
	`cancelled_at` timestamp,
	`cancelled_by` varchar(36),
	`cancellation_reason` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `online_store_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `online_store_orders_order_number_unique` UNIQUE(`order_number`)
);
--> statement-breakpoint
CREATE TABLE `online_store_return_items` (
	`id` varchar(36) NOT NULL,
	`return_id` varchar(36) NOT NULL,
	`order_item_id` varchar(36) NOT NULL,
	`quantity` int NOT NULL,
	`reason` text,
	`condition_on_return` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `online_store_return_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `online_store_returns` (
	`id` varchar(36) NOT NULL,
	`return_number` varchar(50) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`customer_id` varchar(36) NOT NULL,
	`status` enum('requested','approved','rejected','shipped_back','received','refunded','exchanged','closed') NOT NULL DEFAULT 'requested',
	`reason` enum('wrong_part','defective','not_needed','wrong_fitment','damaged_in_shipping','other') NOT NULL,
	`reason_details` text,
	`resolution` enum('refund','exchange','store_credit'),
	`refund_amount` decimal(10,2),
	`restocking_fee` decimal(10,2),
	`return_shipping_paid_by` varchar(20),
	`requested_at` timestamp NOT NULL DEFAULT (now()),
	`approved_at` timestamp,
	`approved_by` varchar(36),
	`rejected_at` timestamp,
	`rejected_by` varchar(36),
	`rejection_reason` text,
	`shipped_back_at` timestamp,
	`shipped_back_tracking_number` text,
	`received_at` timestamp,
	`received_by` varchar(36),
	`closed_at` timestamp,
	`staff_notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `online_store_returns_id` PRIMARY KEY(`id`),
	CONSTRAINT `online_store_returns_return_number_unique` UNIQUE(`return_number`)
);
--> statement-breakpoint
CREATE TABLE `payment_methods` (
	`id` varchar(36) NOT NULL,
	`customer_id` varchar(36) NOT NULL,
	`pan_token` varchar(255),
	`card_brand` varchar(20),
	`masked_pan` varchar(20),
	`cardholder_name` text,
	`expiry_month` int,
	`expiry_year` int,
	`is_default` boolean NOT NULL DEFAULT false,
	`is_verified` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_methods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pick_list_items` (
	`id` varchar(36) NOT NULL,
	`pick_list_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`bin_id` varchar(36) NOT NULL,
	`quantity_required` int NOT NULL,
	`quantity_picked` int NOT NULL DEFAULT 0,
	`status` enum('pending','picked','short','skipped') NOT NULL DEFAULT 'pending',
	`picked_at` timestamp,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pick_list_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pick_list_number_sequence` (
	`year` int NOT NULL,
	`last_number` int NOT NULL DEFAULT 0,
	CONSTRAINT `pick_list_number_sequence_year` PRIMARY KEY(`year`)
);
--> statement-breakpoint
CREATE TABLE `pick_lists` (
	`id` varchar(36) NOT NULL,
	`pick_list_number` varchar(50) NOT NULL,
	`source_type` enum('online_order','manual') NOT NULL,
	`source_id` varchar(36) NOT NULL,
	`status` enum('pending','assigned','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
	`assigned_to` varchar(36),
	`assigned_at` timestamp,
	`started_at` timestamp,
	`completed_at` timestamp,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pick_lists_id` PRIMARY KEY(`id`),
	CONSTRAINT `pick_lists_pick_list_number_unique` UNIQUE(`pick_list_number`)
);
--> statement-breakpoint
CREATE TABLE `pos_held_carts` (
	`id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`items` json NOT NULL,
	`held_by` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pos_held_carts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pos_session_number_sequence` (
	`year` int NOT NULL,
	`last_number` int NOT NULL DEFAULT 0,
	CONSTRAINT `pos_session_number_sequence_year` PRIMARY KEY(`year`)
);
--> statement-breakpoint
CREATE TABLE `pos_sessions` (
	`id` varchar(36) NOT NULL,
	`session_number` varchar(50) NOT NULL,
	`opened_by` varchar(36) NOT NULL,
	`closed_by` varchar(36),
	`opened_at` timestamp NOT NULL DEFAULT (now()),
	`closed_at` timestamp,
	`opening_cash` decimal(10,2) NOT NULL,
	`closing_cash` decimal(10,2),
	`expected_cash` decimal(10,2),
	`cash_difference` decimal(10,2),
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pos_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `pos_sessions_session_number_unique` UNIQUE(`session_number`)
);
--> statement-breakpoint
CREATE TABLE `pos_transaction_items` (
	`id` varchar(36) NOT NULL,
	`transaction_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`product_name` text NOT NULL,
	`product_number` varchar(100) NOT NULL,
	`quantity` int NOT NULL,
	`unit_price` decimal(10,2) NOT NULL,
	`discount_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
	`discount_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`line_total` decimal(10,2) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pos_transaction_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pos_transaction_number_sequence` (
	`year` int NOT NULL,
	`last_number` int NOT NULL DEFAULT 0,
	CONSTRAINT `pos_transaction_number_sequence_year` PRIMARY KEY(`year`)
);
--> statement-breakpoint
CREATE TABLE `pos_transactions` (
	`id` varchar(36) NOT NULL,
	`transaction_number` varchar(50) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`customer_id` varchar(36),
	`type` enum('sale','refund','void') NOT NULL,
	`status` enum('completed','voided','refunded') NOT NULL DEFAULT 'completed',
	`subtotal` decimal(10,2) NOT NULL,
	`tax_amount` decimal(10,2) NOT NULL,
	`discount_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`total` decimal(10,2) NOT NULL,
	`payment_method` enum('cash','card','saved_card','split') NOT NULL,
	`cash_received` decimal(10,2),
	`change_given` decimal(10,2),
	`card_transaction_id` varchar(100),
	`processed_by` varchar(36) NOT NULL,
	`voided_by` varchar(36),
	`void_reason` text,
	`original_transaction_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pos_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `pos_transactions_transaction_number_unique` UNIQUE(`transaction_number`)
);
--> statement-breakpoint
CREATE TABLE `product_bin_assignments` (
	`id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`bin_id` varchar(36) NOT NULL,
	`quantity` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_bin_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_bin_assignments_unique` UNIQUE(`product_id`,`bin_id`)
);
--> statement-breakpoint
CREATE TABLE `product_compatibility` (
	`id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`make` varchar(100) NOT NULL,
	`model` varchar(100) NOT NULL,
	`year_start` int NOT NULL,
	`year_end` int NOT NULL,
	`trim` text,
	`engine_type` text,
	`vin` varchar(20),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_compatibility_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`image_url` text NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`alt_text` text,
	`is_primary` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_numbers` (
	`id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`part_number` varchar(100) NOT NULL,
	`number_type` enum('oem','aftermarket','interchange') NOT NULL,
	`brand` varchar(100),
	`is_primary` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_numbers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` varchar(36) NOT NULL,
	`garage_part_id` varchar(36),
	`name` text NOT NULL,
	`part_number` varchar(100) NOT NULL,
	`barcode` varchar(100),
	`sale_price` decimal(10,2) NOT NULL,
	`quantity` int NOT NULL DEFAULT 0,
	`low_stock_threshold` int NOT NULL DEFAULT 10,
	`description` text,
	`long_description` text,
	`manufacturer` text,
	`category` varchar(100),
	`image_url` text,
	`condition` enum('new','refurbished','used') NOT NULL DEFAULT 'new',
	`weight` decimal(8,2),
	`is_oversized` boolean NOT NULL DEFAULT false,
	`is_featured` boolean NOT NULL DEFAULT false,
	`featured_sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`last_synced_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_garage_part_id_unique` UNIQUE(`garage_part_id`),
	CONSTRAINT `products_part_number_unique` UNIQUE(`part_number`),
	CONSTRAINT `products_barcode_unique` UNIQUE(`barcode`)
);
--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` varchar(36) NOT NULL,
	`customer_id` varchar(36) NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `refresh_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `refresh_tokens_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `shopping_cart_items` (
	`id` varchar(36) NOT NULL,
	`cart_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`price_at_add_time` decimal(10,2) NOT NULL,
	`added_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shopping_cart_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_cart_items_unique` UNIQUE(`cart_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `shopping_carts` (
	`id` varchar(36) NOT NULL,
	`customer_id` varchar(36) NOT NULL,
	`last_activity_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shopping_carts_id` PRIMARY KEY(`id`),
	CONSTRAINT `shopping_carts_customer_id_unique` UNIQUE(`customer_id`)
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`bin_id` varchar(36),
	`movement_type` enum('received','sold_online','sold_pos','returned','transferred','adjusted_up','adjusted_down','damaged','reserved','unreserved') NOT NULL,
	`quantity` int NOT NULL,
	`reference_type` varchar(50),
	`reference_id` varchar(36),
	`notes` text,
	`performed_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_receipt_items` (
	`id` varchar(36) NOT NULL,
	`receipt_id` varchar(36) NOT NULL,
	`product_id` varchar(36) NOT NULL,
	`bin_id` varchar(36) NOT NULL,
	`quantity` int NOT NULL,
	`unit_cost` decimal(10,2) NOT NULL,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_receipt_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_receipt_number_sequence` (
	`year` int NOT NULL,
	`last_number` int NOT NULL DEFAULT 0,
	CONSTRAINT `stock_receipt_number_sequence_year` PRIMARY KEY(`year`)
);
--> statement-breakpoint
CREATE TABLE `stock_receipts` (
	`id` varchar(36) NOT NULL,
	`receipt_number` varchar(50) NOT NULL,
	`supplier_id` varchar(36),
	`status` enum('draft','received','cancelled') NOT NULL DEFAULT 'draft',
	`received_by` varchar(36),
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_receipts_receipt_number_unique` UNIQUE(`receipt_number`)
);
--> statement-breakpoint
CREATE TABLE `store_settings` (
	`id` int NOT NULL DEFAULT 1,
	`tax_rate` decimal(5,2) NOT NULL DEFAULT '15.00',
	`tax_name` text NOT NULL DEFAULT ('GCT'),
	`currency` varchar(3) NOT NULL DEFAULT 'JMD',
	`currency_symbol` text NOT NULL DEFAULT ('$'),
	`return_window_days` int NOT NULL DEFAULT 14,
	`defective_return_window_days` int NOT NULL DEFAULT 30,
	`restocking_fee_percent` decimal(5,2) NOT NULL DEFAULT '15.00',
	`electrical_parts_return_policy` text,
	`max_quantity_per_item` int NOT NULL DEFAULT 50,
	`max_items_per_order` int NOT NULL DEFAULT 200,
	`cart_expiration_days` int NOT NULL DEFAULT 30,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `store_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_log` (
	`id` varchar(36) NOT NULL,
	`direction` enum('inbound','outbound') NOT NULL,
	`entity` varchar(50) NOT NULL,
	`payload` json,
	`status` enum('success','failed','queued') NOT NULL,
	`error_message` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sync_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_queue` (
	`id` varchar(36) NOT NULL,
	`endpoint` varchar(255) NOT NULL,
	`method` varchar(10) NOT NULL,
	`payload` json,
	`attempts` int NOT NULL DEFAULT 0,
	`last_attempt_at` timestamp,
	`next_retry_at` timestamp,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`error_message` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sync_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `warehouse_bins` (
	`id` varchar(36) NOT NULL,
	`location_id` varchar(36) NOT NULL,
	`bin_code` varchar(50) NOT NULL,
	`description` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warehouse_bins_id` PRIMARY KEY(`id`),
	CONSTRAINT `warehouse_bins_bin_code_unique` UNIQUE(`bin_code`)
);
--> statement-breakpoint
CREATE TABLE `warehouse_locations` (
	`id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warehouse_locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `online_store_order_items` ADD CONSTRAINT `online_store_order_items_order_id_online_store_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `online_store_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `online_store_order_items` ADD CONSTRAINT `online_store_order_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `online_store_orders` ADD CONSTRAINT `online_store_orders_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `online_store_orders` ADD CONSTRAINT `online_store_orders_delivery_zone_id_delivery_zones_id_fk` FOREIGN KEY (`delivery_zone_id`) REFERENCES `delivery_zones`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `online_store_return_items` ADD CONSTRAINT `online_store_return_items_return_id_online_store_returns_id_fk` FOREIGN KEY (`return_id`) REFERENCES `online_store_returns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `online_store_return_items` ADD CONSTRAINT `online_store_return_items_order_item_id_online_store_order_items_id_fk` FOREIGN KEY (`order_item_id`) REFERENCES `online_store_order_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `online_store_returns` ADD CONSTRAINT `online_store_returns_order_id_online_store_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `online_store_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `online_store_returns` ADD CONSTRAINT `online_store_returns_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_methods` ADD CONSTRAINT `payment_methods_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pick_list_items` ADD CONSTRAINT `pick_list_items_pick_list_id_pick_lists_id_fk` FOREIGN KEY (`pick_list_id`) REFERENCES `pick_lists`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pick_list_items` ADD CONSTRAINT `pick_list_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pick_list_items` ADD CONSTRAINT `pick_list_items_bin_id_warehouse_bins_id_fk` FOREIGN KEY (`bin_id`) REFERENCES `warehouse_bins`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pos_transaction_items` ADD CONSTRAINT `pos_transaction_items_transaction_id_pos_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `pos_transactions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pos_transaction_items` ADD CONSTRAINT `pos_transaction_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pos_transactions` ADD CONSTRAINT `pos_transactions_session_id_pos_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `pos_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pos_transactions` ADD CONSTRAINT `pos_transactions_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_bin_assignments` ADD CONSTRAINT `product_bin_assignments_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_bin_assignments` ADD CONSTRAINT `product_bin_assignments_bin_id_warehouse_bins_id_fk` FOREIGN KEY (`bin_id`) REFERENCES `warehouse_bins`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_compatibility` ADD CONSTRAINT `product_compatibility_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_numbers` ADD CONSTRAINT `product_numbers_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shopping_cart_items` ADD CONSTRAINT `shopping_cart_items_cart_id_shopping_carts_id_fk` FOREIGN KEY (`cart_id`) REFERENCES `shopping_carts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shopping_cart_items` ADD CONSTRAINT `shopping_cart_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shopping_carts` ADD CONSTRAINT `shopping_carts_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_bin_id_warehouse_bins_id_fk` FOREIGN KEY (`bin_id`) REFERENCES `warehouse_bins`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_receipt_items` ADD CONSTRAINT `stock_receipt_items_receipt_id_stock_receipts_id_fk` FOREIGN KEY (`receipt_id`) REFERENCES `stock_receipts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_receipt_items` ADD CONSTRAINT `stock_receipt_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_receipt_items` ADD CONSTRAINT `stock_receipt_items_bin_id_warehouse_bins_id_fk` FOREIGN KEY (`bin_id`) REFERENCES `warehouse_bins`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouse_bins` ADD CONSTRAINT `warehouse_bins_location_id_warehouse_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `warehouse_locations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_order_items_order` ON `online_store_order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_order_items_product` ON `online_store_order_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_online_orders_customer` ON `online_store_orders` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_online_orders_status` ON `online_store_orders` (`status`);--> statement-breakpoint
CREATE INDEX `idx_online_orders_created` ON `online_store_orders` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_return_items_return` ON `online_store_return_items` (`return_id`);--> statement-breakpoint
CREATE INDEX `idx_returns_order` ON `online_store_returns` (`order_id`);--> statement-breakpoint
CREATE INDEX `idx_returns_customer` ON `online_store_returns` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_returns_status` ON `online_store_returns` (`status`);--> statement-breakpoint
CREATE INDEX `idx_payment_methods_customer` ON `payment_methods` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_pick_list_items_list` ON `pick_list_items` (`pick_list_id`);--> statement-breakpoint
CREATE INDEX `idx_pick_lists_status` ON `pick_lists` (`status`);--> statement-breakpoint
CREATE INDEX `idx_pick_lists_source` ON `pick_lists` (`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `idx_pos_transaction_items_txn` ON `pos_transaction_items` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_pos_transactions_session` ON `pos_transactions` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_pos_transactions_created` ON `pos_transactions` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_bin_assignments_product` ON `product_bin_assignments` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_bin_assignments_bin` ON `product_bin_assignments` (`bin_id`);--> statement-breakpoint
CREATE INDEX `idx_product_compat_product_id` ON `product_compatibility` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_product_compat_make_model` ON `product_compatibility` (`make`,`model`);--> statement-breakpoint
CREATE INDEX `idx_product_compat_year_range` ON `product_compatibility` (`year_start`,`year_end`);--> statement-breakpoint
CREATE INDEX `idx_product_images_product` ON `product_images` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_product_numbers_product_id` ON `product_numbers` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_product_numbers_part_number` ON `product_numbers` (`part_number`);--> statement-breakpoint
CREATE INDEX `idx_product_numbers_brand` ON `product_numbers` (`brand`);--> statement-breakpoint
CREATE INDEX `idx_products_category` ON `products` (`category`);--> statement-breakpoint
CREATE INDEX `idx_products_active_featured` ON `products` (`is_active`,`is_featured`);--> statement-breakpoint
CREATE INDEX `idx_refresh_tokens_customer` ON `refresh_tokens` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_cart_items_cart` ON `shopping_cart_items` (`cart_id`);--> statement-breakpoint
CREATE INDEX `idx_cart_customer` ON `shopping_carts` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_stock_movements_product` ON `stock_movements` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_stock_movements_type` ON `stock_movements` (`movement_type`);--> statement-breakpoint
CREATE INDEX `idx_stock_movements_created` ON `stock_movements` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_stock_movements_reference` ON `stock_movements` (`reference_type`,`reference_id`);--> statement-breakpoint
CREATE INDEX `idx_receipt_items_receipt` ON `stock_receipt_items` (`receipt_id`);--> statement-breakpoint
CREATE INDEX `idx_receipt_items_product` ON `stock_receipt_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `idx_sync_log_direction` ON `sync_log` (`direction`);--> statement-breakpoint
CREATE INDEX `idx_sync_log_status` ON `sync_log` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sync_log_created` ON `sync_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_sync_queue_status` ON `sync_queue` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sync_queue_next_retry` ON `sync_queue` (`next_retry_at`);--> statement-breakpoint
CREATE INDEX `idx_warehouse_bins_location` ON `warehouse_bins` (`location_id`);