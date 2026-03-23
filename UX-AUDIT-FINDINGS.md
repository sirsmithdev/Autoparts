# UX Audit — Missing Buttons, Actions, and Incomplete Features

**Date:** 2026-03-23
**Scope:** Every page in the customer store, admin panel, and POS

---

## CRITICAL — Broken navigation, dead links, missing actions (24)

### Customer Store

| # | Page | Issue |
|---|------|-------|
| 1 | StoreHeader | "Blog" nav links to `/diagrams` which 404s |
| 2 | StoreHeader | "Contact" nav links to `/` (homepage) instead of `/contact` |
| 3 | StoreHeader | "Tires & Wheels" links to `?category=Brakes` (wrong category) |
| 4 | StoreHeader | "Headlights & Lighting" links to `?category=Electrical` (wrong) |
| 5 | StoreHeader | "Best Seller" uses `?sort=popular` but API uses `orderBy` param |
| 6 | StoreHeader | Wishlist heart button is dead UI (no onClick, no href) |
| 7 | StoreFooter | "Refund and Returns Policy" links to `/policies/returns` which 404s |
| 8 | StoreFooter | "OEM Diagrams" links to `/diagrams` which 404s |
| 9 | StoreFooter | Social icons (Facebook, Instagram, Twitter) all `href="#"` |
| 10 | StoreFooter | No link to `/contact` page in footer |
| 11 | Homepage | Blog "View All" is `href="#"`, blog cards not clickable |
| 12 | Homepage | "Recently Added" shows same products as "Top Hot Right Now" |
| 13 | Homepage | "24/7 Support" text contradicts "Mon-Sat 8am-5pm" sub-text |
| 14 | Login | Terms of Service + Privacy Policy links are `href="#"` |
| 15 | Register | Privacy Policy link is `href="#"` |
| 16 | Register | Phone field labeled "Phone *" (required) but input not `required` |
| 17 | Order Detail | Cancel order fires immediately with no confirmation dialog |
| 18 | Returns List | Return cards are `<div>` not `<Link>` — detail page unreachable |

### Admin Panel

| # | Page | Issue |
|---|------|-------|
| 19 | Admin Dashboard | Just a redirect to /orders — no actual dashboard with stats |
| 20 | Order Detail | No link to pick list for this order |
| 21 | Order Detail | `out_for_delivery` status unreachable from UI |
| 22 | Returns | "Receive" action fires with no confirmation dialog |
| 23 | Returns | "Refund" action fires with no amount entry or confirmation |
| 24 | Warehouse | Bins have no edit or deactivate UI |

---

## HIGH — Missing expected features (32)

### Customer Store

| # | Page | Issue |
|---|------|-------|
| 25 | Search | No "In stock only" toggle despite API support |
| 26 | Search | No "Clear all filters" button |
| 27 | Search | Pagination shows max 5 page buttons regardless of total |
| 28 | Product Detail | No "View Cart" link after adding to cart |
| 29 | Product Detail | Out of stock: no "Notify me" option |
| 30 | Product Detail | No quantity upper bound feedback |
| 31 | Cart | No "Continue Shopping" link |
| 32 | Cart | Hardcoded $1,500 flat rate doesn't match real delivery zones |
| 33 | Cart | Update/remove mutation errors have no error handling |
| 34 | Checkout | No validation feedback when submit button is disabled |
| 35 | Checkout | No required field indicators (asterisks) |
| 36 | Checkout | No "save card" checkbox for new cards |
| 37 | Orders List | No search or filter for orders |
| 38 | Order Detail | No reorder button |
| 39 | Order Detail | Tracking copy button has no success feedback |
| 40 | Returns | Return detail page has no shipping instructions when "approved" |
| 41 | Account | No links to Orders or Returns from account page |
| 42 | Account | Profile save doesn't update header name without page refresh |
| 43 | Contact | Success screen has no navigation (user stranded) |
| 44 | Contact | No contact info shown alongside form |

### Admin Panel

| # | Page | Issue |
|---|------|-------|
| 45 | Orders List | No status count badges in filter bar |
| 46 | Orders List | No date range filter |
| 47 | Orders List | No delivery method filter |
| 48 | Orders List | No bulk actions |
| 49 | Order Detail | No "Print packing slip" button |
| 50 | Order Detail | No payment info section (method, transaction ID) |
| 51 | Order Detail | Timeline steps have no timestamps |
| 52 | Pick Lists | No search |
| 53 | Pick Lists | No item count column |
| 54 | Settings | No success toast on save |
| 55 | Staff | Role changes fire on dropdown onChange with no confirmation |
| 56 | Products | Delete confirmation doesn't show product name |

### POS

| # | Page | Issue |
|---|------|-------|
| 57 | POS | Tax rate hardcoded at 15%, not from store settings |
| 58 | POS | No receipt printing or email receipt |
| 59 | POS | No customer association on sales |
| 60 | POS | No void/refund from POS |
| 61 | POS | Held carts have no label input |
| 62 | POS Reports | No date range picker (daily only) |
| 63 | POS Reports | No export to CSV |

---

## MEDIUM — Polish and completeness (20+)

| # | Page | Issue |
|---|------|-------|
| 64 | PartCard | No loading state on quick-add button |
| 65 | PartCard | Guest add-to-cart shows no toast (authenticated does) |
| 66 | Homepage | Hardcoded reviews (2,147 reviews, 4 dummy cards) |
| 67 | Homepage | Hardcoded placeholder phone number (876) 555-0316 |
| 68 | Register | No Google Sign-In option (login has it) |
| 69 | Register | No password strength indicator |
| 70 | Forgot Password | No "Don't have an account?" link |
| 71 | Reset Password | No show/hide toggle on confirm password field |
| 72 | Checkout | Card number field doesn't auto-format with spaces |
| 73 | Returns New | No return window warning (30-day policy not shown) |
| 74 | Returns New | No confirmation page after submission |
| 75 | Order Detail | No return eligibility message for non-delivered orders |
| 76 | Pick List Detail | No progress indicator (3/7 items picked) |
| 77 | Pick List Detail | Assign uses free text, not staff dropdown |
| 78 | Warehouse | No bin count per location |
| 79 | Warehouse | Location deactivate has no confirmation |
| 80 | Warehouse Receive | Receipt confirmation has no dialog |
| 81 | Warehouse Movements | No manual adjustment entry point |
| 82 | Warehouse Movements | Reference IDs not clickable links |
| 83 | Products Edit | Image delete is immediate, no confirmation |
| 84 | Products Edit | No drag-to-reorder images |
| 85 | Scan Pickup | No camera QR scanner, text input only |
| 86 | Scan Pickup | No fallback to lookup by order number |

---

## Priority Fix Order

### Batch 1: Fix all dead links and navigation (items 1-18)
Quick fixes — correct hrefs, remove dead UI, add missing Links

### Batch 2: Add confirmation dialogs and feedback (items 17, 22-24, 33-34, 39, 54-55, 79-80, 83)
Add confirm() or modal before destructive actions, add toast on success

### Batch 3: Add missing filters and search (items 25-27, 37, 46-48, 52)
Wire up existing API params to UI controls

### Batch 4: Add missing features (items 19, 28-29, 31, 36, 38, 41, 49-51, 57-63)
Build admin dashboard, cart improvements, POS receipt, etc.
