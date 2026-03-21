# Parts Store — Complete Separation Design

## Context

316 Automotive's online parts store (`parts.316-automotive.com`) was originally built as a subdirectory inside the `316-garage-webapp` monorepo, sharing the same MySQL database. This design document specifies the full separation into an independent service with its own database, auth, warehouse, POS, and sync layer.

**Goal**: Zero database sharing. The parts store is a standalone retail operation — online e-commerce, warehouse management, and in-store POS — connected to the garage app only via authenticated API sync.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Catalog management | Garage pushes published parts to parts store API | Garage is source of truth for part data; parts store gets its own copy |
| Customer accounts | Parts store owns registration (email + Google) | Clean separation; no dependency on garage user records |
| Inventory sync | Real-time two-way API sync | Online sales decrement garage stock; garage stock changes push to store |
| Outage handling | Optimistic — place order, queue sync, resolve drift manually | Prioritizes customer experience; queue ensures eventual consistency |
| Database | New `partsstore` database on same DO managed MySQL cluster | Cost-effective; true data isolation without new infrastructure |
| Fulfillment | Own warehouse + pick list system | Full retail independence; no dependency on garage warehouse |
| POS | Industry standard retail POS | Walk-in counter sales alongside online orders |

---

## 1. Database & Schema

### New Database

- **Database name**: `partsstore` on existing `garage-316-mysql` cluster
- **Connection**: Same host/port as `defaultdb`, different database name
- **Migration system**: Drizzle ORM with `npm run db:generate:named` and `npm run db:migrate`

### Tables (34 total)

#### Core Tables (replacing garage dependencies)

| Table | Replaces | Key Fields |
|-------|----------|-----------|
| `customers` | garage `users` | id (uuid), email (unique), password (nullable for Google), firstName, lastName, phone, address, parish, authProvider (email/google), googleId (unique nullable), profileImageUrl, emailVerified, isActive, createdAt, updatedAt |
| `products` | garage `parts_inventory` | id (uuid), garagePartId (unique — source FK for sync dedup), name, partNumber (unique), barcode (unique nullable), salePrice, quantity, lowStockThreshold, description, longDescription, manufacturer, category, imageUrl, condition (new/refurbished/used), weight, isOversized, isFeatured, featuredSortOrder, isActive, lastSyncedAt, createdAt |
| `product_numbers` | garage `part_numbers` | id, productId FK, partNumber, numberType (oem/aftermarket/interchange), brand, isPrimary |
| `product_compatibility` | garage `vehicle_compatibility` | id, productId FK, make, model, yearStart, yearEnd, trim, engineType, vin (nullable) |
| `product_images` | garage `part_images` | id, productId FK, imageUrl, sortOrder, altText, isPrimary |
| `store_settings` | merged `pricing_settings` + `online_store_settings` | id (singleton=1), taxRate, taxName, currency, currencySymbol, returnWindowDays, defectiveReturnWindowDays, restockingFeePercent, electricalPartsReturnPolicy, maxQuantityPerItem, maxItemsPerOrder, cartExpirationDays, updatedAt |

#### E-Commerce Tables

| Table | Key Fields |
|-------|-----------|
| `shopping_carts` | id, customerId FK (unique), lastActivityAt, createdAt |
| `shopping_cart_items` | id, cartId FK, productId FK, quantity, priceAtAddTime; unique(cartId, productId) |
| `online_store_orders` | id, orderNumber (ORD-YYYY-NNNN unique), customerId FK, status, deliveryMethod, deliveryZoneId FK, deliveryFee, deliveryAddress, deliveryParish, deliveryNotes, estimatedDeliveryDate, subtotal, taxAmount, total, paymentTransactionId, paymentStatus, pickListId, trackingNumber, customerName/Email/Phone (snapshot), staffNotes, all status timestamps (placedAt, confirmedAt, packedAt, shippedAt, deliveredAt, pickupReadyAt, pickedUpAt, pickedUpBy, cancelledAt, cancelledBy FK, cancellationReason), createdAt, updatedAt |
| `online_store_order_items` | id, orderId FK, productId FK, productName, productNumber, quantity, unitPrice, lineTotal |
| `online_store_returns` | id, returnNumber (RET-YYYY-NNNN unique), orderId FK, customerId FK, status, reason, reasonDetails, resolution, refundAmount, restockingFee, returnShippingPaidBy, all status timestamps, staffNotes, createdAt, updatedAt |
| `online_store_return_items` | id, returnId FK, orderItemId FK, quantity, reason, conditionOnReturn |
| `delivery_zones` | id, name, parishes (JSON), deliveryFee, oversizedSurcharge, estimatedDays, isActive, sortOrder, createdAt, updatedAt |

#### Payment Tables

| Table | Key Fields |
|-------|-----------|
| `payment_methods` | id, customerId FK, panToken, cardBrand, maskedPan, cardholderName, expiryMonth, expiryYear, isDefault, isVerified, createdAt, updatedAt |

#### Warehouse Tables

| Table | Key Fields |
|-------|-----------|
| `warehouse_locations` | id, name, description, isActive |
| `warehouse_bins` | id, locationId FK, binCode (unique), description, isActive |
| `product_bin_assignments` | id, productId FK, binId FK, quantity; unique(productId, binId) |
| `stock_movements` | id, productId FK, binId FK (nullable), movementType (enum), quantity (+/-), referenceType, referenceId, notes, performedBy, createdAt |
| `stock_receipts` | id, receiptNumber (RCV-YYYY-NNNN unique), supplierId (nullable), status (draft/received/cancelled), receivedBy, notes, createdAt |
| `stock_receipt_items` | id, receiptId FK, productId FK, binId FK, quantity, unitCost, notes |

**Stock movement types**: `received`, `sold_online`, `sold_pos`, `returned`, `transferred`, `adjusted_up`, `adjusted_down`, `damaged`, `reserved`, `unreserved`

**Invariant**: `products.quantity` = SUM of `product_bin_assignments.quantity` for that product. Every stock change updates both atomically.

#### Pick List Tables

| Table | Key Fields |
|-------|-----------|
| `pick_lists` | id, pickListNumber (PL-YYYY-NNNN unique), sourceType (online_order/manual), sourceId, status (pending/assigned/in_progress/completed/cancelled), assignedTo, assignedAt, startedAt, completedAt, createdBy, createdAt |
| `pick_list_items` | id, pickListId FK, productId FK, binId FK, quantityRequired, quantityPicked (default 0), status (pending/picked/short/skipped), pickedAt, notes |

#### POS Tables

| Table | Key Fields |
|-------|-----------|
| `pos_sessions` | id, sessionNumber, openedBy FK, closedBy FK, openedAt, closedAt, openingCash, closingCash, expectedCash, cashDifference, status (open/closed), notes |
| `pos_transactions` | id, transactionNumber (POS-YYYY-NNNN unique), sessionId FK, customerId FK (nullable), type (sale/refund/void), status (completed/voided/refunded), subtotal, taxAmount, discountAmount, total, paymentMethod (cash/card/saved_card/split), cashReceived, changeGiven, cardTransactionId, processedBy FK, voidedBy FK, voidReason, originalTransactionId (for refunds), createdAt |
| `pos_transaction_items` | id, transactionId FK, productId FK, productName, productNumber, quantity, unitPrice, discountPercent, discountAmount, lineTotal |
| `pos_held_carts` | id, name, items (JSON), heldBy FK, createdAt, updatedAt |

#### Auth Tables

| Table | Key Fields |
|-------|-----------|
| `refresh_tokens` | id, customerId FK, tokenHash (unique), expiresAt, createdAt |

**Token revocation**: On password change or account compromise, delete all refresh tokens for that customer. The `refresh_tokens` table enables server-side revocation without a full token blacklist.

#### Phase 2 Tables

| Table | Key Fields |
|-------|-----------|
| `customer_push_tokens` | id, customerId FK, fcmToken, deviceName, createdAt |

#### Sequence Tables (6)

| Table | Pattern |
|-------|---------|
| `online_order_number_sequence` | ORD-YYYY-NNNN |
| `online_return_number_sequence` | RET-YYYY-NNNN |
| `pick_list_number_sequence` | PL-YYYY-NNNN |
| `pos_transaction_number_sequence` | POS-YYYY-NNNN |
| `pos_session_number_sequence` | year, lastNumber |
| `stock_receipt_number_sequence` | RCV-YYYY-NNNN |

#### Operational Tables

| Table | Key Fields |
|-------|-----------|
| `sync_log` | id, direction (inbound/outbound), entity (product/stock), payload (JSON), status (success/failed/queued), errorMessage, createdAt |
| `sync_queue` | id, endpoint, method, payload (JSON), attempts, lastAttemptAt, nextRetryAt, status (pending/processing/completed/failed), createdAt |

---

## 2. Sync API

### Garage to Parts Store (Inbound)

All endpoints protected by `x-sync-api-key` header validated against `SYNC_API_KEY` env var.

```
POST /api/sync/products          — Bulk upsert products with numbers, compatibility, images
POST /api/sync/products/:id      — Single product upsert
DELETE /api/sync/products/:id    — Unpublish (soft delete: isActive=false)
POST /api/sync/stock             — Batch stock level update [{garagePartId, quantity}]
```

**Product upsert payload:**
```typescript
{
  garagePartId: string;
  name: string;
  partNumber: string;
  salePrice: string;
  quantity: number;
  lowStockThreshold: number;
  description?: string;
  longDescription?: string;
  manufacturer?: string;
  category?: string;
  imageUrl?: string;
  condition: "new" | "refurbished" | "used";
  weight?: string;
  isOversized: boolean;
  isFeatured: boolean;
  featuredSortOrder: number;
  numbers: Array<{ partNumber, numberType, brand, isPrimary }>;
  compatibility: Array<{ make, model, yearStart, yearEnd, trim?, engineType? }>;
  images: Array<{ imageUrl, sortOrder, altText?, isPrimary }>;
}
```

**Upsert logic**: Match on `garagePartId`. If exists, update all fields + replace child records (numbers, compatibility, images). If new, insert. Sets `lastSyncedAt = now()`.

### Parts Store to Garage (Outbound)

```
POST {GARAGE_SYNC_URL}/stock-decrement   — {garagePartId, quantity, orderId, orderNumber}
POST {GARAGE_SYNC_URL}/stock-restore     — {garagePartId, quantity, orderId, reason}
```

**Queue behavior:**
1. On order placement / POS sale: decrement local `products.quantity`, enqueue outbound stock-decrement
2. Background worker processes queue: calls garage API, marks complete on success
3. On failure: exponential backoff (5s, 15s, 45s, 2m, 5m, 15m), max 10 attempts
4. After max attempts: marked `failed`, logged to `sync_log`
5. On order cancel / return / POS refund: same pattern with stock-restore

**Failed sync resolution:**
- Admin dashboard (`/admin/settings`) includes a "Sync Status" section showing: pending queue depth, recent failures, last successful sync timestamp
- Failed sync events are surfaced as a banner alert in the admin UI: "3 stock sync events failed — review required"
- Admin can: retry individual failed events, mark as resolved (manual adjustment made in garage), or dismiss
- Staff email notification sent when sync failures exceed threshold (e.g., 5+ failures in 1 hour)

### Garage App Changes

New in the `316-garage-webapp` repo:

| Change | File |
|--------|------|
| New sync routes | `server/routes/sync.routes.ts` — stock-decrement, stock-restore endpoints |
| Register sync routes | `server/routes/index.ts` |
| "Publish to Store" action | `server/routes/parts.routes.ts` — POST product data to parts store sync API |
| UI: publish button | `client/src/pages/PartsInventory.tsx` — toggle per part |
| Env vars | `PARTS_STORE_SYNC_URL`, `PARTS_STORE_SYNC_API_KEY` |

**Stock decrement handler**: Atomic `UPDATE parts_inventory SET quantity = quantity - ? WHERE id = ? AND quantity >= ?`. Returns success/failure. Parts store logs the result but doesn't roll back (optimistic).

---

## 3. Authentication

### Customer Registration & Login

The parts store has a fully independent auth system with its own `customers` table.

**Endpoints:**
```
POST /api/store/auth/register          — {email, password, firstName, lastName, phone?}
POST /api/store/auth/login             — {email, password} → {accessToken, refreshToken, customer}
POST /api/store/auth/google            — {idToken} → {accessToken, refreshToken, customer}
POST /api/store/auth/refresh           — {refreshToken} → {accessToken, refreshToken}
GET  /api/store/auth/me                — Current customer profile
PATCH /api/store/auth/me               — Update profile (name, phone, address, parish)
POST /api/store/auth/set-password      — Set/change password (works for Google-only accounts too)
POST /api/store/auth/forgot-password   — Send reset email (Phase 2)
POST /api/store/auth/reset-password    — Complete reset (Phase 2)
```

**JWT payload**: `{ customerId, email, isAdmin, type: "access"|"refresh" }`
**Token expiry**: Access 15m, Refresh 7d

### Google Sign-In

1. Client loads Google Identity Services SDK
2. User clicks "Sign in with Google" → Google returns `idToken`
3. Server verifies via `google-auth-library` (`OAuth2Client.verifyIdToken()`)
4. Extracts: email, given_name, family_name, email_verified, picture
5. If customer exists (by email): log in, issue JWTs
6. If new: create customer (password=null, `authProvider: "google"`), issue JWTs

**Edge cases:**
- Email registered, later Google sign-in (same email) → link accounts, set `googleId`
- Google-only account tries email login with no password → "No password set. Sign in with Google or set a password from your account page"
- Google accounts can set a password via `/api/store/auth/set-password` to enable both login methods

**Dependency**: `google-auth-library` npm package. Env var: `GOOGLE_CLIENT_ID`.

### Store Admin Auth

- Env var `STORE_ADMIN_EMAILS` — comma-separated list of emails with admin access (Phase 1 simplification; future: `store_staff` table with admin management UI)
- On login, if customer email is in that list, JWT gets `isAdmin: true` claim
- `requireAdmin` middleware checks this claim on `/api/store/admin/*` routes

### Guest Cart Strategy

Guest users (not logged in) can browse and add items to a client-side cart stored in Zustand + localStorage. This is the existing pattern (`useGuestCart` hook).

- **Guest cart**: Zustand store with localStorage persistence on the client. No server-side storage for anonymous users.
- **On login/register**: Client sends `POST /api/store/cart/merge` with guest cart items `[{productId, quantity}]`. Server merges into the authenticated customer's server-side cart (union strategy: take higher quantity for duplicates).
- **No server-side anonymous carts**: This avoids needing session IDs, cookie-based cart tracking, or a `guest_carts` table. The tradeoff is that guest cart data is lost if the user clears browser storage, which is acceptable.

---

## 4. Payment Integration

### Modules

| File | Purpose |
|------|---------|
| `server/payment/powertranz.ts` | PowerTranz SPI: auth, 3DS, completion, callbacks, refunds, voids, tokenization |
| `server/payment/ncbVerification.ts` | NCB card registration: verification charge, void, tokenize via JNCB account |
| `server/payment/callbackUtils.ts` | HMAC verification, idempotency guard |

### Capabilities

**PowerTranzPaymentService:**
- `initiateSPIAuthWithCard()` — New card payment via `/Api/spi/Sale` with 3DS
- `initiateSPIAuthWithToken()` — Saved card payment via `/Api/spi/Sale` with PanToken
- `completeSPIPayment()` — Complete payment after 3DS
- `chargeSavedCard()` — Direct FPI `/Api/Sale` with token (no 3DS)
- `parseSPICallback()` — Parse PowerTranz callback data
- `refundPayment()` — Refund via PowerTranz API (for returns)
- `voidTransaction()` — Void (used by NCB verification)
- `tokenizeCard()` — Tokenize via `/Api/riskmgmt` → PanToken

**NCBCardVerificationService:**
- `chargeVerificationAmount()` — Random $1-$5 charge via JNCB verification account
- `voidCharge()` — Void after customer confirms amount
- `tokenizeCard()` — Get PanToken for future charges
- Card encryption/decryption (AES-256-GCM) for temp storage during flow

### Payment Flows

**Checkout (new card):**
1. `initiateSPIAuthWithCard()` → returns SpiToken + RedirectData (3DS iframe)
2. Client renders 3DS iframe
3. PowerTranz calls `POST /api/store/payment-callback` → HMAC verified → `completeSPIPayment()`
4. `pending_payment` → `placed`

**Checkout (saved card):**
1. `initiateSPIAuthWithToken()` → returns SpiToken + RedirectData
2. Same 3DS flow → callback → completion

**Card registration (NCB SOP):**
1. Customer enters card details
2. `chargeVerificationAmount()` → small charge via JNCB account → 3DS
3. Customer checks bank statement, enters exact amount
4. Amount matches → `voidTransaction()` → `tokenizeCard()` → save to `payment_methods`

**POS card payment:**
Same PowerTranz SPI flow, triggered from POS terminal UI.

### Credentials (env vars only, no settings table)

```
POWERTRANZ_MERCHANT_ID            # SPI merchant (actual payments)
POWERTRANZ_MERCHANT_PASSWORD
POWERTRANZ_TEST_MODE=false
POWERTRANZ_PRODUCTION_URL=https://ptranz.com/Api/spi
POWERTRANZ_TEST_URL=https://staging.ptranz.com/Api/spi
POWERTRANZ_CALLBACK_URL=https://parts.316-automotive.com/api/store/payment-callback
POWERTRANZ_VERIFY_ID              # JNCB verification account
POWERTRANZ_VERIFY_PASSWORD
```

---

## 5. Notifications

### Phase 1 (Launch)

**Email via Resend API.** Module: `server/email.ts`.

**Transactional emails (8 customer + 1 staff):**

| Trigger | Recipient | Subject |
|---------|-----------|---------|
| Order placed | Customer | "Order #ORD-2026-0001 confirmed" |
| Order confirmed | Customer | "Your order is being prepared" |
| Order shipped | Customer | "Your order has shipped — tracking: {number}" |
| Out for delivery | Customer | "Your order is on its way" |
| Delivered | Customer | "Your order has been delivered" |
| Ready for pickup | Customer | "Your order is ready to collect" |
| Return approved | Customer | "Your return has been approved" |
| Refund processed | Customer | "Your refund of $X has been processed" |
| New order | Staff (STORE_ADMIN_EMAILS) | "New online order #ORD-2026-0001" |

**Env vars**: `RESEND_API_KEY`, `FROM_EMAIL` (default: `orders@316-automotive.com`)

**Error handling**: Failed email sends are retried 3 times with 5-second backoff. After 3 failures, logged to console with order ID for manual resolution. Email failures never block order processing — the order succeeds regardless.

### Phase 2

- **Firebase push notifications**: Order status updates to customer mobile devices. New table: `customer_push_tokens` (customerId, fcmToken, deviceName, createdAt). Env var: `FIREBASE_SERVICE_ACCOUNT`.
- **WebSocket (Socket.io)**: Real-time staff alerts — `order:placed`, `order:cancelled`, `return:requested` events. Added to the existing Express server process.

---

## 6. Fulfillment

### Order State Machine

```
pending_payment ──→ placed ──→ confirmed ──→ picking ──→ packed ─┬→ shipped ──→ out_for_delivery ──→ delivered
       │              │           │            │                  └→ [ready for pickup] ──→ delivered
       │              └───────────┴────────────┴──→ cancelled (staff)
       │              └──→ cancelled (customer: from placed only)
       └──→ cancelled (auto: pending_payment > 30 min)
```

### Staff Actions (admin dashboard)

| Action | Transition | Side Effects |
|--------|-----------|-------------|
| Confirm | placed → confirmed | Auto-creates pick list |
| Start picking | confirmed → picking | Pick list → assigned/in_progress |
| Mark packed | picking → packed | Auto on pick list completion |
| Ship | packed → shipped | Sets trackingNumber, emails customer |
| Out for delivery | shipped → out_for_delivery | Emails customer |
| Deliver | out_for_delivery → delivered | Emails customer |
| Ready for pickup | packed → (sets pickupReadyAt) | Emails customer |
| Picked up | packed → delivered | Records pickedUpBy |
| Cancel | placed/confirmed/picking → cancelled | Restores local stock, queues stock-restore to garage, emails customer |

### Pick List Integration

- Staff confirms order → `createPickListForOrder(orderId)` auto-selects bins (largest quantity first, splits across bins if needed)
- Pick list assigned to picker → order moves to `picking`
- Picker works through items, marks picked/short
- Pick list completed → order auto-transitions to `packed`

### Cron Jobs

| Job | Interval | Action |
|-----|----------|--------|
| Cleanup pending orders | Every 5 min | Cancel `pending_payment` orders > 30 min, restore stock, queue garage sync |
| Cleanup stale carts | Daily | Delete carts older than `cartExpirationDays` |
| Process sync queue | Every 30 sec | Retry failed outbound sync events |

---

## 7. Warehouse Management

### Operations

- `assignProductToBin(productId, binId, quantity)` — Place stock in a bin
- `transferStock(productId, fromBinId, toBinId, quantity)` — Move between bins
- `adjustStock(productId, binId, quantity, reason)` — Manual correction
- `receiveStock(receiptId)` — Process goods receipt: increment bin quantities + product quantity
- `getProductBinLocations(productId)` — All bins holding this product
- `getBinContents(binId)` — All products in a bin
- `getStockMovementHistory(productId, dateRange)` — Full audit trail

### Goods Receipt Flow

1. Create stock receipt (draft) with line items (product, bin, quantity, unit cost)
2. Review and confirm → status: `received`
3. Each line item: increment `product_bin_assignments.quantity`, increment `products.quantity`, record stock movement (`received`)

### Warehouse API Routes

```
# Locations
GET    /api/store/admin/warehouse/locations           — List locations
POST   /api/store/admin/warehouse/locations           — Create location {name, description}
PATCH  /api/store/admin/warehouse/locations/:id       — Update location
DELETE /api/store/admin/warehouse/locations/:id       — Deactivate location

# Bins
GET    /api/store/admin/warehouse/bins                — List bins (filter by locationId)
POST   /api/store/admin/warehouse/bins                — Create bin {locationId, binCode, description}
PATCH  /api/store/admin/warehouse/bins/:id            — Update bin
GET    /api/store/admin/warehouse/bins/:id/contents   — Products in bin

# Stock operations
POST   /api/store/admin/warehouse/assign              — Assign product to bin {productId, binId, quantity}
POST   /api/store/admin/warehouse/transfer            — Transfer {productId, fromBinId, toBinId, quantity}
POST   /api/store/admin/warehouse/adjust              — Adjust {productId, binId, quantity, reason}
GET    /api/store/admin/warehouse/product/:id/bins    — Bin locations for a product

# Stock receipts
GET    /api/store/admin/warehouse/receipts            — List receipts (filter by status, date)
POST   /api/store/admin/warehouse/receipts            — Create receipt (draft) {items[]}
GET    /api/store/admin/warehouse/receipts/:id        — Receipt detail
POST   /api/store/admin/warehouse/receipts/:id/receive — Confirm receipt → update stock
POST   /api/store/admin/warehouse/receipts/:id/cancel — Cancel draft receipt

# Movements audit
GET    /api/store/admin/warehouse/movements           — Stock movement history (filter by product, type, date)
```

### Pick List API Routes

```
GET    /api/store/admin/pick-lists                    — List pick lists (filter by status)
GET    /api/store/admin/pick-lists/:id                — Pick list detail with items + bin locations
POST   /api/store/admin/pick-lists/:id/assign         — Assign to picker {assignedTo}
POST   /api/store/admin/pick-lists/:id/start          — Start picking
POST   /api/store/admin/pick-lists/:id/items/:itemId/pick — Pick item {quantityPicked}
POST   /api/store/admin/pick-lists/:id/complete       — Complete pick list → triggers order packed
POST   /api/store/admin/pick-lists/:id/cancel         — Cancel pick list
```

### Store Settings API Routes

```
GET    /api/store/admin/settings                      — Get all store settings
PATCH  /api/store/admin/settings                      — Update store settings
GET    /api/store/admin/settings/sync-status           — Sync queue depth, recent failures, last success
POST   /api/store/admin/settings/sync-retry/:id       — Retry failed sync event
POST   /api/store/admin/settings/sync-resolve/:id     — Mark failed sync as resolved
```

---

## 8. Retail POS

### Features

| Feature | Description |
|---------|-------------|
| Barcode scan | Scan part barcode → adds to cart instantly |
| Quick search | Search by part number, name, or barcode |
| Cart management | Add, remove, adjust quantities, apply line discounts |
| Hold/recall | Park a transaction, serve next customer, recall later |
| Payment: Cash | Enter amount received, auto-calculate change |
| Payment: Card | PowerTranz SPI with 3DS |
| Payment: Saved card | Charge saved card (if customer identified) |
| Payment: Split | Part cash + part card |
| Receipts | HTML receipt (printable), optional email receipt |
| Void | Void completed transaction (same session, manager override) |
| Refund | Refund previous transaction (full or partial), restores stock |
| Customer lookup | Optional — link sale to customer for history |
| Session open/close | Cash count at open and close, variance report |
| Daily report | Sales total, transaction count, payment method breakdown, top products |

### API Routes

```
# Sessions
POST   /api/store/pos/sessions/open           — Open register {openingCash}
POST   /api/store/pos/sessions/close          — Close register {closingCash, notes}
GET    /api/store/pos/sessions/current        — Get active session

# Transactions
POST   /api/store/pos/transactions            — Complete sale {items[], paymentMethod, cashReceived?, customerId?}
GET    /api/store/pos/transactions             — List transactions (session, date range)
GET    /api/store/pos/transactions/:id        — Transaction detail
POST   /api/store/pos/transactions/:id/void   — Void {reason}
POST   /api/store/pos/transactions/:id/refund — Refund {items[], amount}

# Held carts
POST   /api/store/pos/hold                    — Hold cart {name, items[]}
GET    /api/store/pos/hold                    — List held carts
GET    /api/store/pos/hold/:id               — Get held cart
DELETE /api/store/pos/hold/:id               — Delete held cart

# Quick lookup
GET    /api/store/pos/lookup?q=              — Barcode/part number/name search

# Reports
GET    /api/store/pos/reports/daily           — Daily summary
GET    /api/store/pos/reports/session/:id    — Session summary
```

### Stock Deduction

POS sales decrement stock from a specific bin (cashier's default or scanned). Stock movement type: `sold_pos`. Queues outbound sync to garage (same mechanism as online orders).

---

## 9. Return Policy & State Machine

**Policy (from `store_settings`):**
- Standard return window: 14 days from delivery
- Defective return window: 30 days (configurable)
- Restocking fee: 15% for non-defective, 0% for defective/wrong parts
- Electrical parts: NO cash refund — only exchange or store credit
- Return shipping: Store pays for defective/wrong-part; customer pays for change-of-mind

```
requested ──→ approved ──→ shipped_back ──→ received ─┬→ refunded (non-electrical)
    │                                                  ├→ exchanged
    └──→ rejected                                      └→ closed (store credit, electrical)
```

---

## 10. Security

| Concern | Mitigation |
|---------|-----------|
| Catalog scraping | Rate limit: 60 req/min anon, 120 req/min auth |
| Cart abuse | Max 50 qty per item, max 200 items total, server-side |
| Price manipulation | Prices resolved server-side from `products.salePrice` |
| Payment replay | Idempotency guard in callback handler |
| Overselling | Atomic `WHERE quantity >= N` in transaction |
| XSS in addresses | Sanitize user input with `escapeHtml()` |
| CORS | Explicit origin allowlist |
| CSRF | JWT via `Authorization` header (inherently safe) |
| Sync auth | API key in `x-sync-api-key` header, validated middleware |
| Expired pending orders | Cron cancels > 30 min, restores stock |
| Stale carts | Cron clears inactive > 30 days |
| POS session security | Void requires manager override (admin email check) |

---

## 11. Frontend Pages (31 total)

### Storefront (public + customer auth)

```
/                              Homepage (hero, featured, categories, vehicle search)
/search                        Search results with filters
/parts/[partId]                Part detail (SSR for SEO)
/parts/lookup/[partNumber]     Cross-reference lookup
/cart                          Shopping cart
/checkout                      Multi-step checkout
/checkout/success              Order confirmation
/checkout/failure              Payment failed + retry
/login                         Login (email + Google)
/register                      Registration (email + Google)
/account                       Profile, addresses, saved cards, password
/orders                        Order history
/orders/[id]                   Order detail + timeline
/returns                       Return history
/returns/new                   Request return
/returns/[id]                  Return detail + timeline
/policies/returns              Return policy page
```

### Admin (store staff)

```
/admin                         Dashboard (order stats, revenue, top products)
/admin/login                   Admin login
/admin/orders                  Order list + status filters
/admin/orders/[id]             Order detail + actions
/admin/returns                 Returns list
/admin/returns/[id]            Return detail + actions
/admin/settings                Store settings + delivery zones
/admin/warehouse               Bin management, stock levels
/admin/warehouse/receive       Goods receipt
/admin/warehouse/movements     Stock movement audit trail
/admin/pick-lists              Pick list queue
/admin/pick-lists/[id]         Pick list detail
```

### POS (dedicated terminal)

```
/pos                           Full-screen POS terminal
/pos/reports                   Daily/session reports
```

---

## 12. Infrastructure & Deployment

### CI/CD Pipeline (`.github/workflows/deploy.yml`)

```
1. Type Check    → npm run check
2. Build & Push  → Docker build → push to DOCR
3. Migrate       → Run drizzle migrations against partsstore DB
4. Deploy        → doctl apps create-deployment → health check
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL connection to `partsstore` database |
| `JWT_SECRET` | JWT signing key |
| `NODE_ENV` | `production` |
| `PORT` | `5002` |
| `BASE_URL` | `https://parts.316-automotive.com` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `RESEND_API_KEY` | Email sending |
| `FROM_EMAIL` | `orders@316-automotive.com` |
| `STORE_ADMIN_EMAILS` | Comma-separated admin emails |
| `POWERTRANZ_MERCHANT_ID` | SPI merchant ID |
| `POWERTRANZ_MERCHANT_PASSWORD` | SPI merchant password |
| `POWERTRANZ_VERIFY_ID` | JNCB verification account |
| `POWERTRANZ_VERIFY_PASSWORD` | JNCB verification password |
| `POWERTRANZ_TEST_MODE` | `false` in production |
| `POWERTRANZ_PRODUCTION_URL` | `https://ptranz.com/Api/spi` |
| `POWERTRANZ_CALLBACK_URL` | `https://parts.316-automotive.com/api/store/payment-callback` |
| `GARAGE_SYNC_URL` | `https://316-automotive.com/api/sync` |
| `GARAGE_SYNC_API_KEY` | Shared secret for outbound sync to garage |
| `SYNC_API_KEY` | Shared secret for inbound sync from garage |
| `DB_SSL_REJECT_UNAUTHORIZED` | `false` for DigitalOcean managed MySQL |

### GitHub Secrets (repo: `sirsmithdev/Autoparts`)

| Secret | Purpose |
|--------|---------|
| `DIGITALOCEAN_ACCESS_TOKEN` | DOCR + App Platform |
| `PARTS_STORE_DATABASE_URL` | CI migration runner |

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_TWS_KEY` | PowerTranz tokenization key (client build) |

### Garage App Changes (minimal, in `316-garage-webapp`)

| Change | File |
|--------|------|
| New sync routes | `server/routes/sync.routes.ts` — stock-decrement, stock-restore |
| Register routes | `server/routes/index.ts` |
| Publish action | `server/routes/parts.routes.ts` — push product to parts store |
| UI: publish button | Parts inventory page — toggle per part |
| Env vars | `PARTS_STORE_SYNC_URL`, `PARTS_STORE_SYNC_API_KEY` |

---

## 13. Delivery Zones (Jamaica Parishes)

| Zone | Parishes | Fee (JMD) | Oversized Surcharge | Est. Days |
|------|----------|-----------|--------------------:|-----------|
| Kingston Metro | Kingston, St. Andrew | 500 | +300 | 1 |
| St. Catherine | St. Catherine | 800 | +500 | 1-2 |
| Central | Clarendon, Manchester, St. Elizabeth | 1200 | +800 | 2-3 |
| North Coast | St. Ann, St. Mary, Portland | 1500 | +1000 | 2-3 |
| Western | St. James, Hanover, Westmoreland, Trelawny | 1500 | +1000 | 2-3 |

Pickup is free — customer selects `deliveryMethod: "pickup"`, no zone needed.

---

## 14. Migration Plan

### From Shared Database to Independent

The existing parts store has live data (carts, orders, settings) in the garage database. Migration strategy:

**Phase 1: Create new database and schema**
1. `CREATE DATABASE partsstore` on the managed MySQL cluster
2. Run initial Drizzle migration to create all 34 tables
3. Seed `store_settings` with current values from garage's `online_store_settings` + `pricing_settings`
4. Seed `delivery_zones` with current zone data

**Phase 2: Migrate existing data**
1. Export existing customers from garage `users` table (where role='customer' AND has placed online orders) → insert into `customers` table. Generate new UUIDs, preserve email/password/name/phone. Set `authProvider: "email"`.
2. Export published parts from garage `parts_inventory` (where `isPublishedOnline=true`) → insert into `products` with `garagePartId` mapping. Include `part_numbers` → `product_numbers`, `vehicle_compatibility` → `product_compatibility`, `part_images` → `product_images`.
3. Export active orders from `online_store_orders` → remap `customerId` to new customer IDs.
4. Export returns, carts if any active ones exist.

**Phase 3: Cutover**
1. Deploy parts store pointing at new `partsstore` database
2. Enable sync API on both sides
3. Verify catalog, auth, and order history work
4. Disable old shared-database code paths

**Rollback**: If issues arise during cutover, revert parts store deployment to previous image (still points at shared DB). No data loss — the new database is additive.

### Column Rename: `partId` → `productId`

The existing codebase uses `partId` throughout (schema, storage, routes, client components). The spec renames to `productId` to match the new `products` table. This is a coordinated rename affecting:
- `server/schema.ts` — all table definitions
- `server/storage/*.ts` — all queries
- `server/routes/*.ts` — all request/response shapes
- `shared/types.ts` — all interfaces
- `client/src/**/*.tsx` — all component props and API calls

This rename happens as part of the implementation, not as a separate migration step. The new schema uses `productId` from the start; there is no old data to migrate column names for (the old tables stay in the garage DB untouched).

---

## 15. Verification Checklist

1. **Public catalog**: Browse without auth → prices visible, stock badges, no exact quantities
2. **SEO**: `view-source:` on product page → server-rendered HTML
3. **Search**: By keyword, part number, VIN, make/model/year
4. **Registration**: Email signup, Google signup, Google + password set
5. **Cart**: Add items → stock warnings → price change alerts → quantity limits
6. **Guest → login merge**: Guest cart items merged on login
7. **Checkout (delivery)**: Parish → fee → address → payment → confirmation email
8. **Checkout (pickup)**: No fee → payment → "ready for pickup" email
9. **Saved cards**: Register card via NCB flow → use for checkout
10. **Payment failure**: Failure page → retry → succeeds
11. **Pending cleanup**: Unpaid orders cancelled after 30 min, stock restored
12. **Fulfillment**: Confirm → pick list created → pick → packed → ship with tracking
13. **Warehouse**: Receive stock → assign bins → track movements → audit trail
14. **POS sale**: Scan barcode → add to cart → cash/card payment → receipt → stock decremented
15. **POS hold/recall**: Park transaction → serve next customer → recall
16. **POS session**: Open with cash count → close with count → variance report
17. **Sync to garage**: Online/POS sale decrements garage stock via API
18. **Sync from garage**: Publish part in garage → appears in parts store catalog
19. **Sync resilience**: Garage API down → order still succeeds → queued sync retries
20. **Returns (standard)**: Within 14 days → approved → ship back → refunded minus 15%
21. **Returns (defective)**: No restocking fee → full refund
22. **Returns (electrical)**: Exchange or store credit only
23. **Cancel order**: Customer from "placed" → inventory restored → garage notified
24. **Email notifications**: All 8 templates sent at correct transitions
25. **Rate limiting**: Anonymous catalog 60/min, authenticated 120/min
26. **Overselling**: Concurrent checkout on last item → one succeeds, one fails gracefully
