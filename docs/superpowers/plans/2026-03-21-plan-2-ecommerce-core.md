# Plan 2: E-Commerce Core — Catalog, Cart, Checkout & Orders

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the customer-facing e-commerce flow working against the new independent `partsstore` database — browsing products, adding to cart, placing orders, and viewing order history.

**Architecture:** Rebuild existing storage and route modules by updating table references (`partsInventory` → `products`, `users` → `customers`, `partId` → `productId`) and auth patterns (`req.jwtUser` → `req.customer`). No new modules — this is a refactoring plan that makes existing code work with the Plan 1 foundation.

**Tech Stack:** Drizzle ORM (mysql2), Express, Zod (validation)

**Depends on:** Plan 1 (schema, auth, middleware, sync infrastructure)

**Spec:** `docs/superpowers/specs/2026-03-20-parts-store-separation-design.md`
**API Reference:** `docs/api-reference.md`

---

## Plan Roadmap

| Plan | Name | Status |
|------|------|--------|
| 1 | Foundation: Schema, Auth & Sync | **Complete** |
| **2** | **E-Commerce Core: Catalog, Cart, Checkout, Orders** | **This plan** |
| 3 | Payment Integration: PowerTranz, NCB, Saved Cards | Pending |
| 4 | Order Fulfillment & Returns | Pending |
| 5 | Warehouse & Pick Lists | Pending |
| 6 | POS System | Pending |
| 7 | Email Notifications & Frontend Pages | Pending |

---

## File Structure

### Files to Rewrite (exist but broken)

| File | Lines | Reuse % | Key Changes |
|------|-------|---------|-------------|
| `server/storage/catalog.ts` | 224 | 90% | `partsInventory` → `products`, `partNumbers` → `productNumbers`, `vehicleCompatibility` → `productCompatibility`, `partImages` → `productImages`, remove `isPublishedOnline` checks (use `isActive` instead) |
| `server/storage/onlineStore.ts` | 700+ | Split | Split into focused modules: `cart.ts`, `orders.ts`, `settings.ts`. Fix table refs, auth patterns, add sync queue enqueuing |
| `server/routes/catalog.routes.ts` | 159 | 95% | Update imports from catalog storage, fix `optionalAuth` import |
| `server/routes/cart.routes.ts` | 83 | 90% | `req.jwtUser!.userId` → `req.customer!.customerId`, `isAuthenticated` → `authenticateToken` |
| `server/routes/checkout.routes.ts` | 101 | 60% | Auth fix, `pricingSettings` → `storeSettings`, add sync queue after order creation |
| `server/routes/orders.routes.ts` | 51 | 90% | Auth fix, add sync queue on cancel |
| `server/routes/admin.routes.ts` | 250+ | 70% | `requireStaff`/`requireRole` → `requireAdmin`, fix imports |
| `server/routes/index.ts` | 22 | — | Re-enable all route modules |

### New Files

| File | Responsibility |
|------|---------------|
| `server/storage/cart.ts` | Cart operations extracted from onlineStore.ts |
| `server/storage/orders.ts` | Order lifecycle extracted from onlineStore.ts |
| `server/storage/settings.ts` | Store settings + delivery zones extracted from onlineStore.ts |

---

## Task 1: Rebuild Catalog Storage

**Files:**
- Rewrite: `server/storage/catalog.ts`

This is the read-only product catalog module. 90% reusable — just table/column name changes.

- [ ] **Step 1: Read the current catalog.ts and the new schema**

Read `/Users/daney/316-parts-store/server/storage/catalog.ts` to see all existing functions.
Read `/Users/daney/316-parts-store/server/schema.ts` to find the exact table exports: `products`, `productNumbers`, `productCompatibility`, `productImages`.

- [ ] **Step 2: Update all imports and table references**

Replace imports:
```typescript
// OLD
import { partsInventory, partNumbers, vehicleCompatibility, partImages, ... } from "../schema.js";
// NEW
import { products, productNumbers, productCompatibility, productImages, ... } from "../schema.js";
```

Search and replace through all functions:
- `partsInventory` → `products`
- `partNumbers` → `productNumbers`
- `vehicleCompatibility` → `productCompatibility`
- `partImages` → `productImages`
- `.partId` → `.productId` (for FK fields in child tables)
- `isPublishedOnline` checks → replace with `isActive` (e.g., `eq(products.isActive, true)`)

- [ ] **Step 3: Update searchStoreCatalog function**

The main search function needs these specific changes:
- Remove any `eq(partsInventory.isPublishedOnline, true)` → `eq(products.isActive, true)`
- The `purchasePrice` field no longer exists in `products` — remove from any SELECT or ensure it's not referenced
- Update ordering to use `products.salePrice`, `products.name`, `products.createdAt`

- [ ] **Step 4: Verify TypeScript compiles for this file**

```bash
cd /Users/daney/316-parts-store && npx tsc --noEmit --project tsconfig.json 2>&1 | grep "storage/catalog" | head -10
```

Expected: Zero errors in catalog.ts.

- [ ] **Step 5: Commit**

```bash
cd /Users/daney/316-parts-store
git add server/storage/catalog.ts
git commit -m "refactor: update catalog storage for independent products table"
```

---

## Task 2: Extract and Rebuild Settings Storage

**Files:**
- Create: `server/storage/settings.ts`

Extract store settings and delivery zone operations from onlineStore.ts into a focused module.

- [ ] **Step 1: Read onlineStore.ts to find settings/zones functions**

Read `/Users/daney/316-parts-store/server/storage/onlineStore.ts` and identify all settings and delivery zone functions.

- [ ] **Step 2: Create server/storage/settings.ts**

Extract these functions with updated table references:

```typescript
import { db } from "../db.js";
import { storeSettings, deliveryZones } from "../schema.js";
import { eq, and } from "drizzle-orm";
import type { StoreSettings, DeliveryZone, InsertDeliveryZone } from "../schema.js";

// ─── Store Settings (singleton, id=1) ─────────────────────

export async function getStoreSettings(): Promise<StoreSettings | null>
// SELECT FROM storeSettings WHERE id=1 LIMIT 1
// Note: old code used onlineStoreSettings — update to storeSettings

export async function updateStoreSettings(data: Partial<StoreSettings>): Promise<void>
// UPDATE storeSettings SET ...data, updatedAt=new Date() WHERE id=1

// ─── Delivery Zones ───────────────────────────────────────

export async function getActiveDeliveryZones(): Promise<DeliveryZone[]>
// SELECT FROM deliveryZones WHERE isActive=true ORDER BY sortOrder

export async function getAllDeliveryZones(): Promise<DeliveryZone[]>
// SELECT FROM deliveryZones ORDER BY sortOrder

export async function getDeliveryZone(id: string): Promise<DeliveryZone | null>

export async function createDeliveryZone(data: InsertDeliveryZone): Promise<DeliveryZone>

export async function updateDeliveryZone(id: string, data: Partial<DeliveryZone>): Promise<void>

export async function deleteDeliveryZone(id: string): Promise<void>

export async function getDeliveryFeeForParish(parish: string, hasOversizedItems: boolean): Promise<{
  zoneId: string;
  zoneName: string;
  deliveryFee: string;
  oversizedSurcharge: string;
  estimatedDays: number;
} | null>
// Find active zone where parishes JSON array contains the given parish
// If hasOversizedItems, include oversized surcharge
```

Copy the implementation logic from onlineStore.ts but update table names: `onlineStoreSettings` → `storeSettings`.

- [ ] **Step 3: Verify it compiles**

```bash
cd /Users/daney/316-parts-store && npx tsc --noEmit --project tsconfig.json 2>&1 | grep "storage/settings" | head -5
```

- [ ] **Step 4: Commit**

```bash
cd /Users/daney/316-parts-store
git add server/storage/settings.ts
git commit -m "refactor: extract settings and delivery zone storage from onlineStore"
```

---

## Task 3: Extract and Rebuild Cart Storage

**Files:**
- Create: `server/storage/cart.ts`

- [ ] **Step 1: Read onlineStore.ts cart functions**

Read `/Users/daney/316-parts-store/server/storage/onlineStore.ts` and identify all cart functions.

- [ ] **Step 2: Create server/storage/cart.ts**

Extract cart functions with updated references:

```typescript
import { db } from "../db.js";
import { shoppingCarts, shoppingCartItems, products, productImages, storeSettings } from "../schema.js";
import { eq, and, sql } from "drizzle-orm";

// getOrCreateCart(customerId) — upsert cart, update lastActivityAt
// getCartWithItems(customerId) — cart + items with live product data, stock status, price change detection
// addCartItem(customerId, productId, quantity) — validate: product active, in stock, qty limits
// updateCartItemQuantity(customerId, itemId, quantity) — revalidate stock
// removeCartItem(customerId, itemId)
// clearCart(customerId)
// mergeGuestCart(customerId, items[]) — union strategy (higher qty wins)
// cleanupStaleCarts() — delete carts older than cartExpirationDays
```

Key changes from old code:
- `partsInventory` → `products`
- `partImages` → `productImages`
- `shoppingCartItems.partId` → `shoppingCartItems.productId`
- `partsInventory.isPublishedOnline` check → `products.isActive` check
- Read `maxQuantityPerItem` and `maxItemsPerOrder` from `storeSettings` table
- Stock status calculation: `quantity <= 0` = "out_of_stock", `quantity <= lowStockThreshold` = "low_stock", else "in_stock"

- [ ] **Step 3: Verify it compiles**

- [ ] **Step 4: Commit**

```bash
cd /Users/daney/316-parts-store
git add server/storage/cart.ts
git commit -m "refactor: extract cart storage with updated product table references"
```

---

## Task 4: Extract and Rebuild Orders Storage

**Files:**
- Create: `server/storage/orders.ts`

This is the largest extraction — order creation, state transitions, cancellation, and cron cleanup.

- [ ] **Step 1: Read onlineStore.ts order functions**

Read the order-related functions in onlineStore.ts.

- [ ] **Step 2: Also read the sync helpers**

Read `/Users/daney/316-parts-store/server/sync/stockSync.ts` to understand how to enqueue stock sync events.

- [ ] **Step 3: Create server/storage/orders.ts**

Extract and update order functions:

```typescript
import { db } from "../db.js";
import {
  onlineStoreOrders, onlineStoreOrderItems, products,
  shoppingCarts, shoppingCartItems, storeSettings,
  deliveryZones, onlineOrderNumberSequence, customers
} from "../schema.js";
import { eq, and, sql, lt, desc } from "drizzle-orm";
import { enqueueStockDecrement, enqueueStockRestore } from "../sync/stockSync.js";
import crypto from "crypto";

// ─── Number Generation ────────────────────────────────────
export async function generateOrderNumber(): Promise<string>
// Atomic increment on onlineOrderNumberSequence, returns "ORD-YYYY-NNNN"

// ─── Order Creation ───────────────────────────────────────
export async function createPendingOrder(params: {
  customerId: string;
  deliveryMethod: "local_delivery" | "pickup";
  deliveryZoneId?: string;
  deliveryAddress?: string;
  deliveryParish?: string;
  deliveryNotes?: string;
}): Promise<OrderWithItems>
// 1. Get customer from customers table (snapshot name/email/phone)
// 2. Get cart items + validate stock (products.quantity >= item.quantity)
// 3. Get storeSettings for taxRate
// 4. Get delivery fee from deliveryZones (if delivery)
// 5. In transaction:
//    a. Generate order number
//    b. Decrement products.quantity atomically: UPDATE products SET quantity = quantity - ? WHERE id = ? AND quantity >= ?
//    c. Insert order with status "pending_payment"
//    d. Insert order items (snapshot prices from products.salePrice)
//    e. Clear cart
// 6. Enqueue stock decrement sync for each item (via enqueueStockDecrement)
// 7. Return order with items

// ─── Payment Confirmation ─────────────────────────────────
export async function confirmOrderPayment(orderId: string, paymentTransactionId: string): Promise<void>
// UPDATE: status → "placed", paymentStatus → "paid", paymentTransactionId, placedAt = now

// ─── Customer Queries ─────────────────────────────────────
export async function getOrder(orderId: string): Promise<OrderWithItems | null>
export async function getOrderByNumber(orderNumber: string): Promise<OrderWithItems | null>
export async function getOrdersByCustomer(customerId: string, page: number, limit: number): Promise<{ orders: OrderSummary[]; total: number }>
export async function getAllOrders(filters: OrderFilters): Promise<{ orders: OrderSummary[]; total: number }>

// ─── Cancellation ─────────────────────────────────────────
export async function cancelOrder(orderId: string, reason: string, cancelledBy?: string): Promise<void>
// 1. Validate: only from placed/confirmed/picking (staff) or placed (customer)
// 2. In transaction: restore products.quantity for each item
// 3. Update order: status → "cancelled", cancelledAt, cancelledBy, cancellationReason
// 4. Enqueue stock restore sync (via enqueueStockRestore)

// ─── Fulfillment State Transitions ────────────────────────
export async function confirmOrder(orderId: string): Promise<void>
// placed → confirmed, set confirmedAt

export async function markOrderPicking(orderId: string): Promise<void>
// confirmed → picking

export async function markOrderPacked(orderId: string, packedBy?: string): Promise<void>
// picking → packed, set packedAt, packedBy

export async function markOrderShipped(orderId: string, trackingNumber: string): Promise<void>
// packed → shipped, set shippedAt, trackingNumber

export async function markOrderOutForDelivery(orderId: string): Promise<void>
// shipped → out_for_delivery

export async function markOrderDelivered(orderId: string): Promise<void>
// → delivered, set deliveredAt

export async function markOrderReadyForPickup(orderId: string): Promise<void>
// set pickupReadyAt

export async function markOrderPickedUp(orderId: string, pickedUpBy: string): Promise<void>
// → delivered, set pickedUpAt, pickedUpBy

export async function updateOrderNotes(orderId: string, notes: string): Promise<void>

// ─── Cron Cleanup ─────────────────────────────────────────
export async function cleanupExpiredPendingOrders(): Promise<number>
// Cancel pending_payment orders older than 30 min, restore stock, enqueue sync
```

**Critical**: The `createPendingOrder` function must:
1. Use `customers` table (not `users`) for customer snapshot
2. Use `products` table (not `partsInventory`) for stock/price
3. Use `shoppingCartItems.productId` (not `partId`)
4. Call `enqueueStockDecrement` after order creation
5. Call `enqueueStockRestore` in `cancelOrder` and `cleanupExpiredPendingOrders`

- [ ] **Step 4: Verify it compiles**

- [ ] **Step 5: Commit**

```bash
cd /Users/daney/316-parts-store
git add server/storage/orders.ts
git commit -m "refactor: extract order storage with sync queue integration"
```

---

## Task 5: Update Catalog Routes

**Files:**
- Rewrite: `server/routes/catalog.routes.ts`

- [ ] **Step 1: Read current catalog routes**

Read `/Users/daney/316-parts-store/server/routes/catalog.routes.ts`.

- [ ] **Step 2: Update imports and references**

Changes needed:
- Import `optionalAuth` from `"../middleware.js"` (already exists in new middleware)
- Import catalog functions from `"../storage/catalog.js"` (updated module)
- Import settings functions from `"../storage/settings.js"` (new module)
- Update `toPublicPart()` helper:
  - Remove `purchasePrice` from destructured fields (doesn't exist on products)
  - Remove `lowStockThreshold` from response (keep for stock status calculation but don't expose)
  - Stock status logic: `quantity <= 0 ? "out_of_stock" : quantity <= lowStockThreshold ? "low_stock" : "in_stock"`
- `GET /api/store/settings/public` — read from `storeSettings` (merged table), return: taxRate, taxName, currency, currencySymbol, returnWindowDays, defectiveReturnWindowDays, maxQuantityPerItem, maxItemsPerOrder
- `GET /api/store/delivery-zones` — import from settings storage

- [ ] **Step 3: Verify it compiles**

- [ ] **Step 4: Commit**

```bash
cd /Users/daney/316-parts-store
git add server/routes/catalog.routes.ts
git commit -m "refactor: update catalog routes for independent products table"
```

---

## Task 6: Update Cart Routes

**Files:**
- Rewrite: `server/routes/cart.routes.ts`

- [ ] **Step 1: Read current cart routes**

- [ ] **Step 2: Update auth and imports**

Changes:
- `import { isAuthenticated } from "../middleware.js"` → `import { authenticateToken } from "../middleware.js"`
- `import * as store from "../storage/onlineStore.js"` → `import * as cart from "../storage/cart.js"`
- Replace all `isAuthenticated` middleware → `authenticateToken`
- Replace all `req.jwtUser!.userId` → `req.customer!.customerId`
- In merge endpoint: `partId` → `productId` in request body validation
- Update function calls: `store.addCartItem` → `cart.addCartItem`, etc.

- [ ] **Step 3: Verify it compiles**

- [ ] **Step 4: Commit**

```bash
cd /Users/daney/316-parts-store
git add server/routes/cart.routes.ts
git commit -m "refactor: update cart routes with new auth pattern and product references"
```

---

## Task 7: Update Checkout Routes

**Files:**
- Rewrite: `server/routes/checkout.routes.ts`

- [ ] **Step 1: Read current checkout routes**

- [ ] **Step 2: Rewrite with new imports and order flow**

Changes:
- Auth: `isAuthenticated` → `authenticateToken`, `req.jwtUser!.userId` → `req.customer!.customerId`
- Remove `pricingSettings` import — tax rate now comes from `storeSettings` (handled inside `createPendingOrder`)
- Import order functions from `"../storage/orders.js"`
- `POST /api/store/checkout`:
  - Validate body with Zod: `{ deliveryMethod, deliveryZoneId?, deliveryAddress?, deliveryParish?, deliveryNotes? }`
  - Call `orders.createPendingOrder(...)` — this handles stock decrement, cart clearing, sync enqueue
  - Return 201: `{ orderId, orderNumber, subtotal, taxAmount, deliveryFee, total }`
  - Note: Payment integration (spiToken, redirectData) will be added in Plan 3. For now, auto-confirm the order.
- `POST /api/store/payment-callback`: Keep as placeholder with TODO comment for Plan 3
- `POST /api/store/orders/:id/retry-payment`: Keep as placeholder for Plan 3

**Temporary workaround (until Plan 3):** After creating the pending order, immediately call `orders.confirmOrderPayment(orderId, "manual")` to simulate payment success. This lets the full order flow work without the payment gateway.

- [ ] **Step 3: Verify it compiles**

- [ ] **Step 4: Commit**

```bash
cd /Users/daney/316-parts-store
git add server/routes/checkout.routes.ts
git commit -m "refactor: update checkout routes with new order flow (payment stub for Plan 3)"
```

---

## Task 8: Update Order Routes

**Files:**
- Rewrite: `server/routes/orders.routes.ts`

- [ ] **Step 1: Read current order routes**

- [ ] **Step 2: Update auth, imports, and add sync**

Changes:
- Auth: `isAuthenticated` → `authenticateToken`
- `req.jwtUser!.userId` → `req.customer!.customerId`
- Import from `"../storage/orders.js"`
- `POST /api/store/orders/:id/cancel` — `cancelOrder` now handles sync internally (enqueues stock-restore)

- [ ] **Step 3: Verify it compiles**

- [ ] **Step 4: Commit**

```bash
cd /Users/daney/316-parts-store
git add server/routes/orders.routes.ts
git commit -m "refactor: update order routes with new auth pattern"
```

---

## Task 9: Update Admin Routes

**Files:**
- Rewrite: `server/routes/admin.routes.ts`

- [ ] **Step 1: Read current admin routes**

- [ ] **Step 2: Update auth and imports**

Major changes:
- Remove all `requireStaff`, `requireRole(...)` → use `authenticateToken, requireAdmin`
- `req.jwtUser!.userId` → `req.customer!.customerId`
- Import from new storage modules: `"../storage/orders.js"`, `"../storage/settings.js"`
- Replace `store.*` calls with `orders.*` or `settings.*` calls

Order management endpoints should work with the new `orders.ts` module.
Settings/delivery zone admin endpoints should work with `settings.ts`.

- [ ] **Step 3: Add delivery zone admin CRUD**

If not already present, add:
```
GET    /api/store/admin/delivery-zones       — getAllDeliveryZones()
POST   /api/store/admin/delivery-zones       — createDeliveryZone(body)
PATCH  /api/store/admin/delivery-zones/:id   — updateDeliveryZone(id, body)
DELETE /api/store/admin/delivery-zones/:id   — deleteDeliveryZone(id)
```

- [ ] **Step 4: Add settings admin endpoints**

```
GET    /api/store/admin/settings             — getStoreSettings()
PATCH  /api/store/admin/settings             — updateStoreSettings(body)
```

- [ ] **Step 5: Verify it compiles**

- [ ] **Step 6: Commit**

```bash
cd /Users/daney/316-parts-store
git add server/routes/admin.routes.ts
git commit -m "refactor: update admin routes with new auth, add delivery zone and settings admin"
```

---

## Task 10: Re-enable All Routes and Delete onlineStore.ts

**Files:**
- Modify: `server/routes/index.ts`
- Delete: `server/storage/onlineStore.ts` (replaced by cart.ts, orders.ts, settings.ts)
- Modify: `server/index.ts` (update cron job imports)

- [ ] **Step 1: Update route index to re-enable all modules**

Read `/Users/daney/316-parts-store/server/routes/index.ts` and uncomment/re-enable all route modules:
```typescript
import authRoutes from "./auth.routes.js";
import syncRoutes from "./sync.routes.js";
import catalogRoutes from "./catalog.routes.js";
import cartRoutes from "./cart.routes.js";
import checkoutRoutes from "./checkout.routes.js";
import ordersRoutes from "./orders.routes.js";
import adminRoutes from "./admin.routes.js";
// returns routes will be re-enabled in Plan 4
```

- [ ] **Step 2: Update server/index.ts cron imports**

The cron job currently imports from `onlineStore.ts`. Update to import from the new modules:
```typescript
import { cleanupStaleCarts } from "./storage/cart.js";
import { cleanupExpiredPendingOrders } from "./storage/orders.js";
```

- [ ] **Step 3: Delete server/storage/onlineStore.ts**

All functions have been extracted to `cart.ts`, `orders.ts`, and `settings.ts`. Delete the old file.

```bash
rm /Users/daney/316-parts-store/server/storage/onlineStore.ts
```

- [ ] **Step 4: Full TypeScript check**

```bash
cd /Users/daney/316-parts-store && npx tsc --noEmit --project tsconfig.json 2>&1 | head -30
```

Expected: Zero errors (or only errors in returns.routes.ts which is Plan 4 scope).

- [ ] **Step 5: Commit**

```bash
cd /Users/daney/316-parts-store
git add server/routes/index.ts server/index.ts
git rm server/storage/onlineStore.ts
git commit -m "refactor: re-enable all routes, delete onlineStore.ts (replaced by focused modules)"
```

---

## Verification Checklist (Plan 2 Complete When All Pass)

1. [ ] `npx tsc --noEmit` passes with zero errors (excluding returns.routes.ts if deferred)
2. [ ] `GET /api/store/catalog` returns products from `products` table
3. [ ] `GET /api/store/catalog/:id` returns full product detail with images, numbers, compatibility
4. [ ] `GET /api/store/catalog/featured` returns featured products
5. [ ] `GET /api/store/catalog/makes` returns distinct makes
6. [ ] `GET /api/store/categories` returns distinct categories
7. [ ] `GET /api/store/delivery-zones` returns active zones with fees
8. [ ] `GET /api/store/settings/public` returns tax rate, currency, return policy
9. [ ] `POST /api/store/cart/items` adds product to cart (requires auth)
10. [ ] `GET /api/store/cart` returns cart with live prices and stock status
11. [ ] `POST /api/store/checkout` creates order, decrements stock, clears cart, enqueues sync
12. [ ] `GET /api/store/orders` returns customer's order history
13. [ ] `GET /api/store/orders/:id` returns order detail with items
14. [ ] `POST /api/store/orders/:id/cancel` cancels order, restores stock, enqueues sync
15. [ ] Admin: `GET /api/store/admin/orders` returns all orders
16. [ ] Admin: Order state transitions work (confirm → picking → packed → shipped → delivered)
17. [ ] Admin: Delivery zone CRUD works
18. [ ] Admin: Store settings read/update works
19. [ ] Cron: Expired pending orders cleaned up after 30 min
20. [ ] Cron: Stale carts cleaned up
