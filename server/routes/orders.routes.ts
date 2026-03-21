/**
 * Customer order routes -- requires authenticated customer.
 */
import { Router } from "express";
import { authenticateToken } from "../middleware.js";
import * as orders from "../storage/orders.js";

const router = Router();

// Customer order history
router.get("/api/store/orders", authenticateToken, async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await orders.getOrdersByCustomer(
      req.customer!.customerId,
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 20,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to get orders" });
  }
});

// Single order detail
router.get("/api/store/orders/:id", authenticateToken, async (req, res) => {
  try {
    const order = await orders.getOrder(String(req.params.id));
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.customerId !== req.customer!.customerId) {
      return res.status(403).json({ message: "Not authorized to view this order" });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Failed to get order" });
  }
});

// Customer cancel order (only from "placed" status)
router.post("/api/store/orders/:id/cancel", authenticateToken, async (req, res) => {
  try {
    const order = await orders.getOrder(String(req.params.id));
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.customerId !== req.customer!.customerId) {
      return res.status(403).json({ message: "Not authorized to cancel this order" });
    }
    if (order.status !== "placed") {
      return res.status(400).json({ message: "Can only cancel orders in 'placed' status" });
    }
    await orders.cancelOrder(
      String(req.params.id),
      req.body.reason || "Customer cancelled",
      req.customer!.customerId,
    );
    // Re-fetch to return the updated order
    const updated = await orders.getOrder(String(req.params.id));
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel order";
    res.status(400).json({ message });
  }
});

export default router;
