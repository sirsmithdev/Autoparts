/**
 * Staff admin routes — requires admin role (JWT-based).
 * Handles order fulfillment, returns management, delivery zones, store settings, sync status.
 */
import { Router } from "express";
import { authenticateToken, requireAdmin } from "../middleware.js";
import * as orders from "../storage/orders.js";
import * as settings from "../storage/settings.js";
import * as syncStorage from "../storage/sync.js";

const router = Router();

// ==================== Order Management ====================

router.get("/api/store/admin/orders", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, customerId, search, page, limit } = req.query;
    const result = await orders.getAllOrders({
      status: status as string,
      customerId: customerId as string,
      search: search as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to get orders" });
  }
});

router.get("/api/store/admin/orders/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const order = await orders.getOrder(String(req.params.id));
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Failed to get order" });
  }
});

router.post("/api/store/admin/orders/:id/confirm", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await orders.confirmOrder(String(req.params.id));
    const order = await orders.getOrder(String(req.params.id));
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to confirm order";
    res.status(400).json({ message });
  }
});

router.post("/api/store/admin/orders/:id/pack", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await orders.markOrderPacked(String(req.params.id), req.customer!.customerId);
    const order = await orders.getOrder(String(req.params.id));
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to mark packed";
    res.status(400).json({ message });
  }
});

router.post("/api/store/admin/orders/:id/ship", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { trackingNumber } = req.body;
    await orders.markOrderShipped(String(req.params.id), trackingNumber || "");
    const order = await orders.getOrder(String(req.params.id));
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to mark shipped";
    res.status(400).json({ message });
  }
});

router.post("/api/store/admin/orders/:id/out-for-delivery", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await orders.markOrderOutForDelivery(String(req.params.id));
    const order = await orders.getOrder(String(req.params.id));
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update order";
    res.status(400).json({ message });
  }
});

router.post("/api/store/admin/orders/:id/deliver", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await orders.markOrderDelivered(String(req.params.id));
    const order = await orders.getOrder(String(req.params.id));
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to mark delivered";
    res.status(400).json({ message });
  }
});

router.post("/api/store/admin/orders/:id/ready-for-pickup", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await orders.markOrderReadyForPickup(String(req.params.id));
    const order = await orders.getOrder(String(req.params.id));
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update order";
    res.status(400).json({ message });
  }
});

router.post("/api/store/admin/orders/:id/picked-up", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { pickedUpBy } = req.body;
    if (!pickedUpBy) return res.status(400).json({ message: "pickedUpBy is required" });
    await orders.markOrderPickedUp(String(req.params.id), pickedUpBy);
    const order = await orders.getOrder(String(req.params.id));
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update order";
    res.status(400).json({ message });
  }
});

router.post("/api/store/admin/orders/:id/cancel", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: "reason is required" });
    await orders.cancelOrder(String(req.params.id), reason, req.customer!.customerId);
    const order = await orders.getOrder(String(req.params.id));
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel order";
    res.status(400).json({ message });
  }
});

router.patch("/api/store/admin/orders/:id/notes", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await orders.updateOrderNotes(String(req.params.id), req.body.staffNotes || "");
    const order = await orders.getOrder(String(req.params.id));
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Failed to update notes" });
  }
});

// ==================== Returns Management (TODO: Plan 4) ====================

router.get("/api/store/admin/returns", authenticateToken, requireAdmin, async (_req, res) => {
  // TODO: Plan 4 — returns storage will be rebuilt
  res.status(501).json({ message: "Returns management not yet implemented — see Plan 4" });
});

router.get("/api/store/admin/returns/:id", authenticateToken, requireAdmin, async (_req, res) => {
  // TODO: Plan 4 — returns storage will be rebuilt
  res.status(501).json({ message: "Returns management not yet implemented — see Plan 4" });
});

router.post("/api/store/admin/returns/:id/approve", authenticateToken, requireAdmin, async (_req, res) => {
  // TODO: Plan 4 — returns storage will be rebuilt
  res.status(501).json({ message: "Returns management not yet implemented — see Plan 4" });
});

router.post("/api/store/admin/returns/:id/reject", authenticateToken, requireAdmin, async (_req, res) => {
  // TODO: Plan 4 — returns storage will be rebuilt
  res.status(501).json({ message: "Returns management not yet implemented — see Plan 4" });
});

router.post("/api/store/admin/returns/:id/receive", authenticateToken, requireAdmin, async (_req, res) => {
  // TODO: Plan 4 — returns storage will be rebuilt
  res.status(501).json({ message: "Returns management not yet implemented — see Plan 4" });
});

router.post("/api/store/admin/returns/:id/refund", authenticateToken, requireAdmin, async (_req, res) => {
  // TODO: Plan 4 — returns storage will be rebuilt
  res.status(501).json({ message: "Returns management not yet implemented — see Plan 4" });
});

// ==================== Delivery Zones ====================

router.get("/api/store/admin/delivery-zones", authenticateToken, requireAdmin, async (_req, res) => {
  try {
    res.json(await settings.getAllDeliveryZones());
  } catch (error) {
    res.status(500).json({ message: "Failed to get delivery zones" });
  }
});

router.post("/api/store/admin/delivery-zones", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const zone = await settings.createDeliveryZone(req.body);
    res.status(201).json(zone);
  } catch (error) {
    res.status(500).json({ message: "Failed to create delivery zone" });
  }
});

router.patch("/api/store/admin/delivery-zones/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const zone = await settings.updateDeliveryZone(String(req.params.id), req.body);
    if (!zone) return res.status(404).json({ message: "Delivery zone not found" });
    res.json(zone);
  } catch (error) {
    res.status(500).json({ message: "Failed to update delivery zone" });
  }
});

router.delete("/api/store/admin/delivery-zones/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await settings.deleteDeliveryZone(String(req.params.id));
    res.json({ message: "Delivery zone deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete delivery zone" });
  }
});

// ==================== Store Settings ====================

router.get("/api/store/admin/settings", authenticateToken, requireAdmin, async (_req, res) => {
  try {
    res.json(await settings.getStoreSettings());
  } catch (error) {
    res.status(500).json({ message: "Failed to get store settings" });
  }
});

router.patch("/api/store/admin/settings", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const updated = await settings.updateStoreSettings(req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update store settings" });
  }
});

// ==================== Sync Status ====================

router.get("/api/store/admin/settings/sync-status", authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const stats = await syncStorage.getQueueStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: "Failed to get sync status" });
  }
});

router.post("/api/store/admin/settings/sync-retry/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await syncStorage.retryEvent(String(req.params.id));
    res.json({ message: "Event queued for retry" });
  } catch (error) {
    res.status(500).json({ message: "Failed to retry sync event" });
  }
});

router.post("/api/store/admin/settings/sync-resolve/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await syncStorage.resolveEvent(String(req.params.id));
    res.json({ message: "Event resolved" });
  } catch (error) {
    res.status(500).json({ message: "Failed to resolve sync event" });
  }
});

export default router;
