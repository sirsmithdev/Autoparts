/**
 * Checkout and payment routes.
 *
 * Payment gateway integration is a placeholder (Plan 3).
 * For now, orders are immediately confirmed after creation so the
 * full order lifecycle can be exercised without a payment provider.
 */
import { Router } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware.js";
import * as orders from "../storage/orders.js";

const router = Router();

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const checkoutBodySchema = z.object({
  deliveryMethod: z.enum(["local_delivery", "pickup"]),
  deliveryZoneId: z.string().optional(),
  deliveryAddress: z.string().optional(),
  deliveryParish: z.string().optional(),
  deliveryNotes: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST /api/store/checkout
// ---------------------------------------------------------------------------

router.post("/api/store/checkout", authenticateToken, async (req, res) => {
  try {
    const body = checkoutBodySchema.parse(req.body);

    const { order, items } = await orders.createPendingOrder({
      customerId: req.customer!.customerId,
      ...body,
    });

    // Temporary (Plan 3): immediately confirm payment so the order flow works
    // end-to-end without a real payment gateway.
    await orders.confirmOrderPayment(order.id, "manual-pending-payment-integration");

    res.status(201).json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      deliveryFee: order.deliveryFee,
      total: order.total,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0]?.message || "Invalid request body" });
    }
    const message = error instanceof Error ? error.message : "Checkout failed";
    console.error("Checkout failed:", error);
    res.status(500).json({ message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/store/payment-callback  (public — placeholder for Plan 3)
// ---------------------------------------------------------------------------

router.post("/api/store/payment-callback", async (_req, res) => {
  res.status(200).json({ message: "Payment callback - not yet implemented" });
});

// ---------------------------------------------------------------------------
// POST /api/store/orders/:id/retry-payment  (placeholder for Plan 3)
// ---------------------------------------------------------------------------

router.post("/api/store/orders/:id/retry-payment", authenticateToken, async (_req, res) => {
  res.status(501).json({ message: "Payment retry not yet implemented" });
});

export default router;
