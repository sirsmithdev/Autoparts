# 316 Parts Store — REST API Reference

## Overview

The 316 Parts Store exposes a **RESTful JSON API** over HTTPS. All endpoints follow REST conventions with standard HTTP methods and status codes.

| Property | Value |
|----------|-------|
| **Base URL** | `https://parts.316-automotive.com` |
| **Protocol** | HTTPS (TLS 1.2+) |
| **Content Type** | `application/json` (request and response) |
| **Authentication** | JWT Bearer tokens (`Authorization: Bearer <token>`) |
| **Rate Limiting** | 60 req/min anonymous, 120 req/min authenticated |
| **CORS** | `parts.316-automotive.com` and `316-automotive.com` |

---

## Authentication

JWT-based authentication with short-lived access tokens and long-lived refresh tokens.

| Token | Lifetime | Storage |
|-------|----------|---------|
| Access token | 15 minutes | Memory only |
| Refresh token | 7 days | localStorage |

### POST /api/store/auth/register

Create a new customer account.

**Auth**: None

**Request body:**
```json
{
  "email": "customer@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1876555000"       // optional
}
```

**Response** `201 Created`:
```json
{
  "customer": {
    "id": "uuid",
    "email": "customer@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1876555000"
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

**Errors**: `400` validation error, `409` email already registered

### POST /api/store/auth/login

Log in with email and password.

**Auth**: None

**Request body:**
```json
{
  "email": "customer@example.com",
  "password": "securePassword123"
}
```

**Response** `200 OK`: Same shape as register response.

**Errors**: `401` invalid credentials, `403` account deactivated

### POST /api/store/auth/google

Log in or register with Google.

**Auth**: None

**Request body:**
```json
{
  "idToken": "google-jwt-id-token"
}
```

**Response** `200 OK`: Same shape as register response. Creates account if new.

### POST /api/store/auth/refresh

Refresh an expired access token.

**Auth**: None

**Request body:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response** `200 OK`:
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

### GET /api/store/auth/me

Get current customer profile.

**Auth**: Required

**Response** `200 OK`:
```json
{
  "id": "uuid",
  "email": "customer@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1876555000",
  "address": "123 Main St",
  "parish": "Kingston",
  "authProvider": "email"
}
```

### PATCH /api/store/auth/me

Update customer profile.

**Auth**: Required

**Request body** (all fields optional):
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1876555000",
  "address": "123 Main St",
  "parish": "Kingston"
}
```

### POST /api/store/auth/set-password

Set or change password. Works for Google-only accounts.

**Auth**: Required

**Request body:**
```json
{
  "currentPassword": "oldPassword",   // required if password already exists
  "newPassword": "newSecurePassword"
}
```

---

## Catalog (Public)

All catalog endpoints are publicly accessible. No authentication required. Rate limited to 60 req/min for anonymous users.

### GET /api/store/catalog

Search and browse products.

**Auth**: Optional

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Keyword search (name, description, manufacturer) |
| `partNumber` | string | Exact or prefix match on part number |
| `category` | string | Filter by category |
| `make` | string | Filter by vehicle make |
| `model` | string | Filter by vehicle model |
| `year` | number | Filter by vehicle year |
| `manufacturer` | string | Filter by manufacturer |
| `condition` | string | `new`, `refurbished`, or `used` |
| `inStockOnly` | boolean | Only show in-stock products |
| `orderBy` | string | `name`, `price_asc`, `price_desc`, `newest` |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |

**Response** `200 OK`:
```json
{
  "parts": [
    {
      "id": "uuid",
      "name": "Brake Pad Set",
      "partNumber": "BP-1234",
      "salePrice": "4500.00",
      "description": "Premium ceramic brake pads",
      "manufacturer": "BREMBO",
      "category": "Brakes",
      "imageUrl": "https://...",
      "condition": "new",
      "isFeatured": false,
      "isOversized": false,
      "stockStatus": "in_stock"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20,
  "totalPages": 8
}
```

**Stock status values**: `in_stock`, `low_stock`, `out_of_stock`. Exact quantities are never exposed.

### GET /api/store/catalog/:productId

Get full product detail.

**Auth**: Optional

**Response** `200 OK`:
```json
{
  "id": "uuid",
  "name": "Brake Pad Set",
  "partNumber": "BP-1234",
  "salePrice": "4500.00",
  "description": "Premium ceramic brake pads",
  "longDescription": "<p>HTML description...</p>",
  "manufacturer": "BREMBO",
  "category": "Brakes",
  "condition": "new",
  "weight": "2.50",
  "isOversized": false,
  "stockStatus": "in_stock",
  "images": [
    { "id": "uuid", "imageUrl": "https://...", "sortOrder": 0, "altText": "Front view", "isPrimary": true }
  ],
  "partNumbers": [
    { "id": "uuid", "partNumber": "OEM-5678", "numberType": "oem", "brand": "Toyota", "isPrimary": true }
  ],
  "compatibility": [
    { "id": "uuid", "make": "Toyota", "model": "Corolla", "yearStart": 2018, "yearEnd": 2024, "trim": null, "engineType": "1.8L" }
  ]
}
```

### GET /api/store/catalog/featured

Get featured products for homepage.

### GET /api/store/catalog/makes

Get distinct vehicle makes for dropdown filters.

**Response** `200 OK`:
```json
["Honda", "Hyundai", "Nissan", "Toyota"]
```

### GET /api/store/catalog/models?make=Toyota

Get models for a given make.

### GET /api/store/catalog/compatible?make=Toyota&model=Corolla&year=2020

Get compatible products for a vehicle.

### GET /api/store/catalog/lookup/:partNumber

Cross-reference lookup by any part number type (OEM, aftermarket, interchange).

### GET /api/store/categories

Get distinct product categories.

### GET /api/store/delivery-zones

Get active delivery zones with fees.

**Response** `200 OK`:
```json
[
  {
    "id": "uuid",
    "name": "Kingston Metro",
    "parishes": ["Kingston", "St. Andrew"],
    "deliveryFee": "500.00",
    "oversizedSurcharge": "300.00",
    "estimatedDays": 1
  }
]
```

### GET /api/store/settings/public

Get public store settings (return policy, limits, currency).

**Response** `200 OK`:
```json
{
  "returnWindowDays": 14,
  "defectiveReturnWindowDays": 30,
  "maxQuantityPerItem": 50,
  "maxItemsPerOrder": 200,
  "currency": "JMD",
  "currencySymbol": "$",
  "taxRate": "15.00",
  "taxName": "GCT"
}
```

---

## Shopping Cart

Server-side cart for authenticated customers. Guest carts are client-side only (Zustand + localStorage).

### GET /api/store/cart

Get customer's cart with live prices and stock validation.

**Auth**: Required

**Response** `200 OK`:
```json
{
  "id": "uuid",
  "items": [
    {
      "id": "uuid",
      "productId": "uuid",
      "quantity": 2,
      "priceAtAddTime": "4500.00",
      "product": {
        "name": "Brake Pad Set",
        "partNumber": "BP-1234",
        "salePrice": "4500.00",
        "quantity": 15,
        "imageUrl": "https://...",
        "isOversized": false
      },
      "stockStatus": "available",
      "priceChanged": false
    }
  ],
  "itemCount": 2,
  "subtotal": 9000.00
}
```

**Stock status per item**: `available`, `low_stock`, `insufficient_stock`, `out_of_stock`

### POST /api/store/cart/items

Add item to cart.

**Auth**: Required

**Request body:**
```json
{
  "productId": "uuid",
  "quantity": 2
}
```

**Validation**: Product must be active, in stock, quantity <= `maxQuantityPerItem`, total items < `maxItemsPerOrder`.

### PATCH /api/store/cart/items/:itemId

Update item quantity.

**Auth**: Required

**Request body:**
```json
{
  "quantity": 3
}
```

### DELETE /api/store/cart/items/:itemId

Remove item from cart.

**Auth**: Required

### DELETE /api/store/cart

Clear entire cart.

**Auth**: Required

### POST /api/store/cart/merge

Merge guest cart items into server cart on login.

**Auth**: Required

**Request body:**
```json
{
  "items": [
    { "productId": "uuid", "quantity": 2 },
    { "productId": "uuid", "quantity": 1 }
  ]
}
```

**Merge strategy**: For duplicate products, keeps the higher quantity.

---

## Checkout & Orders

### POST /api/store/checkout

Create a pending order and initiate payment.

**Auth**: Required

**Request body:**
```json
{
  "deliveryMethod": "local_delivery",
  "deliveryZoneId": "uuid",
  "deliveryAddress": "123 Main St, Kingston",
  "deliveryParish": "Kingston",
  "deliveryNotes": "Gate code: 1234",
  "paymentMethodId": "uuid"          // optional, for saved card
}
```

**Response** `201 Created`:
```json
{
  "orderId": "uuid",
  "orderNumber": "ORD-2026-0001",
  "subtotal": "9000.00",
  "taxAmount": "1350.00",
  "deliveryFee": "500.00",
  "total": "10850.00",
  "spiToken": "...",
  "redirectData": "<html>..."
}
```

**Side effects**: Decrements product stock atomically, clears cart, snapshots prices.

### POST /api/store/payment-callback

PowerTranz payment callback. Public endpoint, verified by HMAC.

**Auth**: None (HMAC verified)

### POST /api/store/orders/:id/retry-payment

Retry payment for a `pending_payment` order.

**Auth**: Required (order owner)

### GET /api/store/orders

Customer order history.

**Auth**: Required

**Query parameters**: `page`, `limit`, `status`

**Response** `200 OK`:
```json
{
  "orders": [
    {
      "id": "uuid",
      "orderNumber": "ORD-2026-0001",
      "status": "shipped",
      "total": "10850.00",
      "itemCount": 2,
      "createdAt": "2026-03-20T10:00:00Z",
      "deliveryMethod": "local_delivery"
    }
  ],
  "total": 5,
  "page": 1
}
```

### GET /api/store/orders/:id

Single order detail with items and tracking.

**Auth**: Required (order owner)

**Response** `200 OK`:
```json
{
  "id": "uuid",
  "orderNumber": "ORD-2026-0001",
  "status": "shipped",
  "deliveryMethod": "local_delivery",
  "deliveryAddress": "123 Main St, Kingston",
  "deliveryParish": "Kingston",
  "deliveryFee": "500.00",
  "subtotal": "9000.00",
  "taxAmount": "1350.00",
  "total": "10850.00",
  "trackingNumber": "TRK12345",
  "items": [
    {
      "id": "uuid",
      "productName": "Brake Pad Set",
      "productNumber": "BP-1234",
      "quantity": 2,
      "unitPrice": "4500.00",
      "lineTotal": "9000.00"
    }
  ],
  "placedAt": "2026-03-20T10:00:00Z",
  "confirmedAt": "2026-03-20T11:00:00Z",
  "shippedAt": "2026-03-20T15:00:00Z",
  "createdAt": "2026-03-20T10:00:00Z"
}
```

### POST /api/store/orders/:id/cancel

Cancel an order. Customer can cancel from `placed` status only.

**Auth**: Required (order owner)

**Side effects**: Restores product stock, queues stock-restore sync to garage.

---

## Returns

### POST /api/store/returns

Request a return.

**Auth**: Required

**Request body:**
```json
{
  "orderId": "uuid",
  "items": [
    { "orderItemId": "uuid", "quantity": 1, "reason": "defective" }
  ],
  "reasonDetails": "Brake pad cracked on first installation"
}
```

**Validation**: Order must be `delivered`, within return window (14 days standard, 30 days defective). Electrical parts restricted to exchange or store credit.

**Reason values**: `wrong_part`, `defective`, `not_needed`, `wrong_fitment`, `damaged_in_shipping`, `other`

### GET /api/store/returns

Customer return history.

**Auth**: Required

### GET /api/store/returns/:id

Return detail with items and status timeline.

**Auth**: Required (return owner)

---

## Sync API (Service-to-Service)

Authenticated via `x-sync-api-key` header. Not for customer use.

### Inbound (Garage → Parts Store)

#### POST /api/sync/products

Bulk upsert products.

**Auth**: `x-sync-api-key` header

**Request body:**
```json
{
  "products": [
    {
      "garagePartId": "uuid",
      "name": "Brake Pad Set",
      "partNumber": "BP-1234",
      "salePrice": "4500.00",
      "quantity": 50,
      "lowStockThreshold": 10,
      "description": "Premium ceramic brake pads",
      "manufacturer": "BREMBO",
      "category": "Brakes",
      "condition": "new",
      "isOversized": false,
      "isFeatured": true,
      "featuredSortOrder": 1,
      "numbers": [
        { "partNumber": "OEM-5678", "numberType": "oem", "brand": "Toyota", "isPrimary": true }
      ],
      "compatibility": [
        { "make": "Toyota", "model": "Corolla", "yearStart": 2018, "yearEnd": 2024 }
      ],
      "images": [
        { "imageUrl": "https://...", "sortOrder": 0, "isPrimary": true }
      ]
    }
  ]
}
```

**Response** `200 OK`:
```json
{
  "created": 3,
  "updated": 7,
  "errors": []
}
```

#### POST /api/sync/stock

Batch stock level update.

**Auth**: `x-sync-api-key` header

**Request body:**
```json
{
  "updates": [
    { "garagePartId": "uuid", "quantity": 45 }
  ]
}
```

### Outbound (Parts Store → Garage)

These are sent TO the garage app, not received by the parts store.

#### POST {GARAGE_SYNC_URL}/stock-decrement

Sent when an online order or POS sale reduces stock.

```json
{
  "garagePartId": "uuid",
  "quantity": 2,
  "orderId": "uuid",
  "orderNumber": "ORD-2026-0001"
}
```

#### POST {GARAGE_SYNC_URL}/stock-restore

Sent when an order is cancelled or a return is processed.

```json
{
  "garagePartId": "uuid",
  "quantity": 2,
  "orderId": "uuid",
  "reason": "order_cancelled"
}
```

---

## Admin API

All admin endpoints require JWT with `isAdmin: true` claim.

### Orders Management

```
GET    /api/store/admin/orders                        — List orders (filter: status, date, search)
GET    /api/store/admin/orders/:id                    — Order detail
POST   /api/store/admin/orders/:id/confirm            — placed → confirmed (creates pick list)
POST   /api/store/admin/orders/:id/pack               — picking → packed
POST   /api/store/admin/orders/:id/ship               — packed → shipped {trackingNumber}
POST   /api/store/admin/orders/:id/out-for-delivery   — shipped → out_for_delivery
POST   /api/store/admin/orders/:id/deliver            — → delivered
POST   /api/store/admin/orders/:id/ready-for-pickup   — sends notification
POST   /api/store/admin/orders/:id/picked-up          — → delivered {pickedUpBy}
POST   /api/store/admin/orders/:id/cancel             — → cancelled {reason}
PATCH  /api/store/admin/orders/:id/notes              — Update staff notes
GET    /api/store/admin/orders/:id/packing-slip       — HTML packing slip
```

### Returns Management

```
GET    /api/store/admin/returns                       — List returns (filter: status, date)
GET    /api/store/admin/returns/:id                   — Return detail
POST   /api/store/admin/returns/:id/approve           — → approved {returnShippingPaidBy}
POST   /api/store/admin/returns/:id/reject            — → rejected {reason}
POST   /api/store/admin/returns/:id/receive           — → received {itemConditions[]}
POST   /api/store/admin/returns/:id/refund            — → refunded
POST   /api/store/admin/returns/:id/exchange          — → exchanged {newOrderId}
POST   /api/store/admin/returns/:id/store-credit      — → closed (electrical parts)
```

### Warehouse Management

```
GET    /api/store/admin/warehouse/locations            — List locations
POST   /api/store/admin/warehouse/locations            — Create location
PATCH  /api/store/admin/warehouse/locations/:id        — Update location
DELETE /api/store/admin/warehouse/locations/:id        — Deactivate location

GET    /api/store/admin/warehouse/bins                 — List bins (?locationId=)
POST   /api/store/admin/warehouse/bins                 — Create bin
PATCH  /api/store/admin/warehouse/bins/:id             — Update bin
GET    /api/store/admin/warehouse/bins/:id/contents    — Products in bin

POST   /api/store/admin/warehouse/assign               — Assign product to bin
POST   /api/store/admin/warehouse/transfer             — Transfer between bins
POST   /api/store/admin/warehouse/adjust               — Manual stock adjustment
GET    /api/store/admin/warehouse/product/:id/bins     — Bin locations for product

GET    /api/store/admin/warehouse/receipts             — List stock receipts
POST   /api/store/admin/warehouse/receipts             — Create receipt (draft)
GET    /api/store/admin/warehouse/receipts/:id         — Receipt detail
POST   /api/store/admin/warehouse/receipts/:id/receive — Confirm receipt
POST   /api/store/admin/warehouse/receipts/:id/cancel  — Cancel receipt

GET    /api/store/admin/warehouse/movements            — Stock movement audit trail
```

### Pick Lists

```
GET    /api/store/admin/pick-lists                     — List pick lists (?status=)
GET    /api/store/admin/pick-lists/:id                 — Pick list detail
POST   /api/store/admin/pick-lists/:id/assign          — Assign to picker
POST   /api/store/admin/pick-lists/:id/start           — Start picking
POST   /api/store/admin/pick-lists/:id/items/:itemId/pick — Pick item {quantityPicked}
POST   /api/store/admin/pick-lists/:id/complete        — Complete → order packed
POST   /api/store/admin/pick-lists/:id/cancel          — Cancel pick list
```

### Delivery Zones

```
GET    /api/store/admin/delivery-zones                 — List all zones
POST   /api/store/admin/delivery-zones                 — Create zone
PATCH  /api/store/admin/delivery-zones/:id             — Update zone
DELETE /api/store/admin/delivery-zones/:id             — Delete zone
```

### Store Settings

```
GET    /api/store/admin/settings                       — Get all settings
PATCH  /api/store/admin/settings                       — Update settings
GET    /api/store/admin/settings/sync-status            — Sync queue status
POST   /api/store/admin/settings/sync-retry/:id        — Retry failed sync
POST   /api/store/admin/settings/sync-resolve/:id      — Mark sync resolved
```

### Dashboard Stats

```
GET    /api/store/admin/stats                          — Dashboard stats
```

**Response** `200 OK`:
```json
{
  "totalOrders": 150,
  "totalRevenue": 2500000,
  "pendingOrders": 5,
  "returnsRate": 3.2,
  "avgOrderValue": 16667,
  "ordersByStatus": { "placed": 3, "confirmed": 2, "shipped": 5 },
  "topProducts": [...],
  "revenueByDay": [...]
}
```

---

## POS API

All POS endpoints require admin JWT.

### Sessions

```
POST   /api/store/pos/sessions/open                    — Open register {openingCash}
POST   /api/store/pos/sessions/close                   — Close register {closingCash, notes}
GET    /api/store/pos/sessions/current                 — Active session
```

### Transactions

```
POST   /api/store/pos/transactions                     — Complete sale
GET    /api/store/pos/transactions                      — List (?sessionId=, ?date=)
GET    /api/store/pos/transactions/:id                 — Detail
POST   /api/store/pos/transactions/:id/void            — Void {reason}
POST   /api/store/pos/transactions/:id/refund          — Refund {items[], amount}
```

**Sale request body:**
```json
{
  "items": [
    { "productId": "uuid", "quantity": 2, "discountPercent": 0 }
  ],
  "paymentMethod": "cash",
  "cashReceived": 10000,
  "customerId": "uuid"
}
```

**Sale response** `201 Created`:
```json
{
  "id": "uuid",
  "transactionNumber": "POS-2026-0001",
  "subtotal": "9000.00",
  "taxAmount": "1350.00",
  "discountAmount": "0.00",
  "total": "10350.00",
  "paymentMethod": "cash",
  "cashReceived": "10000.00",
  "changeGiven": "0.00",
  "items": [...]
}
```

### Held Carts

```
POST   /api/store/pos/hold                             — Hold cart
GET    /api/store/pos/hold                             — List held carts
GET    /api/store/pos/hold/:id                         — Get held cart
DELETE /api/store/pos/hold/:id                         — Delete held cart
```

### Reports & Lookup

```
GET    /api/store/pos/lookup?q=                        — Quick product search
GET    /api/store/pos/reports/daily                     — Daily summary
GET    /api/store/pos/reports/session/:id              — Session summary
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "message": "Human-readable error description"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `400` | Bad request (validation error) |
| `401` | Unauthorized (missing or invalid token) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Resource not found |
| `409` | Conflict (duplicate email, insufficient stock) |
| `429` | Rate limited |
| `500` | Internal server error |

---

## Health Check

### GET /health

**Auth**: None

**Response** `200 OK`:
```json
{
  "status": "ok",
  "service": "parts-store"
}
```
