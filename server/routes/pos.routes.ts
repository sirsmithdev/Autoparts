/**
 * POS (Point of Sale) routes.
 * Sessions, transactions, held carts, product lookup, and reports.
 * All endpoints require admin authentication.
 */
import { Router } from "express";
import { authenticateToken, requireAdmin } from "../middleware.js";
import * as pos from "../storage/pos.js";
import { db } from "../db.js";
import { posTransactions } from "../schema.js";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

// ==================== Sessions ====================

router.post(
  "/api/store/pos/sessions/open",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const session = await pos.openSession(
        req.customer!.customerId,
        req.body.openingCash,
      );
      res.status(201).json(session);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to open session";
      res.status(400).json({ message });
    }
  },
);

router.post(
  "/api/store/pos/sessions/close",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const session = await pos.closeSession(
        req.body.sessionId,
        req.customer!.customerId,
        req.body.closingCash,
        req.body.notes,
      );
      res.json(session);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to close session";
      res.status(400).json({ message });
    }
  },
);

router.get(
  "/api/store/pos/sessions/current",
  authenticateToken,
  requireAdmin,
  async (_req, res) => {
    try {
      const session = await pos.getCurrentSession();
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to get current session" });
    }
  },
);

// ==================== Transactions ====================

router.post(
  "/api/store/pos/transactions",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const transaction = await pos.createSale({
        sessionId: req.body.sessionId,
        items: req.body.items,
        paymentMethod: req.body.paymentMethod,
        cashReceived: req.body.cashReceived,
        customerId: req.body.customerId,
        processedBy: req.customer!.customerId,
      });
      res.status(201).json(transaction);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to create sale";
      res.status(400).json({ message });
    }
  },
);

router.get(
  "/api/store/pos/transactions",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const sessionId = req.query.sessionId as string | undefined;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
      const offset = (page - 1) * limit;

      const conditions = [];
      if (sessionId) {
        conditions.push(eq(posTransactions.sessionId, sessionId));
      }

      const where =
        conditions.length > 0 ? conditions[0] : undefined;

      const transactions = await db
        .select()
        .from(posTransactions)
        .where(where)
        .orderBy(desc(posTransactions.createdAt))
        .limit(limit)
        .offset(offset);

      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to get transactions" });
    }
  },
);

router.get(
  "/api/store/pos/transactions/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const transaction = await pos.getTransaction(String(req.params.id));
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ message: "Failed to get transaction" });
    }
  },
);

router.post(
  "/api/store/pos/transactions/:id/void",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      await pos.voidTransaction(
        String(req.params.id),
        req.customer!.customerId,
        req.body.reason,
      );
      res.json({ message: "Transaction voided" });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to void transaction";
      res.status(400).json({ message });
    }
  },
);

router.post(
  "/api/store/pos/transactions/:id/refund",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const refund = await pos.refundTransaction(
        String(req.params.id),
        req.body.items,
        req.customer!.customerId,
      );
      res.status(201).json(refund);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to refund transaction";
      res.status(400).json({ message });
    }
  },
);

// ==================== Held Carts ====================

router.post(
  "/api/store/pos/hold",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const cart = await pos.holdCart(
        req.body.name,
        req.body.items,
        req.customer!.customerId,
      );
      res.status(201).json(cart);
    } catch (error) {
      res.status(500).json({ message: "Failed to hold cart" });
    }
  },
);

router.get(
  "/api/store/pos/hold",
  authenticateToken,
  requireAdmin,
  async (_req, res) => {
    try {
      const carts = await pos.getHeldCarts();
      res.json(carts);
    } catch (error) {
      res.status(500).json({ message: "Failed to get held carts" });
    }
  },
);

router.get(
  "/api/store/pos/hold/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const cart = await pos.getHeldCart(String(req.params.id));
      if (!cart) {
        return res.status(404).json({ message: "Held cart not found" });
      }
      res.json(cart);
    } catch (error) {
      res.status(500).json({ message: "Failed to get held cart" });
    }
  },
);

router.delete(
  "/api/store/pos/hold/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      await pos.deleteHeldCart(String(req.params.id));
      res.json({ message: "Held cart deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete held cart" });
    }
  },
);

// ==================== Lookup & Reports ====================

router.get(
  "/api/store/pos/lookup",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const q = (req.query.q as string) || "";
      const results = await pos.quickProductLookup(q);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to look up products" });
    }
  },
);

router.get(
  "/api/store/pos/reports/daily",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const date = req.query.date as string | undefined;
      const report = await pos.getDailyReport(date);
      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to get daily report" });
    }
  },
);

router.get(
  "/api/store/pos/reports/session/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const report = await pos.getSessionReport(String(req.params.id));
      res.json(report);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to get session report";
      res.status(400).json({ message });
    }
  },
);

export default router;
