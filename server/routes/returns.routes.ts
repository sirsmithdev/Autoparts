/**
 * Customer-facing return routes — create, list, and detail.
 * All endpoints require JWT authentication via authenticateToken.
 */
import { Router } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware.js";
import * as returns from "../storage/returns.js";

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/store/returns — Create a return request
// ---------------------------------------------------------------------------

const createReturnSchema = z.object({
  orderId: z.string(),
  items: z
    .array(
      z.object({
        orderItemId: z.string(),
        quantity: z.number().int().min(1),
        reason: z.enum([
          "wrong_part",
          "defective",
          "not_needed",
          "wrong_fitment",
          "damaged_in_shipping",
          "other",
        ]),
      }),
    )
    .min(1),
  reasonDetails: z.string().optional(),
});

router.post("/api/store/returns", authenticateToken, async (req, res) => {
  try {
    const body = createReturnSchema.parse(req.body);
    const result = await returns.createReturnRequest({
      ...body,
      customerId: req.customer!.customerId,
    });
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors[0].message });
      return;
    }
    const message =
      error instanceof Error ? error.message : "Failed to create return";
    res.status(400).json({ message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/store/returns — List returns for the authenticated customer
// ---------------------------------------------------------------------------

router.get("/api/store/returns", authenticateToken, async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const result = await returns.getReturnsByCustomer(
      req.customer!.customerId,
      page,
      limit,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to get returns" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/store/returns/:id — Return detail
// ---------------------------------------------------------------------------

router.get("/api/store/returns/:id", authenticateToken, async (req, res) => {
  try {
    const ret = await returns.getReturn(String(req.params.id));
    if (!ret) {
      res.status(404).json({ message: "Return not found" });
      return;
    }
    if (ret.customerId !== req.customer!.customerId) {
      res.status(403).json({ message: "You do not have access to this return" });
      return;
    }
    res.json(ret);
  } catch (error) {
    res.status(500).json({ message: "Failed to get return" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/store/returns/:id/tracking — Submit tracking number
// ---------------------------------------------------------------------------

const trackingSchema = z.object({
  trackingNumber: z.string().min(1, "Tracking number is required"),
});

router.post(
  "/api/store/returns/:id/tracking",
  authenticateToken,
  async (req, res) => {
    try {
      const body = trackingSchema.parse(req.body);
      const ret = await returns.getReturn(String(req.params.id));
      if (!ret) {
        res.status(404).json({ message: "Return not found" });
        return;
      }
      if (ret.customerId !== req.customer!.customerId) {
        res
          .status(403)
          .json({ message: "You do not have access to this return" });
        return;
      }
      if (ret.status !== "approved") {
        res.status(400).json({
          message: `Cannot submit tracking for return in "${ret.status}" status — must be "approved"`,
        });
        return;
      }
      await returns.markReturnShippedBack(
        String(req.params.id),
        body.trackingNumber,
      );
      res.json({ message: "Tracking number submitted and return marked as shipped back" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
        return;
      }
      const message =
        error instanceof Error
          ? error.message
          : "Failed to submit tracking number";
      res.status(400).json({ message });
    }
  },
);

export default router;
