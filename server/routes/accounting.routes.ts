/**
 * Accounting & reporting routes — requires authenticateToken + settings:read permission.
 * Provides end-of-day reports, revenue reports, tax summaries,
 * customer account statements, and cash management reports.
 */
import { Router } from "express";
import { authenticateToken, requirePermission } from "../middleware.js";
import * as accounting from "../storage/accounting.js";

const router = Router();

/** Validate YYYY-MM-DD date format to prevent SQL injection */
function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

/** Enforce max 366-day date range */
function isValidRange(start: string, end: string): boolean {
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 86400);
  return diff >= 0 && diff <= 366;
}

// ==================== End of Day Report ====================

router.get(
  "/api/store/admin/accounting/eod-report",
  authenticateToken,
  requirePermission("settings:read"),
  async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
      if (!isValidDate(date)) return res.status(400).json({ message: "Invalid date format (YYYY-MM-DD)" });
      const report = await accounting.getEndOfDayReport(date);
      res.json(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate end-of-day report";
      res.status(500).json({ message });
    }
  },
);

// ==================== Revenue Report ====================

router.get(
  "/api/store/admin/accounting/revenue",
  authenticateToken,
  requirePermission("settings:read"),
  async (req, res) => {
    try {
      const { startDate, endDate, groupBy } = req.query;
      if (!startDate || !endDate) return res.status(400).json({ message: "startDate and endDate are required" });
      if (!isValidDate(startDate as string) || !isValidDate(endDate as string)) return res.status(400).json({ message: "Invalid date format (YYYY-MM-DD)" });
      if (!isValidRange(startDate as string, endDate as string)) return res.status(400).json({ message: "Date range must be 0-366 days" });

      const validGroupBy = ["day", "week", "month"];
      const group = validGroupBy.includes(groupBy as string) ? (groupBy as "day" | "week" | "month") : "day";

      const report = await accounting.getRevenueReport({
        startDate: startDate as string,
        endDate: endDate as string,
        groupBy: group,
      });
      res.json(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate revenue report";
      res.status(500).json({ message });
    }
  },
);

// ==================== Tax Summary ====================

router.get(
  "/api/store/admin/accounting/tax-summary",
  authenticateToken,
  requirePermission("settings:read"),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) return res.status(400).json({ message: "startDate and endDate are required" });
      if (!isValidDate(startDate as string) || !isValidDate(endDate as string)) return res.status(400).json({ message: "Invalid date format (YYYY-MM-DD)" });
      if (!isValidRange(startDate as string, endDate as string)) return res.status(400).json({ message: "Date range must be 0-366 days" });

      const report = await accounting.getTaxSummary({
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate tax summary";
      res.status(500).json({ message });
    }
  },
);

// ==================== Customer Account Statement ====================

router.get(
  "/api/store/admin/accounting/customer-statement/:customerId",
  authenticateToken,
  requirePermission("orders:read"),
  async (req, res) => {
    try {
      const customerId = String(req.params.customerId);
      const { startDate, endDate } = req.query;
      if (startDate && !isValidDate(startDate as string)) return res.status(400).json({ message: "Invalid startDate" });
      if (endDate && !isValidDate(endDate as string)) return res.status(400).json({ message: "Invalid endDate" });

      const statement = await accounting.getCustomerStatement(customerId, {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });
      res.json(statement);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate customer statement";
      const status = error instanceof Error && error.message === "Customer not found" ? 404 : 500;
      res.status(status).json({ message });
    }
  },
);

// ==================== Cash Report ====================

router.get(
  "/api/store/admin/accounting/cash-report",
  authenticateToken,
  requirePermission("settings:read"),
  async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
      if (!isValidDate(date)) return res.status(400).json({ message: "Invalid date format (YYYY-MM-DD)" });
      const report = await accounting.getCashReport(date);
      res.json(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate cash report";
      res.status(500).json({ message });
    }
  },
);

export default router;
