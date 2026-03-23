# 316 Auto Parts Store — Enterprise Readiness Audit

**Date:** 2026-03-22
**Audited by:** Claude Opus 4.6
**Scope:** Full system audit — customer flows, admin operations, warehouse, POS, returns, sync, security, mobile readiness

---

## CRITICAL — Actively Broken (7)

| # | System | Issue | Impact |
|---|--------|-------|--------|
| 1 | Checkout | **Checkout has no payment input UI** — the page submits without card details. Orders are created in `pending_payment` and navigated away from as if paid. No customer can ever pay. | No revenue possible |
| 2 | Checkout | **No postMessage listener for 3DS callback** — even if payment were initiated via PowerTranz popup, the parent window has no `addEventListener("message", ...)` to receive the result | Payment flow dead-end |
| 3 | Cart | **Guest cart merge field name mismatch** (`partId` vs `productId`) — `mergeGuestCartToServer()` sends `partId` but server expects `productId`. All guest cart items silently dropped on login | Cart data loss on every login |
| 4 | Returns | **Return form sends items without per-item reason** — the client constructs items array without `reason` field but Zod schema requires it. Every return submission fails validation | Returns completely broken |
| 5 | Auth | **Google Sign-In button has no onClick handler** — the server route (`POST /api/store/auth/google`) works but the client button is a static `<button>` with no event. No Google Identity Services initialization | Feature advertised but non-functional |
| 6 | Security | **`dangerouslySetInnerHTML` without sanitization** on product `longDescription` — if the garage app pushes HTML with script tags, they execute in the customer's browser | XSS vulnerability |
| 7 | Security | **No rate limiting** on any endpoint — auth, checkout, catalog all unlimited. Brute-force login attacks and enumeration are unrestricted | Brute-force vulnerability |

---

## HIGH — Advertised But Not Wired (14)

| # | System | Issue | Impact |
|---|--------|-------|--------|
| 8 | Auth | **No password reset flow** — "Forgot your password?" link is `href="#"`. No forgot-password page, no reset token, no reset email, no API endpoint | Customer lockout if password forgotten |
| 9 | Auth | **Email verification unenforced** — `emailVerified` field exists in schema but is never checked. Unverified customers can place orders | Spam/fraud risk, bad email addresses in orders |
| 10 | Cart | **Coupon code UI on cart page + homepage PARTS316 banner — no backend** — no `coupons` table, no redemption logic, no checkout integration. Apply Coupon button does nothing | Misleading customers, trust damage |
| 11 | Cart | **Free shipping bar is hardcoded** ($15K threshold, $1,500 flat rate) — not fetched from store settings or delivery zones, not enforced at checkout API level | False promise, checkout total differs |
| 12 | Products | **Star ratings hardcoded to 4 stars** on every product — `StarRating` component always renders 4 filled stars with "4 reviews" text. No `product_reviews` table exists | Deceptive, no real review system |
| 13 | Homepage | **Category item counts use `Math.random()`** — `Math.floor(Math.random() * 10) + 2` renders different numbers on every page load | Visually broken, unprofessional |
| 14 | Email | **`sendOrderConfirmedEmail()` is defined but never called** — the function exists in `email.ts` but `confirmOrder()` in `orders.ts` doesn't invoke it | Customer not notified when order confirmed |
| 15 | Email | **No order cancellation email** — `cancelOrder()` changes status and restores stock but sends no email to customer | Customer doesn't know order was cancelled |
| 16 | Checkout | **Payment redirect paths are basePath-unaware** — `buildRedirectPage` uses `/checkout/failure` instead of `/parts/checkout/failure` in production | 3DS callback navigates to wrong URL |
| 17 | Checkout | **Tax shown as "Calculated by server"** pre-submit — customer sees subtotal + delivery only, but actual charge includes tax. Pre-checkout total is always lower than actual | Trust issue, surprise charges |
| 28 | Returns | **`refundReturn()` doesn't call PowerTranz** — marks return as "refunded" in DB and sends email, but no actual money moves back to customer's card | Staff must manually refund via payment terminal |
| 29 | Returns | **"Store credit" is a status flag only** — no `store_credit_balance` table, no mechanism to apply credit at checkout, no customer-visible balance | Feature exists in admin UI but does nothing |
| 34 | POS | **No card payment integration** — `cardTransactionId` column exists but is never populated. No PowerTranz call for in-store card sales. Card sales recorded but no charge processed | Revenue leakage on in-store card transactions |
| 36 | Warehouse | **Inbound stock sync overwrites `products.quantity` without updating `product_bin_assignments`** — when garage pushes stock levels, bin totals drift out of sync with product quantity | Inventory accuracy degrades over time |

---

## MEDIUM — Missing for Real-World Readiness (20)

| # | System | Issue | Impact |
|---|--------|-------|--------|
| 18 | Customer Service | **No contact form** — no `/contact` page, no `POST /api/store/contact` endpoint, no way for customers to reach support online | Can't get help |
| 19 | Vehicles | **No saved vehicles (multi-garage)** — only one vehicle persisted in Zustand localStorage. No server-side saved vehicles table | Single vehicle only, can't switch between cars |
| 20 | Engagement | **No wishlist** — no schema table, no API route, no UI. Save-for-later is a core e-commerce feature | No save-for-later capability |
| 21 | SEO | **No structured data (JSON-LD)** — no `Product`, `Offer`, `BreadcrumbList`, or `Organization` schema markup on any page | Invisible to Google rich results (price, availability) |
| 22 | SEO | **No sitemap.xml or robots.txt** — no `app/sitemap.ts`, no static files. Search engines can't efficiently discover products | Poor crawlability, slow indexing |
| 23 | Email | **No abandoned cart recovery email** — stale cart cleanup cron deletes old carts but never sends a reminder email first | Lost revenue from abandoned checkouts |
| 24 | Returns | **No actual payment gateway refund call** — refund is bookkeeping only. Same as #28 but emphasizing the technical gap | Manual refund process required |
| 25 | Security | **`contentSecurityPolicy: false` in Helmet** — CSP header is completely disabled, negating browser-level XSS protection | XSS protection disabled |
| 26 | Sync | **"Processing" sync queue events stuck permanently after server crash** — no startup cleanup to reset stale processing events back to pending | Manual admin intervention required after any restart |
| 27 | Warehouse | **Inbound stock sync overwrites `products.quantity` without updating bin assignments** — same root cause as #36 | Bin totals drift |
| 30 | Returns | **Customer can't submit return shipping tracking** — `markReturnShippedBack` is admin-only. No customer-facing endpoint to provide tracking number | Customer must call/email to confirm shipment |
| 31 | Returns | **No return rejection email** — customer submits return, admin rejects it, customer receives no notification | Customer left wondering about return status |
| 32 | Returns | **No return submission confirmation email** — customer submits return request but gets no email acknowledging it | Customer doesn't know submission went through |
| 33 | POS | **"Split" payment method accepted but not properly handled** — cash/card portions not tracked separately. Accounting can't reconcile split payments | Accounting inaccuracy |
| 35 | POS | **No receipt printing or digital receipt** — no receipt endpoint, no PDF generation, no email receipt for walk-in POS sales | No proof of purchase for walk-in customers |
| 38 | Warehouse | **No stock reconciliation tool** — no way to compare sum of bin quantities vs `products.quantity` and fix drift from #36 | No way to correct inventory discrepancies |
| 39 | Sync | **"Processing" sync queue events stuck after crash** — duplicate of #26, same root cause | Same as #26 |
| 43 | Mobile | **No dedicated mobile API versioning** — all endpoints are `/api/store/*` with no version prefix. Breaking changes would affect all clients simultaneously | Can't evolve API safely once mobile app ships |
| 44 | Mobile | **No push notification infrastructure** — no FCM/APNs token storage, no device registration endpoint, no push send capability | No way to notify mobile users |
| 45 | Mobile | **No device/session management** — refresh tokens have no device identifier. No "logged in devices" list, no remote logout per device | Can't manage mobile sessions separately |
| 46 | Mobile | **No mobile-optimized image endpoints** — no image resizing, no CDN integration. Product images served at full resolution | Slow load times on mobile data connections |
| 49 | Mobile | **No barcode/QR scan endpoint** — POS has product lookup by barcode but no customer-facing scan-to-find-part feature | Missing key mobile differentiator |

---

## LOW — Nice to Have (9)

| # | System | Issue | Impact |
|---|--------|-------|--------|
| 37 | Warehouse | **No manual pick list creation route** — pick lists are only auto-generated from orders. No API to create ad-hoc pick tasks | Can't create pick lists for non-order purposes |
| 40 | Sync | **No cleanup of old completed sync queue/log records** — tables grow unbounded over time | Database bloat, query slowdown over months |
| 42 | Orders | **No order picked-up email** — when customer collects an order, no notification is sent | Minor communication gap |
| 47 | Mobile | **No offline-friendly catalog endpoint** — no bulk/delta product sync, no `lastModified` headers or ETags for caching | Mobile app can't cache effectively |
| 48 | Mobile | **No deep link / universal link support** — no `/.well-known/apple-app-site-association` or `assetlinks.json` | Can't open app from shared links |
| 50 | Mobile | **No app version check endpoint** — no way to enforce minimum app version or show update prompts | Can't force updates for breaking changes |

---

## Additional Enterprise Gaps (Not Numbered — Future Roadmap)

### Search & Discovery
- No fuzzy search (typo tolerance) — strict `LIKE '%term%'` only
- No autocomplete/typeahead suggestions endpoint
- No VIN decode integration despite schema support
- No search history tracking
- Vehicle compatibility filter uses N+2 query pattern that breaks pagination counts

### Product Presentation
- No image zoom/pan on product detail
- No video support in product images
- No structured specifications table (dimensions, material, torque specs)
- No "Related Products" or "Frequently Bought Together"
- No installation guides or PDF attachments

### Pricing & Promotions
- No original/compare-at price column — can't show "Was $X, Now $Y"
- No quantity tier/bulk pricing
- No sale/promotional pricing system with date ranges
- No pricing engine — price comes directly from garage sync

### Shipping
- No real-time carrier rate calculation (all flat rates per zone)
- No express/same-day delivery option
- No carrier tracking deep-links (tracking number shown as plain text)
- No estimated delivery date shown during browsing
- Free shipping threshold not enforced at API level

### Payment
- Only PowerTranz — no PayPal, Apple Pay, Google Pay, cash-on-delivery
- No payment installments (buy-now-pay-later)
- No order splitting across payment methods
- Saved card management UI missing (backend exists)

### Engagement
- No product reviews/ratings system
- No recently viewed products
- No product comparison feature
- No back-in-stock email alerts
- No loyalty/points system

### SEO & Marketing
- No Open Graph or Twitter card meta tags
- No canonical tags for duplicate URLs
- No Google Tag Manager / GA4 / Meta Pixel
- No blog CMS (3 hardcoded static blog cards)
- Homepage stats hardcoded ("5,000+ Parts", "500+ Vehicles")

### Analytics
- No revenue/sales reporting dashboard
- No popular products report
- No customer analytics (new vs returning, AOV, LTV)
- No conversion funnel tracking
- No inventory health report

### Customer Service
- No live chat integration
- No ticket/support system for general inquiries
- FAQ is hardcoded HTML, not editable by staff
- Phone number appears to be placeholder (`(876) 555-0316`)

---

## Summary by System

| System | Functional | Issues |
|--------|-----------|--------|
| **Checkout/Payment** | Server-side PowerTranz, order creation, stock reservation | #1, #2, #16, #17 |
| **Cart** | Guest cart, server cart, merge endpoint | #3, #10, #11 |
| **Auth** | Login, register, garage login, token refresh | #5, #8, #9 |
| **Returns** | Full lifecycle state machine, window enforcement | #4, #28, #29, #30, #31, #32 |
| **POS** | Sessions, sales, voids, refunds, held carts, reports | #33, #34, #35 |
| **Warehouse** | Locations, bins, movements, transfers, pick lists | #36, #37, #38 |
| **Sync** | Inbound products, outbound stock queue, retry | #26, #39, #40 |
| **Email** | 10 transactional emails via Resend | #14, #15, #23, #31, #32 |
| **Security** | Helmet, CORS, JWT, Zod validation, bcrypt | #6, #7, #25 |
| **SEO** | Basic meta tags on product pages | #21, #22 |
| **Mobile** | REST API consumable by mobile apps | #43-50 |
| **Homepage** | Full AUTONEX design with all sections | #12, #13 |

---

## Recommended Fix Priority

### Phase 1: Make it work (Critical #1-7)
Fix checkout payment flow, cart merge, return form, Google sign-in, XSS sanitization, rate limiting.

### Phase 2: Make it honest (High #8-17, #28-29, #34, #36)
Password reset, email enforcement, remove fake coupons/ratings/stats, wire missing emails, fix payment redirects, POS card integration, warehouse sync.

### Phase 3: Make it complete (Medium #18-46)
Contact form, wishlist, SEO, abandoned cart emails, store credit system, return tracking, POS receipts, stock reconciliation, mobile infrastructure.

### Phase 4: Make it competitive (Low + Future)
Fuzzy search, reviews, promotions engine, carrier integration, analytics dashboard, live chat, mobile app support.

---

## Planned Features (In Progress)

### Google Places Autocomplete + Geocoding
- **Status:** Planned
- **Scope:** Replace free-text address fields on checkout and account pages with Google Places Autocomplete (New API). Use Geocoding to auto-detect delivery zone from coordinates.
- **Env var:** `GOOGLE_MAPS_API_KEY` (to be configured in DigitalOcean App Platform)
- **Files affected:** checkout page, account page, checkout API, new `AddressAutocomplete` component
- **Package:** `@googlemaps/js-api-loader` or `@react-google-maps/api`

### QR Code Pickup Flow
- **Status:** Planned
- **Scope:** When admin marks order as "ready for pickup", system generates a unique pickup code + QR code. Customer receives QR in email and sees it on order detail page. Staff scans QR to pull up order and mark as collected.
- **Schema change:** Add `pickupCode` (varchar, unique) to `onlineStoreOrders`
- **Flow:** Order ready → QR generated → emailed to customer → shown on order page → staff scans → order marked picked up
- **Package:** `qrcode` (server-side generation), `qrcode.react` (client-side display)
- **Files affected:** schema, orders storage, admin routes, email templates, order detail page, new scan verification endpoint
