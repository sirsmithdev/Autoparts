/**
 * Parts-store schema — independent partsstore database.
 * This is the source of truth for all tables owned by the parts store service.
 */

import {
  mysqlTable,
  text,
  varchar,
  timestamp,
  int,
  decimal,
  boolean,
  mysqlEnum,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import { randomUUID } from "crypto";

// ==================== Enum Values ====================

export const authProviderValues = ["email", "google", "garage"] as const;
export const partConditionValues = ["new", "refurbished", "used"] as const;
export const partNumberTypeValues = ["oem", "aftermarket", "interchange"] as const;
export const onlineOrderStatusValues = [
  "pending_payment", "placed", "confirmed", "picking", "packed",
  "shipped", "out_for_delivery", "delivered", "cancelled", "refund_pending",
] as const;
export const deliveryMethodValues = ["local_delivery", "pickup"] as const;
export const returnStatusValues = [
  "requested", "approved", "rejected", "shipped_back",
  "received", "refunded", "exchanged", "closed",
] as const;
export const returnReasonValues = [
  "wrong_part", "defective", "not_needed", "wrong_fitment",
  "damaged_in_shipping", "other",
] as const;
export const returnResolutionValues = ["refund", "exchange", "store_credit"] as const;
export const stockMovementTypeValues = [
  "received", "sold_online", "sold_pos", "returned", "transferred",
  "adjusted_up", "adjusted_down", "damaged", "reserved", "unreserved",
] as const;
export const stockReceiptStatusValues = ["draft", "received", "cancelled"] as const;
export const pickListStatusValues = ["pending", "assigned", "in_progress", "completed", "cancelled"] as const;
export const pickListSourceTypeValues = ["online_order", "manual"] as const;
export const pickListItemStatusValues = ["pending", "picked", "short", "skipped"] as const;
export const posTransactionTypeValues = ["sale", "refund", "void"] as const;
export const posTransactionStatusValues = ["completed", "voided", "refunded"] as const;
export const posPaymentMethodValues = ["cash", "card", "saved_card", "split"] as const;
export const posSessionStatusValues = ["open", "closed"] as const;
export const paymentStatusValues = ["pending", "paid", "refunded", "voided"] as const;
export const syncDirectionValues = ["inbound", "outbound"] as const;
export const syncStatusValues = ["success", "failed", "queued"] as const;
export const syncQueueStatusValues = ["pending", "processing", "completed", "failed"] as const;
export const staffRoleValues = ["admin", "manager", "warehouse_staff", "cashier"] as const;
export const staffInviteStatusValues = ["pending", "accepted", "expired"] as const;

// ==================== Core Tables (6) ====================

export const customers = mysqlTable("customers", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  address: text("address"),
  parish: text("parish"),
  authProvider: mysqlEnum("auth_provider", authProviderValues).notNull().default("email"),
  googleId: varchar("google_id", { length: 255 }).unique(),
  garageUserId: varchar("garage_user_id", { length: 36 }).unique(),
  profileImageUrl: text("profile_image_url"),
  emailVerified: boolean("email_verified").notNull().default(false),
  storeCreditBalance: decimal("store_credit_balance", { precision: 10, scale: 2 }).notNull().default("0.00"),
  role: mysqlEnum("role", staffRoleValues),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const products = mysqlTable("products", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  garagePartId: varchar("garage_part_id", { length: 36 }).unique(),
  name: text("name").notNull(),
  partNumber: varchar("part_number", { length: 100 }).notNull().unique(),
  barcode: varchar("barcode", { length: 100 }).unique(),
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }).notNull(),
  quantity: int("quantity").notNull().default(0),
  lowStockThreshold: int("low_stock_threshold").notNull().default(10),
  description: text("description"),
  longDescription: text("long_description"),
  manufacturer: text("manufacturer"),
  category: varchar("category", { length: 100 }),
  imageUrl: text("image_url"),
  condition: mysqlEnum("condition", partConditionValues).notNull().default("new"),
  weight: decimal("weight", { precision: 8, scale: 2 }),
  isOversized: boolean("is_oversized").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  featuredSortOrder: int("featured_sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_products_category").on(table.category),
  index("idx_products_active_featured").on(table.isActive, table.isFeatured),
]);

export const productNumbers = mysqlTable("product_numbers", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  partNumber: varchar("part_number", { length: 100 }).notNull(),
  numberType: mysqlEnum("number_type", partNumberTypeValues).notNull(),
  brand: varchar("brand", { length: 100 }),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_product_numbers_product_id").on(table.productId),
  index("idx_product_numbers_part_number").on(table.partNumber),
  index("idx_product_numbers_brand").on(table.brand),
]);

export const productCompatibility = mysqlTable("product_compatibility", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  make: varchar("make", { length: 100 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  yearStart: int("year_start").notNull(),
  yearEnd: int("year_end").notNull(),
  trim: text("trim"),
  engineType: text("engine_type"),
  vin: varchar("vin", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_product_compat_product_id").on(table.productId),
  index("idx_product_compat_make_model").on(table.make, table.model),
  index("idx_product_compat_year_range").on(table.yearStart, table.yearEnd),
]);

export const productImages = mysqlTable("product_images", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  altText: text("alt_text"),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_product_images_product").on(table.productId),
]);

export const storeSettings = mysqlTable("store_settings", {
  id: int("id").primaryKey().default(1),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull().default("15.00"),
  taxName: text("tax_name").notNull().default("GCT"),
  currency: varchar("currency", { length: 3 }).notNull().default("JMD"),
  currencySymbol: text("currency_symbol").notNull().default("$"),
  returnWindowDays: int("return_window_days").notNull().default(14),
  defectiveReturnWindowDays: int("defective_return_window_days").notNull().default(30),
  restockingFeePercent: decimal("restocking_fee_percent", { precision: 5, scale: 2 }).notNull().default("15.00"),
  electricalPartsReturnPolicy: text("electrical_parts_return_policy"),
  maxQuantityPerItem: int("max_quantity_per_item").notNull().default(50),
  maxItemsPerOrder: int("max_items_per_order").notNull().default(200),
  cartExpirationDays: int("cart_expiration_days").notNull().default(30),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==================== E-Commerce Tables (7) ====================

export const shoppingCarts = mysqlTable("shopping_carts", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  customerId: varchar("customer_id", { length: 36 }).notNull().unique().references(() => customers.id, { onDelete: "cascade" }),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_cart_customer").on(table.customerId),
]);

export const shoppingCartItems = mysqlTable("shopping_cart_items", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  cartId: varchar("cart_id", { length: 36 }).notNull().references(() => shoppingCarts.id, { onDelete: "cascade" }),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  quantity: int("quantity").notNull().default(1),
  priceAtAddTime: decimal("price_at_add_time", { precision: 10, scale: 2 }).notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (table) => [
  index("idx_cart_items_cart").on(table.cartId),
  uniqueIndex("idx_cart_items_unique").on(table.cartId, table.productId),
]);

export const deliveryZones = mysqlTable("delivery_zones", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  name: varchar("name", { length: 100 }).notNull(),
  parishes: json("parishes").notNull(),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).notNull(),
  oversizedSurcharge: decimal("oversized_surcharge", { precision: 10, scale: 2 }).notNull().default("0.00"),
  estimatedDays: int("estimated_days").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const onlineStoreOrders = mysqlTable("online_store_orders", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
  customerId: varchar("customer_id", { length: 36 }).notNull().references(() => customers.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", onlineOrderStatusValues).notNull().default("pending_payment"),
  deliveryMethod: mysqlEnum("delivery_method", deliveryMethodValues).notNull(),
  deliveryZoneId: varchar("delivery_zone_id", { length: 36 }).references(() => deliveryZones.id, { onDelete: "set null" }),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).notNull().default("0.00"),
  deliveryAddress: text("delivery_address"),
  deliveryParish: varchar("delivery_parish", { length: 100 }),
  deliveryNotes: text("delivery_notes"),
  estimatedDeliveryDate: timestamp("estimated_delivery_date"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0.00"),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0.00"),
  paymentTransactionId: varchar("payment_transaction_id", { length: 36 }),
  paymentStatus: mysqlEnum("payment_status", paymentStatusValues).default("pending"),
  pickListId: varchar("pick_list_id", { length: 36 }),
  trackingNumber: text("tracking_number"),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  staffNotes: text("staff_notes"),
  placedAt: timestamp("placed_at"),
  confirmedAt: timestamp("confirmed_at"),
  packedAt: timestamp("packed_at"),
  packedBy: varchar("packed_by", { length: 36 }),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
  pickupReadyAt: timestamp("pickup_ready_at"),
  pickupCode: varchar("pickup_code", { length: 8 }).unique(),
  deliveryLat: decimal("delivery_lat", { precision: 10, scale: 7 }),
  deliveryLng: decimal("delivery_lng", { precision: 10, scale: 7 }),
  pickedUpAt: timestamp("picked_up_at"),
  pickedUpBy: text("picked_up_by"),
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: varchar("cancelled_by", { length: 36 }),
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_online_orders_customer").on(table.customerId),
  index("idx_online_orders_status").on(table.status),
  index("idx_online_orders_created").on(table.createdAt),
]);

export const onlineStoreOrderItems = mysqlTable("online_store_order_items", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  orderId: varchar("order_id", { length: 36 }).notNull().references(() => onlineStoreOrders.id, { onDelete: "cascade" }),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "restrict" }),
  productName: text("product_name").notNull(),
  productNumber: varchar("product_number", { length: 100 }).notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_order_items_order").on(table.orderId),
  index("idx_order_items_product").on(table.productId),
]);

export const onlineStoreReturns = mysqlTable("online_store_returns", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  returnNumber: varchar("return_number", { length: 50 }).notNull().unique(),
  orderId: varchar("order_id", { length: 36 }).notNull().references(() => onlineStoreOrders.id, { onDelete: "cascade" }),
  customerId: varchar("customer_id", { length: 36 }).notNull().references(() => customers.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", returnStatusValues).notNull().default("requested"),
  reason: mysqlEnum("reason", returnReasonValues).notNull(),
  reasonDetails: text("reason_details"),
  resolution: mysqlEnum("resolution", returnResolutionValues),
  refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }),
  restockingFee: decimal("restocking_fee", { precision: 10, scale: 2 }),
  returnShippingPaidBy: varchar("return_shipping_paid_by", { length: 20 }),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by", { length: 36 }),
  rejectedAt: timestamp("rejected_at"),
  rejectedBy: varchar("rejected_by", { length: 36 }),
  rejectionReason: text("rejection_reason"),
  shippedBackAt: timestamp("shipped_back_at"),
  shippedBackTrackingNumber: text("shipped_back_tracking_number"),
  receivedAt: timestamp("received_at"),
  receivedBy: varchar("received_by", { length: 36 }),
  closedAt: timestamp("closed_at"),
  staffNotes: text("staff_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_returns_order").on(table.orderId),
  index("idx_returns_customer").on(table.customerId),
  index("idx_returns_status").on(table.status),
]);

export const onlineStoreReturnItems = mysqlTable("online_store_return_items", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  returnId: varchar("return_id", { length: 36 }).notNull().references(() => onlineStoreReturns.id, { onDelete: "cascade" }),
  orderItemId: varchar("order_item_id", { length: 36 }).notNull().references(() => onlineStoreOrderItems.id, { onDelete: "cascade" }),
  quantity: int("quantity").notNull(),
  reason: text("reason"),
  conditionOnReturn: text("condition_on_return"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_return_items_return").on(table.returnId),
]);

// ==================== Payment Table (1) ====================

export const paymentMethods = mysqlTable("payment_methods", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  customerId: varchar("customer_id", { length: 36 }).notNull().references(() => customers.id, { onDelete: "cascade" }),
  panToken: varchar("pan_token", { length: 255 }),
  cardBrand: varchar("card_brand", { length: 20 }),
  maskedPan: varchar("masked_pan", { length: 20 }),
  cardholderName: text("cardholder_name"),
  expiryMonth: int("expiry_month"),
  expiryYear: int("expiry_year"),
  isDefault: boolean("is_default").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_payment_methods_customer").on(table.customerId),
]);

// ==================== Auth Table (1) ====================

export const refreshTokens = mysqlTable("refresh_tokens", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  customerId: varchar("customer_id", { length: 36 }).notNull().references(() => customers.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_refresh_tokens_customer").on(table.customerId),
]);

// ==================== Warehouse Tables (6) ====================

export const warehouseLocations = mysqlTable("warehouse_locations", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const warehouseBins = mysqlTable("warehouse_bins", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  locationId: varchar("location_id", { length: 36 }).notNull().references(() => warehouseLocations.id, { onDelete: "cascade" }),
  binCode: varchar("bin_code", { length: 50 }).notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_warehouse_bins_location").on(table.locationId),
]);

export const productBinAssignments = mysqlTable("product_bin_assignments", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  binId: varchar("bin_id", { length: 36 }).notNull().references(() => warehouseBins.id, { onDelete: "cascade" }),
  quantity: int("quantity").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_bin_assignments_product").on(table.productId),
  index("idx_bin_assignments_bin").on(table.binId),
  uniqueIndex("idx_bin_assignments_unique").on(table.productId, table.binId),
]);

export const stockMovements = mysqlTable("stock_movements", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  binId: varchar("bin_id", { length: 36 }).references(() => warehouseBins.id, { onDelete: "set null" }),
  movementType: mysqlEnum("movement_type", stockMovementTypeValues).notNull(),
  quantity: int("quantity").notNull(),
  referenceType: varchar("reference_type", { length: 50 }),
  referenceId: varchar("reference_id", { length: 36 }),
  notes: text("notes"),
  performedBy: varchar("performed_by", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_stock_movements_product").on(table.productId),
  index("idx_stock_movements_type").on(table.movementType),
  index("idx_stock_movements_created").on(table.createdAt),
  index("idx_stock_movements_reference").on(table.referenceType, table.referenceId),
]);

export const productActivityLog = mysqlTable("product_activity_log", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 50 }).notNull(),
  details: json("details"),
  performedBy: varchar("performed_by", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_product_activity_product").on(table.productId),
  index("idx_product_activity_created").on(table.createdAt),
]);

export const stockReceipts = mysqlTable("stock_receipts", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  receiptNumber: varchar("receipt_number", { length: 50 }).notNull().unique(),
  supplierId: varchar("supplier_id", { length: 36 }),
  status: mysqlEnum("status", stockReceiptStatusValues).notNull().default("draft"),
  receivedBy: varchar("received_by", { length: 36 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stockReceiptItems = mysqlTable("stock_receipt_items", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  receiptId: varchar("receipt_id", { length: 36 }).notNull().references(() => stockReceipts.id, { onDelete: "cascade" }),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  binId: varchar("bin_id", { length: 36 }).notNull().references(() => warehouseBins.id, { onDelete: "cascade" }),
  quantity: int("quantity").notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_receipt_items_receipt").on(table.receiptId),
  index("idx_receipt_items_product").on(table.productId),
]);

// ==================== Pick List Tables (2) ====================

export const pickLists = mysqlTable("pick_lists", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  pickListNumber: varchar("pick_list_number", { length: 50 }).notNull().unique(),
  sourceType: mysqlEnum("source_type", pickListSourceTypeValues).notNull(),
  sourceId: varchar("source_id", { length: 36 }).notNull(),
  status: mysqlEnum("status", pickListStatusValues).notNull().default("pending"),
  assignedTo: varchar("assigned_to", { length: 36 }),
  assignedAt: timestamp("assigned_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdBy: varchar("created_by", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pick_lists_status").on(table.status),
  index("idx_pick_lists_source").on(table.sourceType, table.sourceId),
]);

export const pickListItems = mysqlTable("pick_list_items", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  pickListId: varchar("pick_list_id", { length: 36 }).notNull().references(() => pickLists.id, { onDelete: "cascade" }),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  binId: varchar("bin_id", { length: 36 }).notNull().references(() => warehouseBins.id, { onDelete: "cascade" }),
  quantityRequired: int("quantity_required").notNull(),
  quantityPicked: int("quantity_picked").notNull().default(0),
  status: mysqlEnum("status", pickListItemStatusValues).notNull().default("pending"),
  pickedAt: timestamp("picked_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pick_list_items_list").on(table.pickListId),
]);

// ==================== POS Tables (4) ====================

export const posSessions = mysqlTable("pos_sessions", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  sessionNumber: varchar("session_number", { length: 50 }).notNull().unique(),
  openedBy: varchar("opened_by", { length: 36 }).notNull(),
  closedBy: varchar("closed_by", { length: 36 }),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  openingCash: decimal("opening_cash", { precision: 10, scale: 2 }).notNull(),
  closingCash: decimal("closing_cash", { precision: 10, scale: 2 }),
  expectedCash: decimal("expected_cash", { precision: 10, scale: 2 }),
  cashDifference: decimal("cash_difference", { precision: 10, scale: 2 }),
  status: mysqlEnum("status", posSessionStatusValues).notNull().default("open"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const posTransactions = mysqlTable("pos_transactions", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  transactionNumber: varchar("transaction_number", { length: 50 }).notNull().unique(),
  sessionId: varchar("session_id", { length: 36 }).notNull().references(() => posSessions.id, { onDelete: "cascade" }),
  customerId: varchar("customer_id", { length: 36 }).references(() => customers.id, { onDelete: "set null" }),
  type: mysqlEnum("type", posTransactionTypeValues).notNull(),
  status: mysqlEnum("status", posTransactionStatusValues).notNull().default("completed"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull(),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: mysqlEnum("payment_method", posPaymentMethodValues).notNull(),
  cashReceived: decimal("cash_received", { precision: 10, scale: 2 }),
  changeGiven: decimal("change_given", { precision: 10, scale: 2 }),
  cardTransactionId: varchar("card_transaction_id", { length: 100 }),
  processedBy: varchar("processed_by", { length: 36 }).notNull(),
  voidedBy: varchar("voided_by", { length: 36 }),
  voidReason: text("void_reason"),
  originalTransactionId: varchar("original_transaction_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pos_transactions_session").on(table.sessionId),
  index("idx_pos_transactions_created").on(table.createdAt),
]);

export const posTransactionItems = mysqlTable("pos_transaction_items", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  transactionId: varchar("transaction_id", { length: 36 }).notNull().references(() => posTransactions.id, { onDelete: "cascade" }),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  productNumber: varchar("product_number", { length: 100 }).notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).notNull().default("0.00"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pos_transaction_items_txn").on(table.transactionId),
]);

export const posHeldCarts = mysqlTable("pos_held_carts", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  name: varchar("name", { length: 100 }).notNull(),
  items: json("items").notNull(),
  heldBy: varchar("held_by", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==================== Sequence Tables (6) ====================

export const onlineOrderNumberSequence = mysqlTable("online_order_number_sequence", {
  year: int("year").primaryKey(),
  lastNumber: int("last_number").notNull().default(0),
});

export const onlineReturnNumberSequence = mysqlTable("online_return_number_sequence", {
  year: int("year").primaryKey(),
  lastNumber: int("last_number").notNull().default(0),
});

export const pickListNumberSequence = mysqlTable("pick_list_number_sequence", {
  year: int("year").primaryKey(),
  lastNumber: int("last_number").notNull().default(0),
});

export const posTransactionNumberSequence = mysqlTable("pos_transaction_number_sequence", {
  year: int("year").primaryKey(),
  lastNumber: int("last_number").notNull().default(0),
});

export const posSessionNumberSequence = mysqlTable("pos_session_number_sequence", {
  year: int("year").primaryKey(),
  lastNumber: int("last_number").notNull().default(0),
});

export const stockReceiptNumberSequence = mysqlTable("stock_receipt_number_sequence", {
  year: int("year").primaryKey(),
  lastNumber: int("last_number").notNull().default(0),
});

// ==================== Operational Tables (2) ====================

export const syncLog = mysqlTable("sync_log", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  direction: mysqlEnum("direction", syncDirectionValues).notNull(),
  entity: varchar("entity", { length: 50 }).notNull(),
  payload: json("payload"),
  status: mysqlEnum("status", syncStatusValues).notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_sync_log_direction").on(table.direction),
  index("idx_sync_log_status").on(table.status),
  index("idx_sync_log_created").on(table.createdAt),
]);

export const syncQueue = mysqlTable("sync_queue", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  payload: json("payload"),
  attempts: int("attempts").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  nextRetryAt: timestamp("next_retry_at"),
  status: mysqlEnum("status", syncQueueStatusValues).notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_sync_queue_status").on(table.status),
  index("idx_sync_queue_next_retry").on(table.nextRetryAt),
]);

// ==================== Customer Feature Tables (2) ====================

export const savedVehicles = mysqlTable("saved_vehicles", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  customerId: varchar("customer_id", { length: 36 }).notNull().references(() => customers.id, { onDelete: "cascade" }),
  make: varchar("make", { length: 100 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  year: int("year").notNull(),
  nickname: text("nickname"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_saved_vehicles_customer").on(table.customerId),
]);

export const wishlists = mysqlTable("wishlists", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  customerId: varchar("customer_id", { length: 36 }).notNull().references(() => customers.id, { onDelete: "cascade" }),
  productId: varchar("product_id", { length: 36 }).notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_wishlists_customer").on(table.customerId),
  uniqueIndex("idx_wishlists_customer_product").on(table.customerId, table.productId),
]);

// ==================== Type Exports ====================

// Core
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;
export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;
export type ProductNumber = typeof productNumbers.$inferSelect;
export type InsertProductNumber = typeof productNumbers.$inferInsert;
export type ProductCompatibility = typeof productCompatibility.$inferSelect;
export type InsertProductCompatibility = typeof productCompatibility.$inferInsert;
export type ProductImage = typeof productImages.$inferSelect;
export type InsertProductImage = typeof productImages.$inferInsert;
export type StoreSettings = typeof storeSettings.$inferSelect;
export type InsertStoreSettings = typeof storeSettings.$inferInsert;

// E-Commerce
export type ShoppingCart = typeof shoppingCarts.$inferSelect;
export type InsertShoppingCart = typeof shoppingCarts.$inferInsert;
export type ShoppingCartItem = typeof shoppingCartItems.$inferSelect;
export type InsertShoppingCartItem = typeof shoppingCartItems.$inferInsert;
export type DeliveryZone = typeof deliveryZones.$inferSelect;
export type InsertDeliveryZone = typeof deliveryZones.$inferInsert;
export type OnlineStoreOrder = typeof onlineStoreOrders.$inferSelect;
export type InsertOnlineStoreOrder = typeof onlineStoreOrders.$inferInsert;
export type OnlineStoreOrderItem = typeof onlineStoreOrderItems.$inferSelect;
export type InsertOnlineStoreOrderItem = typeof onlineStoreOrderItems.$inferInsert;
export type OnlineStoreReturn = typeof onlineStoreReturns.$inferSelect;
export type InsertOnlineStoreReturn = typeof onlineStoreReturns.$inferInsert;
export type OnlineStoreReturnItem = typeof onlineStoreReturnItems.$inferSelect;
export type InsertOnlineStoreReturnItem = typeof onlineStoreReturnItems.$inferInsert;

// Payment
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;

// Auth
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = typeof refreshTokens.$inferInsert;

// Warehouse
export type WarehouseLocation = typeof warehouseLocations.$inferSelect;
export type InsertWarehouseLocation = typeof warehouseLocations.$inferInsert;
export type WarehouseBin = typeof warehouseBins.$inferSelect;
export type InsertWarehouseBin = typeof warehouseBins.$inferInsert;
export type ProductBinAssignment = typeof productBinAssignments.$inferSelect;
export type InsertProductBinAssignment = typeof productBinAssignments.$inferInsert;
export type StockMovement = typeof stockMovements.$inferSelect;
export type InsertStockMovement = typeof stockMovements.$inferInsert;
export type StockReceipt = typeof stockReceipts.$inferSelect;
export type InsertStockReceipt = typeof stockReceipts.$inferInsert;
export type StockReceiptItem = typeof stockReceiptItems.$inferSelect;
export type InsertStockReceiptItem = typeof stockReceiptItems.$inferInsert;

// Pick Lists
export type PickList = typeof pickLists.$inferSelect;
export type InsertPickList = typeof pickLists.$inferInsert;
export type PickListItem = typeof pickListItems.$inferSelect;
export type InsertPickListItem = typeof pickListItems.$inferInsert;

// POS
export type PosSession = typeof posSessions.$inferSelect;
export type InsertPosSession = typeof posSessions.$inferInsert;
export type PosTransaction = typeof posTransactions.$inferSelect;
export type InsertPosTransaction = typeof posTransactions.$inferInsert;
export type PosTransactionItem = typeof posTransactionItems.$inferSelect;
export type InsertPosTransactionItem = typeof posTransactionItems.$inferInsert;
export type PosHeldCart = typeof posHeldCarts.$inferSelect;
export type InsertPosHeldCart = typeof posHeldCarts.$inferInsert;

// Sequences
export type OnlineOrderNumberSequence = typeof onlineOrderNumberSequence.$inferSelect;
export type OnlineReturnNumberSequence = typeof onlineReturnNumberSequence.$inferSelect;
export type PickListNumberSequence = typeof pickListNumberSequence.$inferSelect;
export type PosTransactionNumberSequence = typeof posTransactionNumberSequence.$inferSelect;
export type PosSessionNumberSequence = typeof posSessionNumberSequence.$inferSelect;
export type StockReceiptNumberSequence = typeof stockReceiptNumberSequence.$inferSelect;

// Operational
export type SyncLog = typeof syncLog.$inferSelect;
export type InsertSyncLog = typeof syncLog.$inferInsert;
export type SyncQueue = typeof syncQueue.$inferSelect;
export type InsertSyncQueue = typeof syncQueue.$inferInsert;

// Customer Features
export type SavedVehicle = typeof savedVehicles.$inferSelect;
export type InsertSavedVehicle = typeof savedVehicles.$inferInsert;
export type Wishlist = typeof wishlists.$inferSelect;
export type InsertWishlist = typeof wishlists.$inferInsert;

// ==================== Staff Activity & Invites ====================

export const staffActivityLog = mysqlTable("staff_activity_log", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  staffId: varchar("staff_id", { length: 36 }).notNull().references(() => customers.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 100 }).notNull(),
  entity: varchar("entity", { length: 50 }),
  entityId: varchar("entity_id", { length: 36 }),
  details: json("details"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_staff_activity_staff").on(table.staffId),
  index("idx_staff_activity_action").on(table.action),
  index("idx_staff_activity_entity").on(table.entity, table.entityId),
  index("idx_staff_activity_created").on(table.createdAt),
]);

export const staffInvites = mysqlTable("staff_invites", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID()),
  email: varchar("email", { length: 255 }).notNull(),
  role: mysqlEnum("role", staffRoleValues).notNull(),
  invitedBy: varchar("invited_by", { length: 36 }).notNull().references(() => customers.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", staffInviteStatusValues).notNull().default("pending"),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_staff_invites_email").on(table.email),
  index("idx_staff_invites_token").on(table.token),
]);

export type StaffActivityLog = typeof staffActivityLog.$inferSelect;
export type StaffInvite = typeof staffInvites.$inferSelect;
