ALTER TABLE `online_store_orders` ADD `pickup_code` varchar(8);--> statement-breakpoint
ALTER TABLE `online_store_orders` ADD `delivery_lat` decimal(10,7);--> statement-breakpoint
ALTER TABLE `online_store_orders` ADD `delivery_lng` decimal(10,7);--> statement-breakpoint
ALTER TABLE `online_store_orders` ADD CONSTRAINT `online_store_orders_pickup_code_unique` UNIQUE(`pickup_code`);