/**
 * Wishlist routes — save products for later (authenticated customers).
 */
import { Router } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware.js";
import * as wishlist from "../storage/wishlist.js";

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/store/wishlist — Get full wishlist with product details
// ---------------------------------------------------------------------------

router.get("/api/store/wishlist", authenticateToken, async (req, res) => {
  try {
    const items = await wishlist.getWishlist(req.customer!.customerId);
    res.json(items);
  } catch (error) {
    console.error("Get wishlist failed", error);
    res.status(500).json({ message: "Failed to get wishlist" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/store/wishlist — Add a product to the wishlist
// ---------------------------------------------------------------------------

const addToWishlistSchema = z.object({
  productId: z.string().min(1),
});

router.post("/api/store/wishlist", authenticateToken, async (req, res) => {
  try {
    const body = addToWishlistSchema.parse(req.body);
    await wishlist.addToWishlist(req.customer!.customerId, body.productId);
    res.status(201).json({ message: "Added to wishlist" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors[0].message });
      return;
    }
    const message = error instanceof Error ? error.message : "Failed to add to wishlist";
    res.status(400).json({ message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/store/wishlist/:productId — Remove a product from the wishlist
// ---------------------------------------------------------------------------

router.delete("/api/store/wishlist/:productId", authenticateToken, async (req, res) => {
  try {
    await wishlist.removeFromWishlist(req.customer!.customerId, String(req.params.productId));
    res.json({ message: "Removed from wishlist" });
  } catch (error) {
    console.error("Remove from wishlist failed", error);
    res.status(500).json({ message: "Failed to remove from wishlist" });
  }
});

export default router;
