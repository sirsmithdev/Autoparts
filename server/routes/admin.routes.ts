/**
 * Staff admin routes — requires admin role (JWT-based).
 * Handles order fulfillment, returns management, delivery zones, store settings, sync status.
 */
import { Router } from "express";
import { authenticateToken, requirePermission } from "../middleware.js";
import * as orders from "../storage/orders.js";
import * as returns from "../storage/returns.js";
import * as settings from "../storage/settings.js";
import * as syncStorage from "../storage/sync.js";
import * as staffActivity from "../storage/staffActivity.js";

const router = Router();

// ==================== Order Management ====================

router.get("/api/store/admin/orders", authenticateToken, requirePermission("orders:read"), async (req, res) => {
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

router.get("/api/store/admin/orders/:id", authenticateToken, requirePermission("orders:read"), async (req, res) => {
  try {
    const order = await orders.getOrder(String(req.params.id));
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Failed to get order" });
  }
});

router.post("/api/store/admin/orders/:id/confirm", authenticateToken, requirePermission("orders:manage"), async (req, res) => {
  try {
    const orderId = String(req.params.id);
    await orders.confirmOrder(orderId);
    const order = await orders.getOrder(orderId);
    staffActivity.logActivity({ staffId: req.customer!.customerId, action: "order_confirmed", entity: "order", entityId: orderId, ipAddress: req.ip });
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to confirm order";
    res.status(400).json({ message });
  }
});

// Start picking — confirmed → picking
router.post("/api/store/admin/orders/:id/start-picking", authenticateToken, requirePermission("orders:manage"), async (req, res) => {
  try {
    await orders.markOrderPicking(String(req.params.id));
    const order = await orders.getOrder(String(req.params.id));
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start picking";
    res.status(400).json({ message });
  }
});

router.post("/api/store/admin/orders/:id/pack", authenticateToken, requirePermission("orders:manage"), async (req, res) => {
  try {
    const orderId = String(req.params.id);
    await orders.markOrderPacked(orderId, req.customer!.customerId);
    const order = await orders.getOrder(orderId);
    staffActivity.logActivity({ staffId: req.customer!.customerId, action: "order_packed", entity: "order", entityId: orderId, ipAddress: req.ip });
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to mark packed";
    res.status(400).json({ message });
  }
});

router.post("/api/store/admin/orders/:id/ship", authenticateToken, requirePermission("orders:manage"), async (req, res) => {
  try {
    const orderId = String(req.params.id);
    const { trackingNumber } = req.body;
    await orders.markOrderShipped(orderId, trackingNumber || "");
    const order = await orders.getOrder(orderId);
    staffActivity.logActivity({ staffId: req.customer!.customerId, action: "order_shipped", entity: "order", entityId: orderId, ipAddress: req.ip });
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to mark shipped";
    res.status(400).json({ message });
  }
});

router.post("/api/store/admin/orders/:id/out-for-delivery", authenticateToken, requirePermission("orders:manage"), async (req, res) => {
  try {
    await orders.markOrderOutForDelivery(String(req.params.id));
    const order = await orders.getOrder(String(req.params.id));
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update order";
    res.status(400).json({ message });
  }
});

router.post("/api/store/admin/orders/:id/deliver", authenticateToken, requirePermission("orders:manage"), async (req, res) => {
  try {
    const orderId = String(req.params.id);
    await orders.markOrderDelivered(orderId);
    const order = await orders.getOrder(orderId);
    staffActivity.logActivity({ staffId: req.customer!.customerId, action: "order_delivered", entity: "order", entityId: orderId, ipAddress: req.ip });
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to mark delivered";
    res.status(400).json({ message });
  }
});

router.post("/api/store/admin/orders/:id/ready-for-pickup", authenticateToken, requirePermission("orders:manage"), async (req, res) => {
  try {
    const orderId = String(req.params.id);
    const { pickupCode } = await orders.markOrderReadyForPickup(orderId);
    const order = await orders.getOrder(orderId);
    staffActivity.logActivity({ staffId: req.customer!.customerId, action: "order_ready_pickup", entity: "order", entityId: orderId, ipAddress: req.ip });
    res.json({ ...order, pickupCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update order";
    res.status(400).json({ message });
  }
});

// Verify a pickup code — staff scans QR or enters code manually
router.post("/api/store/admin/orders/verify-pickup", authenticateToken, requirePermission("orders:manage"), async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== "string") return res.status(400).json({ message: "code is required" });
    const order = await orders.findByPickupCode(code.toUpperCase().trim());
    if (!order) return res.status(404).json({ message: "No order found with this pickup code" });
    const full = await orders.getOrder(order.id);
    res.json(full);
  } catch (error) {
    res.status(500).json({ message: "Failed to verify pickup code" });
  }
});

router.post("/api/store/admin/orders/:id/picked-up", authenticateToken, requirePermission("orders:manage"), async (req, res) => {
  try {
    const orderId = String(req.params.id);
    const pickedUpBy = req.body.pickedUpBy || req.customer?.email || "staff";
    await orders.markOrderPickedUp(orderId, pickedUpBy);
    const order = await orders.getOrder(orderId);
    staffActivity.logActivity({ staffId: req.customer!.customerId, action: "order_picked_up", entity: "order", entityId: orderId, ipAddress: req.ip });
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update order";
    res.status(400).json({ message });
  }
});

router.post("/api/store/admin/orders/:id/cancel", authenticateToken, requirePermission("orders:manage"), async (req, res) => {
  try {
    const orderId = String(req.params.id);
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: "reason is required" });
    await orders.cancelOrder(orderId, reason, req.customer!.customerId);
    const order = await orders.getOrder(orderId);
    staffActivity.logActivity({ staffId: req.customer!.customerId, action: "order_cancelled", entity: "order", entityId: orderId, ipAddress: req.ip });
    res.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel order";
    res.status(400).json({ message });
  }
});

router.patch("/api/store/admin/orders/:id/notes", authenticateToken, requirePermission("orders:manage"), async (req, res) => {
  try {
    await orders.updateOrderNotes(String(req.params.id), req.body.staffNotes || "");
    const order = await orders.getOrder(String(req.params.id));
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Failed to update notes" });
  }
});

// ==================== Returns Management ====================

router.get("/api/store/admin/returns", authenticateToken, requirePermission("returns:read"), async (req, res) => {
  try {
    const { status, search, page, limit } = req.query;
    const result = await returns.getAllReturns({
      status: status as string,
      search: search as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to get returns" });
  }
});

router.get("/api/store/admin/returns/:id", authenticateToken, requirePermission("returns:read"), async (req, res) => {
  try {
    const ret = await returns.getReturn(String(req.params.id));
    if (!ret) return res.status(404).json({ message: "Return not found" });
    res.json(ret);
  } catch (error) {
    res.status(500).json({ message: "Failed to get return" });
  }
});

router.post("/api/store/admin/returns/:id/approve", authenticateToken, requirePermission("returns:manage"), async (req, res) => {
  try {
    const returnId = String(req.params.id);
    await returns.approveReturn(returnId, req.customer!.customerId);
    const ret = await returns.getReturn(returnId);
    staffActivity.logActivity({ staffId: req.customer!.customerId, action: "return_approved", entity: "return", entityId: returnId, ipAddress: req.ip });
    res.json(ret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to approve return";
    res.status(400).json({ message });
  }
});

router.post("/api/store/admin/returns/:id/reject", authenticateToken, requirePermission("returns:manage"), async (req, res) => {
  try {
    const returnId = String(req.params.id);
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: "reason is required" });
    await returns.rejectReturn(returnId, req.customer!.customerId, reason);
    const ret = await returns.getReturn(returnId);
    staffActivity.logActivity({ staffId: req.customer!.customerId, action: "return_rejected", entity: "return", entityId: returnId, ipAddress: req.ip });
    res.json(ret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reject return";
    res.status(400).json({ message });
  }
});

router.post("/api/store/admin/returns/:id/receive", authenticateToken, requirePermission("returns:manage"), async (req, res) => {
  try {
    const returnId = String(req.params.id);
    const { itemConditions } = req.body;
    if (!Array.isArray(itemConditions)) {
      return res.status(400).json({ message: "itemConditions array is required" });
    }
    await returns.receiveReturn(returnId, req.customer!.customerId, itemConditions);
    const ret = await returns.getReturn(returnId);
    staffActivity.logActivity({ staffId: req.customer!.customerId, action: "return_received", entity: "return", entityId: returnId, ipAddress: req.ip });
    res.json(ret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to receive return";
    res.status(400).json({ message });
  }
});

router.post("/api/store/admin/returns/:id/refund", authenticateToken, requirePermission("returns:manage"), async (req, res) => {
  try {
    const returnId = String(req.params.id);
    await returns.refundReturn(returnId);
    const ret = await returns.getReturn(returnId);
    staffActivity.logActivity({ staffId: req.customer!.customerId, action: "return_refunded", entity: "return", entityId: returnId, ipAddress: req.ip });
    res.json(ret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to refund return";
    res.status(400).json({ message });
  }
});

router.post("/api/store/admin/returns/:id/exchange", authenticateToken, requirePermission("returns:manage"), async (req, res) => {
  try {
    await returns.exchangeReturn(String(req.params.id), req.body.staffNotes);
    const ret = await returns.getReturn(String(req.params.id));
    res.json(ret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to exchange return";
    res.status(400).json({ message });
  }
});

router.post("/api/store/admin/returns/:id/store-credit", authenticateToken, requirePermission("returns:manage"), async (req, res) => {
  try {
    await returns.storeCreditReturn(String(req.params.id), req.body.staffNotes);
    const ret = await returns.getReturn(String(req.params.id));
    res.json(ret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to issue store credit";
    res.status(400).json({ message });
  }
});

// ==================== Delivery Zones ====================

router.get("/api/store/admin/delivery-zones", authenticateToken, requirePermission("settings:manage"), async (_req, res) => {
  try {
    res.json(await settings.getAllDeliveryZones());
  } catch (error) {
    res.status(500).json({ message: "Failed to get delivery zones" });
  }
});

router.post("/api/store/admin/delivery-zones", authenticateToken, requirePermission("settings:manage"), async (req, res) => {
  try {
    const zone = await settings.createDeliveryZone(req.body);
    res.status(201).json(zone);
  } catch (error) {
    res.status(500).json({ message: "Failed to create delivery zone" });
  }
});

router.patch("/api/store/admin/delivery-zones/:id", authenticateToken, requirePermission("settings:manage"), async (req, res) => {
  try {
    const zone = await settings.updateDeliveryZone(String(req.params.id), req.body);
    if (!zone) return res.status(404).json({ message: "Delivery zone not found" });
    res.json(zone);
  } catch (error) {
    res.status(500).json({ message: "Failed to update delivery zone" });
  }
});

router.delete("/api/store/admin/delivery-zones/:id", authenticateToken, requirePermission("settings:manage"), async (req, res) => {
  try {
    await settings.deleteDeliveryZone(String(req.params.id));
    res.json({ message: "Delivery zone deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete delivery zone" });
  }
});

// ==================== Store Settings ====================

router.get("/api/store/admin/settings", authenticateToken, requirePermission("settings:read"), async (_req, res) => {
  try {
    res.json(await settings.getStoreSettings());
  } catch (error) {
    res.status(500).json({ message: "Failed to get store settings" });
  }
});

router.patch("/api/store/admin/settings", authenticateToken, requirePermission("settings:manage"), async (req, res) => {
  try {
    const updated = await settings.updateStoreSettings(req.body);
    staffActivity.logActivity({ staffId: req.customer!.customerId, action: "settings_updated", entity: "settings", ipAddress: req.ip });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update store settings" });
  }
});

// ==================== Sync Status ====================

router.get("/api/store/admin/settings/sync-status", authenticateToken, requirePermission("sync:manage"), async (_req, res) => {
  try {
    const stats = await syncStorage.getQueueStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: "Failed to get sync status" });
  }
});

router.post("/api/store/admin/settings/sync-retry/:id", authenticateToken, requirePermission("sync:manage"), async (req, res) => {
  try {
    await syncStorage.retryEvent(String(req.params.id));
    res.json({ message: "Event queued for retry" });
  } catch (error) {
    res.status(500).json({ message: "Failed to retry sync event" });
  }
});

router.post("/api/store/admin/settings/sync-resolve/:id", authenticateToken, requirePermission("sync:manage"), async (req, res) => {
  try {
    await syncStorage.resolveEvent(String(req.params.id));
    res.json({ message: "Event resolved" });
  } catch (error) {
    res.status(500).json({ message: "Failed to resolve sync event" });
  }
});

export default router;
