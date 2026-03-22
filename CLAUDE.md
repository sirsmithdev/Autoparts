# Parts Store — CLAUDE.md

This is the **online parts store** for 316 Automotive. It runs as a standalone service with its own repo, Docker image, database, and deployment pipeline — fully independent from `316-garage-webapp`.

## Architecture

```
316-parts-store/
├── server/           # Express API server
│   ├── index.ts      # Entry point (serves API + Next.js in production)
│   ├── db.ts         # Drizzle ORM client (connects to partsstore database)
│   ├── schema.ts     # Source-of-truth Drizzle table definitions for this service
│   ├── auth.ts       # JWT token creation/verification, admin email check
│   ├── middleware.ts  # Customer auth, admin guard, sync API key validation
│   ├── paymentCallbackUtils.ts  # Payment callback helpers
│   ├── routes/       # 8 Express route modules
│   │   ├── auth.routes.ts      # Register, login, Google sign-in, refresh, profile
│   │   ├── catalog.routes.ts   # Product listing, search, makes/models
│   │   ├── cart.routes.ts      # Server-side cart CRUD
│   │   ├── checkout.routes.ts  # Order placement, payment (PowerTranz HPP)
│   │   ├── orders.routes.ts    # Customer order history, cancel
│   │   ├── returns.routes.ts   # Return requests
│   │   ├── admin.routes.ts     # Admin: order management, returns, settings
│   │   ├── sync.routes.ts     # Inbound product/stock sync from garage
│   │   └── index.ts            # Registers all route modules
│   ├── storage/
│   │   ├── catalog.ts          # Product catalog queries
│   │   ├── customers.ts        # Customer CRUD, Google linking, refresh tokens
│   │   ├── onlineStore.ts      # Cart, orders, returns, delivery zones
│   │   └── sync.ts             # Sync queue and log operations
│   └── sync/
│       ├── garageClient.ts     # Outbound HTTP client for garage stock sync
│       ├── queueProcessor.ts   # Background sync queue processor (30s interval)
│       └── stockSync.ts        # Stock sync helpers (enqueue decrement/restore)
├── client/           # Next.js 15 App Router (React 19)
│   ├── src/app/      # Pages (/, /search, /parts/[id], /cart, /checkout, /orders, etc.)
│   ├── src/components/  # Shared UI components
│   ├── src/hooks/    # useAuth, useCart, useVehicleSelection
│   └── src/lib/      # api client, utils
├── shared/           # Shared types between server and client
├── migrations/       # Drizzle migration SQL files (owned by this repo)
├── .github/workflows/deploy.yml  # CI/CD pipeline
├── drizzle.config.ts # Drizzle Kit config (schema, migrations, MySQL dialect)
├── Dockerfile        # Multi-stage build (node:20-alpine)
├── package.json      # Root (Express server deps)
└── tsconfig.json     # Server-only TypeScript config
```

**Key design decisions:**
- **Standalone repo**: Own git repo, own CI/CD, own Docker image — fully independent from `316-garage-webapp`
- **Independent database**: Uses its own `partsstore` database on the same DigitalOcean MySQL cluster. No shared tables with the garage app
- **Schema ownership**: `server/schema.ts` is the source of truth. Migrations are generated and applied from this repo
- **Sync-based data flow**: Garage pushes product catalog via inbound sync API; store pushes stock changes back via outbound queue
- **Next.js custom server**: In production, Express serves both API routes and Next.js pages in a single process. Next.js pages are mounted at `/parts/*` via `basePath: "/parts"`
- **In development**: Express API runs on port 5002, Next.js dev server runs on port 3001 with proxy rewrites

## Common Commands

```bash
npm run dev              # Runs both Express (port 5002) and Next.js (port 3001) concurrently
npm run dev:server       # Express API only (tsx watch)
npm run dev:client       # Next.js dev only (port 3001)

npm run check            # Type-checks both server (tsc) and client (tsc)

npm run build            # Builds server (esbuild) + client (next build)
npm run build:server     # esbuild → dist/server.js
npm run build:client     # next build

npm run start            # NODE_ENV=production node dist/server.js (port 5002)

npm run install:all      # Install both root + client deps

npm run db:generate:named "description"  # Generate a named migration
npm run db:migrate                       # Apply pending migrations
```

## Deployment

**CI/CD Pipeline** (`.github/workflows/deploy.yml`):

Pushing to `main` triggers:
```
1. Type Check    → npm run check
2. Build & Push  → Docker build → push to DOCR (DigitalOcean Container Registry)
3. Migrate       → drizzle-kit migrate against production database
4. Deploy        → doctl apps create-deployment → health check verification
```

**Container details:**
- **Image**: Built from `Dockerfile` (multi-stage node:20-alpine)
- **Port**: 5002
- **Health check**: `GET /health`
- **basePath**: Next.js pages served under `/parts` in production
- **Non-root user**: Runs as `appuser` (UID 1001) for security
- **Domain**: `parts.316-automotive.com`

**Docker build:**
```bash
docker build -t 316-parts-store .
```

**Environment variables required in production:**
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL connection string (partsstore database) |
| `JWT_SECRET` | Secret for signing JWTs |
| `NODE_ENV` | `production` |
| `PORT` | `5002` (or override) |
| `BASE_URL` | `https://316-automotive.com` (for CORS) |
| `SYNC_API_KEY` | Validates inbound sync requests from garage |
| `GARAGE_SYNC_URL` | Garage app's sync endpoint (e.g. `https://316-automotive.com/api/sync`) |
| `GARAGE_SYNC_API_KEY` | Authenticates outbound sync requests to garage |
| `GOOGLE_CLIENT_ID` | Google Sign-In client ID |
| `STORE_ADMIN_EMAILS` | Comma-separated admin email addresses |
| `GARAGE_AUTH_URL` | Garage app's credential verification endpoint (e.g. `https://316-automotive.com/api/auth/verify-credentials`) |
| `RESEND_API_KEY` | Resend API key for transactional emails |
| `FROM_EMAIL` | Sender email address (default: `orders@316-automotive.com`) |
| `POWERTRANZ_*` | Payment gateway credentials (if checkout is enabled) |

**GitHub Secrets** (repo → Settings → Secrets):
- `DIGITALOCEAN_ACCESS_TOKEN` — for DOCR and App Platform deploys
- `PRODUCTION_DATABASE_URL` — for running migrations in CI

**GitHub Variables**:
- `NEXT_PUBLIC_TWS_KEY` — PowerTranz tokenization key (baked into client build)

## Database

This service owns an independent `partsstore` database on the same DigitalOcean Managed MySQL cluster as the garage app. There are no shared tables.

- **Schema**: `server/schema.ts` is the single source of truth
- **Migrations**: Generated via `npm run db:generate:named "description"`, applied via `npm run db:migrate`
- **Config**: `drizzle.config.ts` points to `./server/schema.ts` and outputs to `./migrations/`
- **Connection**: `server/db.ts` creates a connection pool with SSL support (CA cert or `DB_SSL_REJECT_UNAUTHORIZED`)

**Tables owned by this service**: `customers`, `refresh_tokens`, `products`, `product_numbers`, `product_compatibility`, `product_images`, `shopping_carts`, `shopping_cart_items`, `online_store_orders`, `online_store_order_items`, `delivery_zones`, `online_store_returns`, `online_store_return_items`, `online_store_settings`, `pricing_settings`, `stock_movements`, `stock_receipts`, `stock_receipt_items`, `pick_lists`, `pick_list_items`, `pos_sessions`, `pos_transactions`, `pos_transaction_items`, `sync_queue`, `sync_log`

**Adding new tables or columns:**
1. Edit `server/schema.ts`
2. Run `npm run db:generate:named "describe_change"`
3. Review generated SQL in `migrations/`
4. Apply locally: `npm run db:migrate`
5. Commit the migration file — CI applies it to production before deploy

## Authentication

The parts store has its own customer-based JWT authentication, completely separate from the garage app's session-based auth.

- **Customers table**: Own `customers` table (not the garage `users` table)
- **Registration**: Email/password, Google Sign-In, or **316 Automotive account** (cross-app login)
- **Email verification**: On registration, a verification email is sent via Resend with a signed JWT link (24h expiry). Verified status stored in `emailVerified` column
- **Tokens**: Access token (15m expiry) + refresh token (7d expiry)
- **Refresh flow**: Token rotation with server-side storage — old token is deleted, new pair issued
- **Revocation**: Refresh tokens stored as SHA-256 hashes in `refresh_tokens` table; `revokeAllRefreshTokens()` for password changes
- **Admin**: Determined by `STORE_ADMIN_EMAILS` env var (comma-separated), checked at token issuance
- **Google linking**: Existing email/password customers can link their Google account
- **316 Automotive login**: Customers with existing garage accounts can sign in via `POST /api/store/auth/316-login`. Credentials are verified against the garage API (`GARAGE_AUTH_URL`), and the parts store creates/links a local customer record. Auto-links by email if the customer already exists. Linked via `garageUserId` column

**Key files:**
- `server/auth.ts` — Token creation/verification (access, refresh, email_verify), admin email check
- `server/middleware.ts` — `authenticateToken`, `optionalAuth`, `requireAdmin`, `validateSyncApiKey`
- `server/storage/customers.ts` — Customer CRUD, password hashing, refresh token management, garage account linking
- `server/routes/auth.routes.ts` — Register, login, 316 login, Google sign-in, refresh, verify email, profile endpoints
- `server/sync/garageAuth.ts` — HTTP client for verifying credentials against the 316 garage app
- `server/email.ts` — Resend-powered transactional emails (verification, welcome, order lifecycle)

## Sync API

Data flows between the garage app and the parts store via API-based sync, not shared database access.

### Inbound (garage → store)

The garage app pushes product catalog data and stock levels to the parts store.

- **Routes**: `server/routes/sync.routes.ts`
- **Auth**: `x-sync-api-key` header validated against `SYNC_API_KEY` env var
- **Endpoints**:
  - `POST /api/sync/products` — Bulk product upsert (with numbers, compatibility, images)
  - `POST /api/sync/products/:garagePartId` — Single product upsert
  - `DELETE /api/sync/products/:garagePartId` — Soft-delete (sets `isActive = false`)
  - `POST /api/sync/stock` — Batch stock level updates
- Products are linked via `garagePartId` (the garage's `parts_inventory.id`)

### Outbound (store → garage)

The store notifies the garage when stock changes due to online sales, cancellations, or returns.

- **Enqueue**: `server/sync/stockSync.ts` — `enqueueStockDecrement()` and `enqueueStockRestore()` create queue entries
- **Process**: `server/sync/queueProcessor.ts` — Polls `sync_queue` every 30s, processes up to 10 events per tick
- **Send**: `server/sync/garageClient.ts` — HTTP client that POSTs to `GARAGE_SYNC_URL` with `GARAGE_SYNC_API_KEY`
- **Storage**: `server/storage/sync.ts` — Queue management (enqueue, mark processing/completed/failed, retry)

**Retry behavior:**
- Exponential backoff: 5s base, doubling up to 15m max
- Max 10 attempts before marking as terminally `failed`
- Admin can retry or manually resolve failed events via admin dashboard

**Audit trail**: All sync events (inbound and outbound) are logged to the `sync_log` table with direction, entity, payload, and status.

## Frontend Stack

- **Next.js 15** with App Router (React 19)
- **Tailwind CSS 3.4** with shadcn/ui-style CSS variables
- **Radix UI** primitives (dialog, dropdown, tabs, separator, select, switch, toast, label, slot)
- **TanStack React Query** for data fetching
- **Zustand** for client-side state (vehicle selection persistence)
- **Lucide React** icons
- **date-fns** for date formatting
- **react-hook-form** for forms
- **Design**: FCP Euro-inspired with dark header, prominent vehicle selector, fitment badges

## Key Patterns

### API Client
```typescript
import { api } from "@/lib/api";
const data = await api<ResponseType>("/api/store/endpoint");
```
The `api()` function automatically attaches JWT tokens and handles refresh.

### Guest vs Server Cart
- **Guest cart**: Zustand store with localStorage persistence (`useGuestCart`)
- **Server cart**: API-backed for logged-in users, queried via React Query
- On login, guest cart items are merged to server cart via `mergeGuestCartToServer()`

### Vehicle Selection
```typescript
import { useVehicleSelection, hasVehicleSelected } from "@/hooks/useVehicleSelection";
```
Zustand store with localStorage persistence. Used in header, search filters, and part detail fitment banners.

### Adding a New Page
1. Create the page in `client/src/app/{route}/page.tsx`
2. Use `"use client"` directive for interactive pages
3. Wrap in `max-w-7xl mx-auto px-4 sm:px-6 py-8` container
4. Add `<Breadcrumbs>` at the top
5. Use the same color tokens (`bg-card`, `text-muted-foreground`, `border`, etc.)
6. Protect auth-required pages with the `useAuth` + `useEffect` redirect pattern

### Adding API Routes
1. Add handler in the appropriate `server/routes/*.routes.ts` file
2. Register new route modules in `server/routes/index.ts`
3. Use `authenticateToken` middleware for protected routes
4. Use `requireAdmin` middleware for admin-only routes
5. Routes follow `/api/store/*` prefix convention

## Common Pitfalls

1. **Schema ownership**: This repo owns its schema. Run `npm run db:generate:named` and `npm run db:migrate` from here — not from the garage webapp
2. **No shared database**: All data lives in the `partsstore` database. There are no shared tables with the garage app
3. **Products must be synced**: Products don't appear in the catalog until the garage pushes them via `/api/sync/products`. There is no manual product creation UI
4. **Outbound sync failures**: Failed stock sync events are queued and retried automatically. Check the admin dashboard for terminally failed events (10 attempts exhausted)
5. **basePath in production**: All Next.js pages are under `/parts` in production. Client-side `<Link>` components handle this automatically, but any hardcoded URLs must account for it
6. **Two tsconfigs**: The root `tsconfig.json` covers server code only. Client has its own `client/tsconfig.json` with `@/*` path aliases
7. **esbuild externals**: Server build externalizes `next`, `mysql2`, `better-sqlite3`, and all node_modules packages — they're installed at runtime
8. **CORS**: Dev allows localhost:3001 and localhost:5001. Production only allows `BASE_URL`
9. **Port confusion**: Parts store uses 5002, main app uses 5001 (dev) / 5000 (production)
10. **DB SSL**: Set `DB_SSL_REJECT_UNAUTHORIZED=false` when connecting to DigitalOcean MySQL locally (self-signed certs)
