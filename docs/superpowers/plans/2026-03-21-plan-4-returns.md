# Plan 4: Order Fulfillment & Returns

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full return request lifecycle -- customer-facing return initiation, admin approval/rejection workflow, item receiving with restocking, and resolution (refund, exchange, or store credit) -- with policy validation enforced at every stage.

**Architecture:** New `server/storage/returns.ts` storage module with atomic number generation, policy-driven validation, and state-machine transitions. New `server/routes/returns.routes.ts` for customer endpoints. Stubbed admin endpoints replaced with real implementations.

**Tech Stack:** Drizzle ORM, Zod, existing stockSync and settings modules

**Depends on:** Plan 2

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `server/storage/returns.ts` | Return number generation, CRUD, policy validation, state machine, restocking |
| `server/routes/returns.routes.ts` | Customer endpoints: create, list, detail |

### Modified Files

| File | Changes |
|------|---------|
| `server/routes/admin.routes.ts` | Replace 501 stubs with real return management + add exchange/store-credit |
| `server/routes/index.ts` | Register returnsRoutes |

---

## Task 1: Create Returns Storage Module

**Files:** Create `server/storage/returns.ts`

- [ ] **Step 1:** Read `server/storage/orders.ts` for patterns (number generation, transactions, buildSyncItems)
- [ ] **Step 2:** Read `server/storage/settings.ts` for `getStoreSettings()` and `server/sync/stockSync.ts` for `enqueueStockRestore()`
- [ ] **Step 3:** Create the module with these exports:
  - `generateReturnNumber()` — atomic RET-YYYY-NNNN
  - `createReturnRequest(params)` — with full policy validation (return window, electrical parts, duplicate prevention, quantity limits, restocking fee calculation)
  - `getReturn(id)` — return + items
  - `getReturnsByCustomer(customerId, page, limit)`
  - `getAllReturns(filters)` — admin with status/search/pagination
  - `approveReturn(id, approvedBy)`
  - `rejectReturn(id, rejectedBy, reason)`
  - `markReturnShippedBack(id, trackingNumber)`
  - `receiveReturn(id, receivedBy, itemConditions[])` — restocks products.quantity, records stock_movements, enqueues garage sync
  - `refundReturn(id)` — blocks electrical parts
  - `exchangeReturn(id, staffNotes?)`
  - `storeCreditReturn(id, staffNotes?)`
- [ ] **Step 4:** Verify TypeScript compiles
- [ ] **Step 5:** Commit

---

## Task 2: Create Customer Returns Routes

**Files:** Create `server/routes/returns.routes.ts`

- [ ] **Step 1:** Create routes with Zod validation:
  - `POST /api/store/returns` — create return (validates body: orderId, items[{orderItemId, quantity, reason}], reasonDetails?)
  - `GET /api/store/returns` — list customer's returns (paginated)
  - `GET /api/store/returns/:id` — detail with ownership check
- [ ] **Step 2:** Verify compiles
- [ ] **Step 3:** Commit

---

## Task 3: Replace Admin Returns Stubs

**Files:** Modify `server/routes/admin.routes.ts`

- [ ] **Step 1:** Import returns storage
- [ ] **Step 2:** Replace all 501 stubs with real handlers:
  - `GET /api/store/admin/returns` — getAllReturns(filters)
  - `GET /api/store/admin/returns/:id` — getReturn(id)
  - `POST /api/store/admin/returns/:id/approve`
  - `POST /api/store/admin/returns/:id/reject` — requires reason
  - `POST /api/store/admin/returns/:id/receive` — requires itemConditions[]
  - `POST /api/store/admin/returns/:id/refund`
- [ ] **Step 3:** Add new endpoints:
  - `POST /api/store/admin/returns/:id/exchange`
  - `POST /api/store/admin/returns/:id/store-credit`
- [ ] **Step 4:** Verify compiles
- [ ] **Step 5:** Commit

---

## Task 4: Register Returns Routes

**Files:** Modify `server/routes/index.ts`

- [ ] **Step 1:** Import and register `returnsRoutes`
- [ ] **Step 2:** Verify compiles
- [ ] **Step 3:** Commit

---

## Verification Checklist

1. [ ] Customer can create return for delivered order
2. [ ] Return window blocks expired returns (14d standard, 30d defective)
3. [ ] Restocking fee: 15% non-defective, 0% defective
4. [ ] Electrical parts blocked from refund (exchange/store-credit only)
5. [ ] Admin approve/reject/receive/refund/exchange/store-credit all work
6. [ ] Receive restocks products.quantity + records stock_movements + enqueues sync
7. [ ] Duplicate return on same order item blocked
8. [ ] TypeScript compiles with zero errors
