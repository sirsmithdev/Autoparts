/**
 * Payment methods routes — manage saved cards.
 *
 * All routes require customer authentication.
 * Card verification + tokenization happens via the NCB verification flow
 * before a card can be saved here.
 */

import { Router } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware.js";
import * as pm from "../storage/paymentMethods.js";

const router = Router();

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const saveCardBodySchema = z.object({
  panToken: z.string().min(1, "PanToken is required"),
  cardBrand: z.string().min(1, "Card brand is required"),
  maskedPan: z.string().min(1, "Masked PAN is required"),
  cardholderName: z.string().min(1, "Cardholder name is required"),
  expiryMonth: z.number().int().min(1).max(12),
  expiryYear: z.number().int().min(2025),
});

// ---------------------------------------------------------------------------
// GET /api/store/payment-methods — list customer's saved cards
// ---------------------------------------------------------------------------

router.get("/api/store/payment-methods", authenticateToken, async (req, res) => {
  try {
    const methods = await pm.getPaymentMethods(req.customer!.customerId);

    // Never expose the full panToken to the client
    const safe = methods.map((m) => ({
      id: m.id,
      cardBrand: m.cardBrand,
      maskedPan: m.maskedPan,
      cardholderName: m.cardholderName,
      expiryMonth: m.expiryMonth,
      expiryYear: m.expiryYear,
      isDefault: m.isDefault,
      isVerified: m.isVerified,
      createdAt: m.createdAt,
    }));

    res.json(safe);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load payment methods";
    console.error("GET /api/store/payment-methods error:", error);
    res.status(500).json({ message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/store/payment-methods — save a new card (after NCB verification)
// ---------------------------------------------------------------------------

router.post("/api/store/payment-methods", authenticateToken, async (req, res) => {
  try {
    const body = saveCardBodySchema.parse(req.body);

    const method = await pm.createPaymentMethod({
      customerId: req.customer!.customerId,
      ...body,
    });

    res.status(201).json({
      id: method.id,
      cardBrand: method.cardBrand,
      maskedPan: method.maskedPan,
      cardholderName: method.cardholderName,
      expiryMonth: method.expiryMonth,
      expiryYear: method.expiryYear,
      isDefault: method.isDefault,
      isVerified: method.isVerified,
      createdAt: method.createdAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0]?.message || "Invalid request body" });
    }
    const message = error instanceof Error ? error.message : "Failed to save payment method";
    console.error("POST /api/store/payment-methods error:", error);
    res.status(500).json({ message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/store/payment-methods/:id — delete a saved card
// ---------------------------------------------------------------------------

router.delete("/api/store/payment-methods/:id", authenticateToken, async (req, res) => {
  try {
    const id = String(req.params.id);
    const method = await pm.getPaymentMethod(id, req.customer!.customerId);
    if (!method) {
      return res.status(404).json({ message: "Payment method not found" });
    }

    await pm.deletePaymentMethod(id, req.customer!.customerId);
    res.json({ message: "Payment method deleted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete payment method";
    console.error("DELETE /api/store/payment-methods/:id error:", error);
    res.status(500).json({ message });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/store/payment-methods/:id/default — set as default
// ---------------------------------------------------------------------------

router.patch("/api/store/payment-methods/:id/default", authenticateToken, async (req, res) => {
  try {
    const id = String(req.params.id);
    const method = await pm.getPaymentMethod(id, req.customer!.customerId);
    if (!method) {
      return res.status(404).json({ message: "Payment method not found" });
    }

    await pm.setDefaultPaymentMethod(id, req.customer!.customerId);
    res.json({ message: "Default payment method updated" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update default";
    console.error("PATCH /api/store/payment-methods/:id/default error:", error);
    res.status(500).json({ message });
  }
});

export default router;
