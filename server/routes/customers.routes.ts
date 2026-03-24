/**
 * Customer management routes for admin/staff.
 * Requires staff:manage permission.
 */
import { Router } from "express";
import { eq, like, or, sql, count, desc } from "drizzle-orm";
import { authenticateToken, requirePermission } from "../middleware.js";
import { db } from "../db.js";
import { customers, onlineStoreOrders } from "../schema.js";

const router = Router();

// ─── GET /api/store/admin/customers ──────────────────────
// List customers with optional search (email/name LIKE), pagination.

router.get(
  "/api/store/admin/customers",
  authenticateToken,
  requirePermission("staff:manage"),
  async (req, res) => {
    try {
      const search = (req.query.search as string || "").trim();
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const offset = (page - 1) * limit;

      const searchCondition = search
        ? or(
            like(customers.email, `%${search}%`),
            like(customers.firstName, `%${search}%`),
            like(customers.lastName, `%${search}%`),
          )
        : undefined;

      // Get total count
      const [countResult] = await db
        .select({ total: count() })
        .from(customers)
        .where(searchCondition);

      const total = countResult?.total ?? 0;

      // Get customers with order count
      const rows = await db
        .select({
          id: customers.id,
          email: customers.email,
          firstName: customers.firstName,
          lastName: customers.lastName,
          phone: customers.phone,
          parish: customers.parish,
          authProvider: customers.authProvider,
          role: customers.role,
          isActive: customers.isActive,
          storeCreditBalance: customers.storeCreditBalance,
          createdAt: customers.createdAt,
          orderCount: sql<number>`(SELECT COUNT(*) FROM online_store_orders WHERE customer_id = ${customers.id})`.as("order_count"),
        })
        .from(customers)
        .where(searchCondition)
        .orderBy(desc(customers.createdAt))
        .limit(limit)
        .offset(offset);

      res.json({ customers: rows, total, page, limit });
    } catch (error) {
      console.error("Failed to list customers:", error);
      res.status(500).json({ message: "Failed to list customers" });
    }
  },
);

// ─── GET /api/store/admin/customers/:id ──────────────────
// Single customer with order count.

router.get(
  "/api/store/admin/customers/:id",
  authenticateToken,
  requirePermission("staff:manage"),
  async (req, res) => {
    try {
      const [row] = await db
        .select({
          id: customers.id,
          email: customers.email,
          firstName: customers.firstName,
          lastName: customers.lastName,
          phone: customers.phone,
          address: customers.address,
          parish: customers.parish,
          authProvider: customers.authProvider,
          role: customers.role,
          isActive: customers.isActive,
          storeCreditBalance: customers.storeCreditBalance,
          emailVerified: customers.emailVerified,
          createdAt: customers.createdAt,
          updatedAt: customers.updatedAt,
          orderCount: sql<number>`(SELECT COUNT(*) FROM online_store_orders WHERE customer_id = ${customers.id})`.as("order_count"),
        })
        .from(customers)
        .where(eq(customers.id, String(req.params.id)))
        .limit(1);

      if (!row) {
        return res.status(404).json({ message: "Customer not found" });
      }

      res.json(row);
    } catch (error) {
      console.error("Failed to get customer:", error);
      res.status(500).json({ message: "Failed to get customer" });
    }
  },
);

// ─── PATCH /api/store/admin/customers/:id/block ──────────
// Set isActive = false.

router.patch(
  "/api/store/admin/customers/:id/block",
  authenticateToken,
  requirePermission("staff:manage"),
  async (req, res) => {
    try {
      const customerId = String(req.params.id);
      await db
        .update(customers)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(customers.id, customerId));

      res.json({ message: "Customer blocked", customerId });
    } catch (error) {
      console.error("Failed to block customer:", error);
      res.status(500).json({ message: "Failed to block customer" });
    }
  },
);

// ─── PATCH /api/store/admin/customers/:id/unblock ────────
// Set isActive = true.

router.patch(
  "/api/store/admin/customers/:id/unblock",
  authenticateToken,
  requirePermission("staff:manage"),
  async (req, res) => {
    try {
      const customerId = String(req.params.id);
      await db
        .update(customers)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(customers.id, customerId));

      res.json({ message: "Customer unblocked", customerId });
    } catch (error) {
      console.error("Failed to unblock customer:", error);
      res.status(500).json({ message: "Failed to unblock customer" });
    }
  },
);

export default router;
