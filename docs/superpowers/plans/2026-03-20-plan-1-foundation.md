# Plan 1: Foundation — Schema, Auth & Sync Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the independent database, customer auth system, and two-way sync API so the parts store no longer depends on the garage app's database.

**Architecture:** New `partsstore` database on the same DO managed MySQL cluster. Drizzle ORM owns the schema via migrations. Customer auth is JWT-based with email + Google sign-in. Sync uses API-key-authenticated REST endpoints with a persistent retry queue for outbound events.

**Tech Stack:** Drizzle ORM (mysql2), bcrypt, jsonwebtoken, google-auth-library, Express, Zod

**Spec:** `docs/superpowers/specs/2026-03-20-parts-store-separation-design.md`
**API Reference:** `docs/api-reference.md`

---

## Plan Roadmap (7 Plans Total)

| Plan | Name | Depends On | Status |
|------|------|-----------|--------|
| **1** | **Foundation: Schema, Auth & Sync** | — | This plan |
| 2 | E-Commerce Core: Catalog, Cart, Checkout, Orders | Plan 1 | Pending |
| 3 | Payment Integration: PowerTranz, NCB, Saved Cards | Plan 2 | Pending |
| 4 | Order Fulfillment & Returns | Plan 2 | Pending |
| 5 | Warehouse & Pick Lists | Plan 1 | Pending |
| 6 | POS System | Plans 1, 5 | Pending |
| 7 | Email Notifications & Frontend Pages | Plans 2-6 | Pending |

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `server/schema.ts` | REWRITE — All 34 table definitions for `partsstore` database |
| `server/storage/customers.ts` | Customer CRUD: register, find by email, update profile, Google linking |
| `server/storage/sync.ts` | Sync queue and log operations |
| `server/routes/auth.routes.ts` | REWRITE — Register, login, Google, refresh, profile, set-password |
| `server/routes/sync.routes.ts` | NEW — Inbound product/stock sync from garage |
| `server/sync/garageClient.ts` | NEW — Outbound HTTP client for garage stock sync |
| `server/sync/queueProcessor.ts` | NEW — Background worker: process outbound sync queue |
| `server/auth.ts` | REWRITE — JWT issuance/verification for customers |
| `server/middleware.ts` | REWRITE — Customer auth, admin check, sync API key validation |
| `migrations/0001_initial_schema.sql` | Initial migration: all 34 tables |
| `scripts/run-migrations.js` | Migration runner for CI |

### Modified Files

| File | Changes |
|------|---------|
| `server/index.ts` | Add sync queue processor cron, update route registration |
| `server/routes/index.ts` | Register new sync routes |
| `server/db.ts` | No changes needed (already points at DATABASE_URL) |
| `package.json` | Add dependencies: google-auth-library, zod |
| `drizzle.config.ts` | Verify schema path is correct |
| `.github/workflows/deploy.yml` | Add migration step before deploy |

---

## Task 1: Rewrite Schema for Independent Database

**Files:**
- Rewrite: `server/schema.ts`

This is the foundation — every other file depends on these table definitions. The new schema defines all 34 tables owned by the parts store with no references to garage tables.

- [ ] **Step 1: Read the current schema file**

Read `server/schema.ts` to understand the existing table definitions that need to be replaced.

- [ ] **Step 2: Rewrite schema.ts with all 34 tables**

Replace the entire file. Key changes from the existing schema:
- `customers` table replaces dependency on garage `users` (adds authProvider, googleId, parish)
- `products` table replaces `partsInventory` (adds garagePartId for sync, lastSyncedAt)
- `product_numbers` replaces `partNumbers` (FK → products)
- `product_compatibility` replaces `vehicleCompatibility` (FK → products, adds vin)
- `product_images` replaces `partImages` (FK → products)
- `store_settings` merges `pricingSettings` + `onlineStoreSettings`
- `payment_methods` — new (saved cards with panToken)
- `refresh_tokens` — new (JWT revocation)
- All warehouse tables — new (locations, bins, assignments, movements, receipts)
- All pick list tables — new
- All POS tables — new (sessions, transactions, held carts)
- `sync_log` and `sync_queue` — new
- 6 sequence tables — new

All existing e-commerce tables (carts, orders, returns, delivery zones) are kept but FKs change from `users.id` to `customers.id` and from `partsInventory.id` to `products.id`.

Every table must use:
- `varchar("id", { length: 36 }).primaryKey().$defaultFn(() => randomUUID())` for UUIDs
- `timestamp("created_at").defaultNow().notNull()` for timestamps
- Appropriate indexes on foreign keys and frequently queried columns

Reference the spec Section 1 for the complete table definitions. The schema should export:
- All table definitions
- All enum value arrays (e.g., `onlineOrderStatusValues`, `stockMovementTypeValues`)
- All inferred types (e.g., `type Customer = typeof customers.$inferSelect`)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/daney/316-parts-store && npx tsc --noEmit --project tsconfig.json`
Expected: No errors (schema is self-contained, no external imports except drizzle-orm)

- [ ] **Step 4: Commit**

```bash
cd /Users/daney/316-parts-store
git add server/schema.ts
git commit -m "feat: rewrite schema for independent partsstore database

34 tables: customers, products, product_numbers, product_compatibility,
product_images, store_settings, payment_methods, refresh_tokens,
warehouse (locations, bins, assignments, movements, receipts),
pick lists, POS (sessions, transactions, held carts),
sync (log, queue), 6 sequence tables, and all e-commerce tables
with updated FKs."
```

---

## Task 2: Generate Initial Migration

**Files:**
- Create: `migrations/0001_initial_schema.sql`
- Create: `migrations/meta/_journal.json`
- Modify: `package.json` (add migration scripts)
- Modify: `drizzle.config.ts` (verify configuration)

- [ ] **Step 1: Add migration scripts to package.json**

Add to `scripts` in `package.json`:
```json
"db:generate": "drizzle-kit generate",
"db:generate:named": "drizzle-kit generate --name",
"db:migrate": "drizzle-kit migrate"
```

- [ ] **Step 2: Verify drizzle.config.ts points to correct schema**

Read `drizzle.config.ts` and verify it uses `schema: "./server/schema.ts"` and `dialect: "mysql"`. Update the `out` field to `"./migrations"` if not already set.

- [ ] **Step 3: Generate the initial migration**

Run: `cd /Users/daney/316-parts-store && npx drizzle-kit generate --name initial_schema`

This creates a `.sql` file in `migrations/` and updates `migrations/meta/_journal.json`.

Expected: A single large SQL file with CREATE TABLE statements for all 34 tables.

- [ ] **Step 4: Review the generated SQL**

Read the generated migration file. Verify:
- All 34 tables are present
- Multi-statement SQL uses `--> statement-breakpoint` between statements
- Indexes are created
- Foreign keys reference correct tables
- No syntax errors for MySQL dialect

If `--> statement-breakpoint` is missing between statements, add them manually.

- [ ] **Step 5: Test migration locally**

Ensure you have a local MySQL database `partsstore` created:
```bash
mysql -u root -e "CREATE DATABASE IF NOT EXISTS partsstore;"
```

Set the DATABASE_URL and run the migration:
```bash
cd /Users/daney/316-parts-store
DATABASE_URL=mysql://root:@localhost:3306/partsstore npx drizzle-kit migrate
```

Expected: Migration applies successfully, all tables created.

- [ ] **Step 6: Verify tables exist**

```bash
mysql -u root partsstore -e "SHOW TABLES;"
```

Expected: All 34 tables listed.

- [ ] **Step 7: Commit**

```bash
cd /Users/daney/316-parts-store
git add migrations/ drizzle.config.ts package.json
git commit -m "feat: add initial database migration for all 34 tables"
```

---

## Task 3: Rewrite Auth Module — JWT for Customers

**Files:**
- Rewrite: `server/auth.ts`

The auth module handles JWT token creation and verification for the `customers` table (not the garage `users` table).

- [ ] **Step 1: Read current auth.ts**

Read `server/auth.ts` to understand the existing JWT implementation.

- [ ] **Step 2: Rewrite auth.ts for customer-based JWT**

The module should export:

```typescript
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_EXPIRY = "15m";
const REFRESH_EXPIRY = "7d";

interface TokenPayload {
  customerId: string;
  email: string;
  isAdmin: boolean;
  type: "access" | "refresh";
}

export function generateAccessToken(customer: { id: string; email: string; isAdmin: boolean }): string
export function generateRefreshToken(customer: { id: string; email: string; isAdmin: boolean }): string
export function verifyToken(token: string): TokenPayload
export function isAdminEmail(email: string): boolean  // checks STORE_ADMIN_EMAILS env var
```

Key details:
- `generateAccessToken` creates a JWT with `{ customerId, email, isAdmin, type: "access" }`, expires in 15m
- `generateRefreshToken` creates a JWT with `{ customerId, email, isAdmin, type: "refresh" }`, expires in 7d
- `verifyToken` decodes and verifies, throws on invalid/expired
- `isAdminEmail` splits `process.env.STORE_ADMIN_EMAILS` on comma, trims, checks if email is in list
- Throw a clear error if `JWT_SECRET` is not set

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/daney/316-parts-store && npx tsc --noEmit --project tsconfig.json`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd /Users/daney/316-parts-store
git add server/auth.ts
git commit -m "feat: rewrite auth module for customer JWT tokens"
```

---

## Task 4: Rewrite Middleware — Customer Auth & Sync API Key

**Files:**
- Rewrite: `server/middleware.ts`

- [ ] **Step 1: Read current middleware.ts**

Read `server/middleware.ts` to understand existing middleware.

- [ ] **Step 2: Rewrite middleware.ts**

The module should export these Express middleware functions:

```typescript
// Extracts JWT from Authorization header, attaches customer to req
// Returns 401 if no token or invalid token
export function authenticateToken(req, res, next)

// Same as authenticateToken but doesn't fail — sets req.customer to null if no token
export function optionalAuth(req, res, next)

// Must be used AFTER authenticateToken. Returns 403 if req.customer.isAdmin is false
export function requireAdmin(req, res, next)

// Validates x-sync-api-key header against SYNC_API_KEY env var
// Returns 401 if missing or wrong
export function validateSyncApiKey(req, res, next)
```

Key details:
- `authenticateToken` reads `Authorization: Bearer <token>`, calls `verifyToken()` from `./auth.ts`, attaches `{ customerId, email, isAdmin }` to `req.customer`
- Extend Express `Request` type with `customer?: { customerId: string; email: string; isAdmin: boolean }`
- `optionalAuth` is the same but doesn't fail — useful for catalog endpoints where auth is optional
- `requireAdmin` checks `req.customer.isAdmin === true`
- `validateSyncApiKey` compares `req.headers["x-sync-api-key"]` to `process.env.SYNC_API_KEY`

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/daney/316-parts-store && npx tsc --noEmit --project tsconfig.json`

- [ ] **Step 4: Commit**

```bash
cd /Users/daney/316-parts-store
git add server/middleware.ts
git commit -m "feat: rewrite middleware for customer auth, admin check, sync API key"
```

---

## Task 5: Customer Storage Module

**Files:**
- Create: `server/storage/customers.ts`

- [ ] **Step 1: Create customer storage module**

This module handles all customer database operations. It should export:

```typescript
import { db } from "../db.js";
import { customers, refreshTokens } from "../schema.js";
import bcrypt from "bcrypt";

// Find customer by email (login flow)
export async function findByEmail(email: string): Promise<Customer | null>

// Find customer by ID (middleware flow)
export async function findById(id: string): Promise<Customer | null>

// Find customer by Google ID
export async function findByGoogleId(googleId: string): Promise<Customer | null>

// Create customer with email/password
export async function createCustomer(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}): Promise<Customer>

// Create customer from Google sign-in (password = null)
export async function createGoogleCustomer(data: {
  email: string;
  googleId: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
}): Promise<Customer>

// Link Google account to existing customer (same email)
export async function linkGoogleAccount(customerId: string, googleId: string, profileImageUrl?: string): Promise<void>

// Update customer profile
export async function updateProfile(customerId: string, data: Partial<{
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  parish: string;
}>): Promise<void>

// Set or change password (works for Google-only accounts too)
export async function setPassword(customerId: string, hashedPassword: string): Promise<void>

// Verify password (returns false if password is null — Google-only account)
export async function verifyPassword(customer: Customer, plainPassword: string): Promise<boolean>

// --- Refresh token management ---

// Store a refresh token hash
export async function storeRefreshToken(customerId: string, tokenHash: string, expiresAt: Date): Promise<void>

// Find refresh token by hash
export async function findRefreshToken(tokenHash: string): Promise<{ id: string; customerId: string; expiresAt: Date } | null>

// Delete a specific refresh token (on refresh — rotate)
export async function deleteRefreshToken(tokenHash: string): Promise<void>

// Delete all refresh tokens for a customer (on password change / compromise)
export async function revokeAllRefreshTokens(customerId: string): Promise<void>
```

Key details:
- Use `bcrypt.hash(password, 10)` for hashing in `createCustomer`
- Use `bcrypt.compare(plain, hash)` in `verifyPassword`
- Refresh tokens are stored as SHA-256 hashes (never store raw tokens)
- Use `crypto.createHash("sha256").update(token).digest("hex")` to hash tokens
- All queries use Drizzle's query builder, not raw SQL

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/daney/316-parts-store && npx tsc --noEmit --project tsconfig.json`

- [ ] **Step 3: Commit**

```bash
cd /Users/daney/316-parts-store
git add server/storage/customers.ts
git commit -m "feat: add customer storage module with registration, Google linking, refresh tokens"
```

---

## Task 6: Auth Routes — Register, Login, Google, Refresh, Profile

**Files:**
- Rewrite: `server/routes/auth.routes.ts`

- [ ] **Step 1: Read current auth routes**

Read `server/routes/auth.routes.ts` to understand the existing endpoints.

- [ ] **Step 2: Rewrite auth routes**

Complete rewrite with all auth endpoints. The route module should handle:

```
POST /api/store/auth/register        — Create account with email/password
POST /api/store/auth/login           — Login with email/password
POST /api/store/auth/google          — Login/register with Google idToken
POST /api/store/auth/refresh         — Refresh access token using refresh token
GET  /api/store/auth/me              — Get current customer profile (requires auth)
PATCH /api/store/auth/me             — Update profile (requires auth)
POST /api/store/auth/set-password    — Set/change password (requires auth)
```

Key implementation details:

**Register:**
- Validate: email (string, email format), password (min 8 chars), firstName, lastName required
- Check email uniqueness (409 if exists)
- Hash password with bcrypt
- Create customer
- Generate access + refresh tokens
- Store refresh token hash
- Return `{ customer, accessToken, refreshToken }`

**Login:**
- Find customer by email (401 if not found)
- Check `isActive` (403 if deactivated)
- Verify password (401 if wrong, or if password is null: "No password set. Sign in with Google or set a password from your account page")
- Generate tokens, store refresh token hash
- Return same shape as register

**Google:**
- Install and use `google-auth-library`: `const { OAuth2Client } = require("google-auth-library")`
- Verify `idToken` with `client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })`
- Extract email, given_name, family_name, picture from payload
- If customer exists by email: link Google account if `googleId` not set, issue tokens
- If customer exists by googleId: issue tokens
- If new: create Google customer, issue tokens
- Return same shape

**Refresh:**
- Verify refresh token JWT
- Hash the token, look it up in `refresh_tokens` table (401 if not found or expired)
- Delete the old refresh token (rotation)
- Find customer by ID (401 if not found or inactive)
- Generate new access + refresh tokens, store new refresh token hash
- Return `{ accessToken, refreshToken }`

**GET /me:** Return customer profile (exclude password)

**PATCH /me:** Update allowed fields (firstName, lastName, phone, address, parish)

**Set Password:**
- If customer already has a password: require `currentPassword` in body, verify it
- If no password (Google-only): allow setting without `currentPassword`
- Hash new password, update, revoke all refresh tokens (force re-login)

Use Zod for request body validation on all endpoints.

- [ ] **Step 3: Install google-auth-library**

```bash
cd /Users/daney/316-parts-store && npm install google-auth-library zod
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/daney/316-parts-store && npx tsc --noEmit --project tsconfig.json`

- [ ] **Step 5: Test manually with curl**

Start the dev server:
```bash
cd /Users/daney/316-parts-store && DATABASE_URL=mysql://root:@localhost:3306/partsstore JWT_SECRET=test-secret npm run dev:server
```

Test register:
```bash
curl -X POST http://localhost:5002/api/store/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123","firstName":"Test","lastName":"User"}'
```

Expected: 201 with `{ customer, accessToken, refreshToken }`

Test login:
```bash
curl -X POST http://localhost:5002/api/store/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

Expected: 200 with tokens

Test /me:
```bash
curl http://localhost:5002/api/store/auth/me \
  -H "Authorization: Bearer <accessToken from above>"
```

Expected: 200 with customer profile

- [ ] **Step 6: Commit**

```bash
cd /Users/daney/316-parts-store
git add server/routes/auth.routes.ts package.json package-lock.json
git commit -m "feat: complete auth routes — register, login, Google, refresh, profile, set-password"
```

---

## Task 7: Sync Storage Module

**Files:**
- Create: `server/storage/sync.ts`

- [ ] **Step 1: Create sync storage module**

This module manages the `sync_queue` and `sync_log` tables. Export:

```typescript
// --- Sync Queue ---

// Enqueue an outbound sync event
export async function enqueueSyncEvent(data: {
  endpoint: string;    // e.g., "/stock-decrement"
  method: string;      // "POST"
  payload: object;     // JSON body
}): Promise<string>    // returns queue item ID

// Get next pending event from queue (oldest first)
export async function getNextPendingEvent(): Promise<SyncQueueItem | null>

// Mark event as processing (prevents double-processing)
export async function markProcessing(id: string): Promise<void>

// Mark event as completed
export async function markCompleted(id: string): Promise<void>

// Mark event as failed, increment attempts, set next retry time
export async function markFailed(id: string, errorMessage: string): Promise<void>

// Get failed events for admin dashboard
export async function getFailedEvents(limit?: number): Promise<SyncQueueItem[]>

// Retry a specific failed event (admin action)
export async function retryEvent(id: string): Promise<void>

// Resolve a failed event (admin marks as manually handled)
export async function resolveEvent(id: string): Promise<void>

// Get queue stats (for admin dashboard)
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  failed: number;
  lastSuccess: Date | null;
}>

// --- Sync Log ---

// Log a sync event (success or failure)
export async function logSyncEvent(data: {
  direction: "inbound" | "outbound";
  entity: string;     // "product" | "stock"
  payload: object;
  status: "success" | "failed";
  errorMessage?: string;
}): Promise<void>
```

Key details:
- `markFailed` calculates next retry time using exponential backoff: `5s * 2^(attempts-1)` capped at 15 minutes. After 10 attempts, sets status to `failed` (terminal).
- `retryEvent` resets status to `pending`, resets attempts to 0, sets nextRetryAt to now.
- Use Drizzle's `sql` template for `UPDATE ... SET attempts = attempts + 1`.

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/daney/316-parts-store && npx tsc --noEmit --project tsconfig.json`

- [ ] **Step 3: Commit**

```bash
cd /Users/daney/316-parts-store
git add server/storage/sync.ts
git commit -m "feat: add sync storage module — queue management with exponential backoff"
```

---

## Task 8: Sync Inbound Routes — Product & Stock Sync from Garage

**Files:**
- Create: `server/routes/sync.routes.ts`

- [ ] **Step 1: Create inbound sync routes**

All routes protected by `validateSyncApiKey` middleware.

```
POST /api/sync/products        — Bulk upsert products with numbers, compatibility, images
POST /api/sync/products/:id    — Single product upsert
DELETE /api/sync/products/:id  — Unpublish (set isActive=false)
POST /api/sync/stock           — Batch stock level update
```

Key implementation for product upsert:
- Match on `garagePartId`
- If exists: UPDATE all product fields, DELETE and re-INSERT child records (numbers, compatibility, images)
- If new: INSERT product + child records
- Set `lastSyncedAt = new Date()`
- Wrap in a transaction
- Log to sync_log on success/failure
- Return `{ created: N, updated: N, errors: [] }`

Stock update:
- `UPDATE products SET quantity = ? WHERE garagePartId = ?`
- Batch operation: loop through updates array
- Log results

- [ ] **Step 2: Register sync routes in route index**

Add to `server/routes/index.ts`:
```typescript
import syncRoutes from "./sync.routes.js";
// ...
app.use(syncRoutes);
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/daney/316-parts-store && npx tsc --noEmit --project tsconfig.json`

- [ ] **Step 4: Test with curl**

```bash
curl -X POST http://localhost:5002/api/sync/products \
  -H "Content-Type: application/json" \
  -H "x-sync-api-key: test-sync-key" \
  -d '{"products":[{"garagePartId":"test-1","name":"Test Brake Pad","partNumber":"BP-001","salePrice":"4500.00","quantity":50,"lowStockThreshold":10,"condition":"new","isOversized":false,"isFeatured":false,"featuredSortOrder":0,"numbers":[],"compatibility":[],"images":[]}]}'
```

Expected: 200 with `{ created: 1, updated: 0, errors: [] }`

Verify the product was inserted:
```bash
mysql -u root partsstore -e "SELECT id, name, garagePartId FROM products;"
```

- [ ] **Step 5: Commit**

```bash
cd /Users/daney/316-parts-store
git add server/routes/sync.routes.ts server/routes/index.ts
git commit -m "feat: add inbound sync routes — product upsert and stock update from garage"
```

---

## Task 9: Outbound Sync — Garage Client & Queue Processor

**Files:**
- Create: `server/sync/garageClient.ts`
- Create: `server/sync/queueProcessor.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Create garage sync client**

HTTP client for outbound calls to the garage app.

```typescript
const GARAGE_SYNC_URL = process.env.GARAGE_SYNC_URL;  // e.g., "https://316-automotive.com/api/sync"
const GARAGE_SYNC_API_KEY = process.env.GARAGE_SYNC_API_KEY;

// Send stock decrement to garage
export async function sendStockDecrement(data: {
  garagePartId: string;
  quantity: number;
  orderId: string;
  orderNumber: string;
}): Promise<{ success: boolean; error?: string }>

// Send stock restore to garage
export async function sendStockRestore(data: {
  garagePartId: string;
  quantity: number;
  orderId: string;
  reason: string;
}): Promise<{ success: boolean; error?: string }>
```

Both functions:
- POST to `${GARAGE_SYNC_URL}/stock-decrement` or `/stock-restore`
- Include `x-sync-api-key` header
- 10-second timeout via `AbortSignal.timeout(10000)`
- Return `{ success: true }` on 200, `{ success: false, error: message }` on failure
- Never throw — always return a result object

- [ ] **Step 2: Create queue processor**

Background worker that processes the outbound sync queue.

```typescript
import { getNextPendingEvent, markProcessing, markCompleted, markFailed } from "../storage/sync.js";
import { sendStockDecrement, sendStockRestore } from "./garageClient.js";

export async function processNextSyncEvent(): Promise<boolean> {
  // 1. Get next pending event where nextRetryAt <= now
  // 2. Mark as processing
  // 3. Based on endpoint, call garageClient
  // 4. On success: markCompleted, log to sync_log
  // 5. On failure: markFailed (handles backoff + max attempts), log to sync_log
  // Returns true if an event was processed, false if queue is empty
}

export function startQueueProcessor(intervalMs: number = 30000): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      // Process up to 10 events per cycle
      let processed = 0;
      while (processed < 10) {
        const didProcess = await processNextSyncEvent();
        if (!didProcess) break;
        processed++;
      }
      if (processed > 0) console.log(`[sync] Processed ${processed} outbound sync events`);
    } catch (error) {
      console.error("[sync] Queue processor error:", error);
    }
  }, intervalMs);
}
```

- [ ] **Step 3: Wire up queue processor in server/index.ts**

Add to the `startCronJobs()` function in `server/index.ts`:

```typescript
import { startQueueProcessor } from "./sync/queueProcessor.js";

// Inside startCronJobs():
startQueueProcessor(30000);  // Every 30 seconds
console.log("[cron] Scheduled: sync queue processor (30s)");
```

- [ ] **Step 4: Verify it compiles**

Run: `cd /Users/daney/316-parts-store && npx tsc --noEmit --project tsconfig.json`

- [ ] **Step 5: Commit**

```bash
cd /Users/daney/316-parts-store
git add server/sync/garageClient.ts server/sync/queueProcessor.ts server/index.ts
git commit -m "feat: add outbound sync — garage client, queue processor with exponential backoff"
```

---

## Task 10: Helper — Enqueue Stock Sync on Order Events

**Files:**
- Create: `server/sync/stockSync.ts`

This is a thin helper that other modules (orders, POS, returns) will call when stock changes need to be synced to the garage.

- [ ] **Step 1: Create stockSync helper**

```typescript
import { enqueueSyncEvent } from "../storage/sync.js";

/**
 * Enqueue a stock decrement event for the garage.
 * Called when: online order placed, POS sale completed.
 */
export async function enqueueStockDecrement(items: Array<{
  garagePartId: string;
  quantity: number;
}>, orderId: string, orderNumber: string): Promise<void> {
  for (const item of items) {
    if (!item.garagePartId) continue;  // Skip products not synced from garage
    await enqueueSyncEvent({
      endpoint: "/stock-decrement",
      method: "POST",
      payload: {
        garagePartId: item.garagePartId,
        quantity: item.quantity,
        orderId,
        orderNumber,
      },
    });
  }
}

/**
 * Enqueue a stock restore event for the garage.
 * Called when: order cancelled, return received and restocked.
 */
export async function enqueueStockRestore(items: Array<{
  garagePartId: string;
  quantity: number;
}>, orderId: string, reason: string): Promise<void> {
  for (const item of items) {
    if (!item.garagePartId) continue;
    await enqueueSyncEvent({
      endpoint: "/stock-restore",
      method: "POST",
      payload: {
        garagePartId: item.garagePartId,
        quantity: item.quantity,
        orderId,
        reason,
      },
    });
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/daney/316-parts-store && npx tsc --noEmit --project tsconfig.json`

- [ ] **Step 3: Commit**

```bash
cd /Users/daney/316-parts-store
git add server/sync/stockSync.ts
git commit -m "feat: add stock sync helpers — enqueueStockDecrement and enqueueStockRestore"
```

---

## Task 11: Update CI/CD Pipeline for Migrations

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Create: `scripts/run-migrations.js`

- [ ] **Step 1: Create migration runner script**

```javascript
#!/usr/bin/env node
/**
 * Run Drizzle migrations against the parts store database.
 * Used by CI/CD pipeline before deployment.
 */
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL must be set");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const connection = await mysql.createConnection(url);
  const db = drizzle(connection);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./migrations" });

  console.log("Migrations complete.");
  await connection.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Update deploy.yml to add migration step**

Add a `migrate` job between `check` and `build` in `.github/workflows/deploy.yml`:

```yaml
  migrate:
    name: Run Migrations
    runs-on: ubuntu-latest
    needs: check
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - name: Run migrations
        env:
          DATABASE_URL: ${{ secrets.PARTS_STORE_DATABASE_URL }}
        run: node --import tsx scripts/run-migrations.js
```

Update the `build` job to `needs: [check, migrate]`.

- [ ] **Step 3: Commit**

```bash
cd /Users/daney/316-parts-store
git add scripts/run-migrations.js .github/workflows/deploy.yml
git commit -m "feat: add migration runner and CI/CD migration step"
```

---

## Task 12: Update CLAUDE.md with New Architecture

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Key updates:
- Database section: now points to independent `partsstore` database
- Schema section: explain that `server/schema.ts` is the source of truth (not a mirror)
- Migration section: add `npm run db:generate:named` and `npm run db:migrate` commands
- Auth section: explain customer-based JWT, Google sign-in, admin email list
- Sync section: explain inbound and outbound sync, queue processor
- Add new storage modules and route modules to the architecture section
- Update common pitfalls: no shared database, schema changes are owned here now

- [ ] **Step 2: Commit**

```bash
cd /Users/daney/316-parts-store
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for independent database architecture"
```

---

## Verification Checklist (Plan 1 Complete When All Pass)

1. [ ] `partsstore` database exists locally with all 34 tables
2. [ ] `npm run check` passes (TypeScript compiles)
3. [ ] Customer can register via `POST /api/store/auth/register` → gets JWT tokens
4. [ ] Customer can login via `POST /api/store/auth/login` → gets JWT tokens
5. [ ] `GET /api/store/auth/me` with valid token → returns customer profile
6. [ ] `PATCH /api/store/auth/me` → updates profile
7. [ ] `POST /api/store/auth/set-password` → changes password
8. [ ] `POST /api/store/auth/refresh` → returns new token pair, old refresh token invalidated
9. [ ] `POST /api/sync/products` with valid API key → creates products in database
10. [ ] `POST /api/sync/stock` with valid API key → updates product quantities
11. [ ] `DELETE /api/sync/products/:id` → sets product `isActive=false`
12. [ ] Sync endpoints reject requests without valid `x-sync-api-key` → 401
13. [ ] Outbound sync queue processes events (mock garage endpoint or verify queue entries)
14. [ ] Migration runs successfully via `scripts/run-migrations.js`
