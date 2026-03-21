/**
 * Checkout and payment routes.
 *
 * Integrates with PowerTranz SPI for real card payments:
 * - New card: SPI Sale with card data + 3DS -> callback -> complete
 * - Saved card: SPI Sale with PanToken + 3DS -> callback -> complete
 */
import { Router } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware.js";
import * as orders from "../storage/orders.js";
import * as pm from "../storage/paymentMethods.js";
import {
  initiateSPIAuthWithCard,
  initiateSPIAuthWithToken,
  completeSPIPayment,
  parseSPICallback,
} from "../payment/powertranz.js";
import { randomUUID } from "crypto";

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
  // Payment: either a saved card ID or raw card details
  paymentMethodId: z.string().optional(),
  cardDetails: z.object({
    cardPan: z.string().min(13),
    cardCvv: z.string().min(3).max(4),
    cardExpiration: z.string().min(4).max(4),
    cardholderName: z.string().min(1),
  }).optional(),
});

// ---------------------------------------------------------------------------
// POST /api/store/checkout
// ---------------------------------------------------------------------------

router.post("/api/store/checkout", authenticateToken, async (req, res) => {
  try {
    const body = checkoutBodySchema.parse(req.body);

    // 1. Create pending order (reserves stock, clears cart)
    const { order, items } = await orders.createPendingOrder({
      customerId: req.customer!.customerId,
      deliveryMethod: body.deliveryMethod,
      deliveryZoneId: body.deliveryZoneId,
      deliveryAddress: body.deliveryAddress,
      deliveryParish: body.deliveryParish,
      deliveryNotes: body.deliveryNotes,
    });

    const totalAmount = parseFloat(order.total);
    const transactionId = randomUUID();
    const callbackUrl = `${process.env.POWERTRANZ_CALLBACK_URL || `${process.env.BASE_URL || ""}/api/store/payment-callback`}`;
    // Append orderId as query param so callback can find the order
    const responseUrl = `${callbackUrl}?orderId=${order.id}`;

    // 2. Initiate payment
    if (body.paymentMethodId) {
      // --- Saved card flow ---
      const method = await pm.getPaymentMethod(body.paymentMethodId, req.customer!.customerId);
      if (!method || !method.panToken) {
        return res.status(400).json({ message: "Invalid payment method" });
      }

      const spiResult = await initiateSPIAuthWithToken({
        transactionId,
        amount: totalAmount,
        currency: "JMD",
        orderNumber: order.orderNumber,
        panToken: method.panToken,
        billing: {
          firstName: req.customer!.email,
        },
        responseUrl,
      });

      if (!spiResult.success) {
        return res.status(502).json({
          message: spiResult.error || "Payment gateway error",
          orderId: order.id,
          orderNumber: order.orderNumber,
        });
      }

      return res.status(201).json({
        orderId: order.id,
        orderNumber: order.orderNumber,
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        deliveryFee: order.deliveryFee,
        total: order.total,
        spiToken: spiResult.spiToken,
        redirectData: spiResult.redirectData,
      });
    } else if (body.cardDetails) {
      // --- New card flow ---
      const spiResult = await initiateSPIAuthWithCard({
        transactionId,
        amount: totalAmount,
        currency: "JMD",
        orderNumber: order.orderNumber,
        source: {
          cardPan: body.cardDetails.cardPan,
          cardCvv: body.cardDetails.cardCvv,
          cardExpiration: body.cardDetails.cardExpiration,
          cardholderName: body.cardDetails.cardholderName,
        },
        billing: {
          firstName: body.cardDetails.cardholderName.split(" ")[0] || "",
          lastName: body.cardDetails.cardholderName.split(" ").slice(1).join(" ") || "",
          email: req.customer!.email,
        },
        responseUrl,
      });

      if (!spiResult.success) {
        return res.status(502).json({
          message: spiResult.error || "Payment gateway error",
          orderId: order.id,
          orderNumber: order.orderNumber,
        });
      }

      return res.status(201).json({
        orderId: order.id,
        orderNumber: order.orderNumber,
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        deliveryFee: order.deliveryFee,
        total: order.total,
        spiToken: spiResult.spiToken,
        redirectData: spiResult.redirectData,
      });
    } else {
      // --- No payment info: return order details for client-side payment initiation ---
      return res.status(201).json({
        orderId: order.id,
        orderNumber: order.orderNumber,
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        deliveryFee: order.deliveryFee,
        total: order.total,
        requiresPayment: true,
      });
    }
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
// POST /api/store/payment-callback  (public — PowerTranz posts here after 3DS)
// ---------------------------------------------------------------------------

router.post("/api/store/payment-callback", async (req, res) => {
  try {
    const orderId = req.query.orderId as string;
    if (!orderId) {
      console.error("[payment-callback] Missing orderId in query");
      return res.status(400).send(buildRedirectPage("/checkout/failure", "Missing order reference"));
    }

    // Parse the callback from PowerTranz
    const callback = parseSPICallback(req.body);
    console.log("[payment-callback] Received callback", {
      orderId,
      isValid: callback.isValid,
      isoResponseCode: callback.isoResponseCode,
      hasSpiToken: !!callback.spiToken,
    });

    if (!callback.isValid || !callback.spiToken) {
      console.error("[payment-callback] Invalid callback data", { orderId });
      return res.status(200).send(buildRedirectPage("/checkout/failure", "Invalid payment response"));
    }

    // Complete the payment via SPI /Payment
    const payment = await completeSPIPayment(callback.spiToken);
    console.log("[payment-callback] Payment completion result", {
      orderId,
      approved: payment.approved,
      isoResponseCode: payment.isoResponseCode,
      transactionId: payment.transactionId,
    });

    if (payment.approved) {
      // Mark order as paid
      const txId = payment.transactionId || payment.referenceNumber || callback.spiToken;
      await orders.confirmOrderPayment(orderId, txId);
      return res.status(200).send(buildRedirectPage(`/orders/${orderId}`, null));
    }

    // Payment declined — order stays pending_payment (cleaned up by cron)
    const reason = payment.responseMessage || payment.error || "Payment declined";
    console.warn("[payment-callback] Payment declined", { orderId, reason });
    return res.status(200).send(buildRedirectPage(`/checkout/failure?orderId=${orderId}`, reason));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Payment processing failed";
    console.error("[payment-callback] Error:", error);
    return res.status(200).send(buildRedirectPage("/checkout/failure", msg));
  }
});

// ---------------------------------------------------------------------------
// POST /api/store/orders/:id/retry-payment
// ---------------------------------------------------------------------------

router.post("/api/store/orders/:id/retry-payment", authenticateToken, async (req, res) => {
  try {
    const orderId = String(req.params.id);

    // Verify order ownership and status
    const order = await orders.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.customerId !== req.customer!.customerId) {
      return res.status(403).json({ message: "Not your order" });
    }
    if (order.status !== "pending_payment") {
      return res.status(400).json({ message: `Order is in "${order.status}" status, not pending_payment` });
    }

    const totalAmount = parseFloat(order.total);
    const transactionId = randomUUID();
    const callbackUrl = `${process.env.POWERTRANZ_CALLBACK_URL || `${process.env.BASE_URL || ""}/api/store/payment-callback`}`;
    const responseUrl = `${callbackUrl}?orderId=${orderId}`;

    // Check for payment method in body
    const paymentMethodId = req.body.paymentMethodId as string | undefined;
    const cardDetails = req.body.cardDetails as {
      cardPan: string;
      cardCvv: string;
      cardExpiration: string;
      cardholderName: string;
    } | undefined;

    if (paymentMethodId) {
      // Saved card
      const method = await pm.getPaymentMethod(paymentMethodId, req.customer!.customerId);
      if (!method || !method.panToken) {
        return res.status(400).json({ message: "Invalid payment method" });
      }

      const spiResult = await initiateSPIAuthWithToken({
        transactionId,
        amount: totalAmount,
        currency: "JMD",
        orderNumber: order.orderNumber,
        panToken: method.panToken,
        billing: { firstName: req.customer!.email },
        responseUrl,
      });

      if (!spiResult.success) {
        return res.status(502).json({ message: spiResult.error || "Payment gateway error" });
      }

      return res.json({
        spiToken: spiResult.spiToken,
        redirectData: spiResult.redirectData,
      });
    } else if (cardDetails) {
      // New card
      const spiResult = await initiateSPIAuthWithCard({
        transactionId,
        amount: totalAmount,
        currency: "JMD",
        orderNumber: order.orderNumber,
        source: {
          cardPan: cardDetails.cardPan,
          cardCvv: cardDetails.cardCvv,
          cardExpiration: cardDetails.cardExpiration,
          cardholderName: cardDetails.cardholderName,
        },
        billing: {
          firstName: cardDetails.cardholderName.split(" ")[0] || "",
          lastName: cardDetails.cardholderName.split(" ").slice(1).join(" ") || "",
          email: req.customer!.email,
        },
        responseUrl,
      });

      if (!spiResult.success) {
        return res.status(502).json({ message: spiResult.error || "Payment gateway error" });
      }

      return res.json({
        spiToken: spiResult.spiToken,
        redirectData: spiResult.redirectData,
      });
    } else {
      return res.status(400).json({ message: "Payment method or card details required" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Retry payment failed";
    console.error("Retry payment error:", error);
    res.status(500).json({ message });
  }
});

// ---------------------------------------------------------------------------
// Helper: Build HTML redirect page (3DS callback returns HTML to the iframe)
// ---------------------------------------------------------------------------

function buildRedirectPage(path: string, errorMessage: string | null): string {
  // The 3DS iframe needs to redirect the parent window to the result page.
  // We use postMessage so the React app can handle the redirect.
  const payload = JSON.stringify({ type: "payment-callback", path, error: errorMessage });
  return `<!DOCTYPE html>
<html>
<head><title>Processing payment...</title></head>
<body>
  <p>Processing your payment...</p>
  <script>
    try {
      window.parent.postMessage(${JSON.stringify(payload)}, '*');
    } catch (e) {
      // Fallback: redirect in current window
      window.location.href = '${path}';
    }
  </script>
</body>
</html>`;
}

export default router;
