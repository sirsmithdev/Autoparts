/**
 * Staff management routes — assign/remove roles, list staff, search customers.
 * All routes require staff:manage permission (admin only).
 */
import { Router } from "express";
import { z } from "zod";
import { authenticateToken, requirePermission } from "../middleware.js";
import { STAFF_ROLES } from "../permissions.js";
import * as customerStore from "../storage/customers.js";
import * as staffActivity from "../storage/staffActivity.js";
import * as staffInviteStore from "../storage/staffInvites.js";

const router = Router();

const setRoleSchema = z.object({
  role: z.enum(STAFF_ROLES),
});

// ─── GET /api/store/admin/staff ─────────────────────────

router.get(
  "/api/store/admin/staff",
  authenticateToken,
  requirePermission("staff:manage"),
  async (_req, res) => {
    try {
      const staff = await customerStore.findStaff();
      res.json(
        staff.map(({ password, ...s }) => s),
      );
    } catch (error) {
      console.error("Failed to list staff:", error);
      res.status(500).json({ message: "Failed to list staff" });
    }
  },
);

// ─── GET /api/store/admin/staff/search ──────────────────

router.get(
  "/api/store/admin/staff/search",
  authenticateToken,
  requirePermission("staff:manage"),
  async (req, res) => {
    try {
      const email = (req.query.email as string || "").trim();
      if (!email || email.length < 2) {
        return res.json([]);
      }
      const results = await customerStore.searchByEmail(email);
      res.json(
        results.map(({ password, ...c }) => c),
      );
    } catch (error) {
      console.error("Failed to search customers:", error);
      res.status(500).json({ message: "Failed to search customers" });
    }
  },
);

// ─── POST /api/store/admin/staff/:customerId/role ───────

router.post(
  "/api/store/admin/staff/:customerId/role",
  authenticateToken,
  requirePermission("staff:manage"),
  async (req, res) => {
    try {
      const customerId = String(req.params.customerId);
      const body = setRoleSchema.parse(req.body);

      const customer = await customerStore.findById(String(customerId));
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Prevent demoting yourself
      if (customerId === req.customer!.customerId && body.role !== "admin") {
        return res.status(400).json({ message: "Cannot change your own role below admin" });
      }

      await customerStore.setRole(customerId, body.role);

      staffActivity.logActivity({ staffId: req.customer!.customerId, action: "staff_role_assigned", entity: "customer", entityId: customerId, details: { role: body.role }, ipAddress: req.ip });
      res.json({ message: `Role set to ${body.role}`, customerId, role: body.role });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Failed to set role:", error);
      res.status(500).json({ message: "Failed to set role" });
    }
  },
);

// ─── DELETE /api/store/admin/staff/:customerId/role ─────

router.delete(
  "/api/store/admin/staff/:customerId/role",
  authenticateToken,
  requirePermission("staff:manage"),
  async (req, res) => {
    try {
      const customerId = String(req.params.customerId);

      // Prevent removing your own role
      if (customerId === req.customer!.customerId) {
        return res.status(400).json({ message: "Cannot remove your own staff role" });
      }

      const customer = await customerStore.findById(String(customerId));
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      await customerStore.removeRole(customerId);

      staffActivity.logActivity({ staffId: req.customer!.customerId, action: "staff_role_removed", entity: "customer", entityId: customerId, ipAddress: req.ip });
      res.json({ message: "Staff role removed", customerId });
    } catch (error) {
      console.error("Failed to remove role:", error);
      res.status(500).json({ message: "Failed to remove role" });
    }
  },
);

// ─── POST /api/store/admin/staff/invite ──────────────────
// Create a staff invite (email + role).

router.post(
  "/api/store/admin/staff/invite",
  authenticateToken,
  requirePermission("staff:manage"),
  async (req, res) => {
    try {
      const { email, role } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "email is required" });
      }
      if (!role || !STAFF_ROLES.includes(role)) {
        return res.status(400).json({ message: `role must be one of: ${STAFF_ROLES.join(", ")}` });
      }

      // Check for existing pending invite
      const existing = await staffInviteStore.findPendingInviteByEmail(email.trim());
      if (existing) {
        return res.status(409).json({ message: "A pending invite already exists for this email" });
      }

      const invite = await staffInviteStore.createInvite({
        email: email.trim(),
        role,
        invitedBy: req.customer!.customerId,
      });

      staffActivity.logActivity({ staffId: req.customer!.customerId, action: "staff_invited", entity: "staff_invite", entityId: invite.id, details: { email: email.trim(), role }, ipAddress: req.ip });
      res.status(201).json(invite);
    } catch (error) {
      console.error("Failed to create invite:", error);
      res.status(500).json({ message: "Failed to create invite" });
    }
  },
);

// ─── GET /api/store/admin/staff/invites ──────────────────
// List all staff invites.

router.get(
  "/api/store/admin/staff/invites",
  authenticateToken,
  requirePermission("staff:manage"),
  async (_req, res) => {
    try {
      const invites = await staffInviteStore.listInvites();
      res.json(invites);
    } catch (error) {
      console.error("Failed to list invites:", error);
      res.status(500).json({ message: "Failed to list invites" });
    }
  },
);

// ─── GET /api/store/admin/staff/activity ─────────────────
// Get staff activity log with optional filters.

router.get(
  "/api/store/admin/staff/activity",
  authenticateToken,
  requirePermission("staff:manage"),
  async (req, res) => {
    try {
      const result = await staffActivity.getActivityLog({
        staffId: req.query.staffId as string | undefined,
        action: req.query.action as string | undefined,
        entity: req.query.entity as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      });
      res.json(result);
    } catch (error) {
      console.error("Failed to get activity log:", error);
      res.status(500).json({ message: "Failed to get activity log" });
    }
  },
);

export default router;
