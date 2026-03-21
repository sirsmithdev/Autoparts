/**
 * Shopping cart routes — requires authenticated customer.
 */
import { Router } from "express";
import { authenticateToken } from "../middleware.js";
import * as cart from "../storage/cart.js";

const router = Router();

router.get("/api/store/cart", authenticateToken, async (req, res) => {
  try {
    const result = await cart.getCartWithItems(req.customer!.customerId);
    res.json(result);
  } catch (error) {
    console.error("Get cart failed", error);
    res.status(500).json({ message: "Failed to get cart" });
  }
});

router.post("/api/store/cart/items", authenticateToken, async (req, res) => {
  try {
    const { productId, quantity } = req.body || {};
    if (!productId || typeof productId !== "string") return res.status(400).json({ message: "productId is required" });
    const qty = typeof quantity === "string" ? parseInt(quantity, 10) : quantity;
    if (!qty || typeof qty !== "number" || qty < 1 || !Number.isInteger(qty)) return res.status(400).json({ message: "quantity must be a positive integer" });
    await cart.addCartItem(req.customer!.customerId, productId, qty);
    const result = await cart.getCartWithItems(req.customer!.customerId);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add item";
    res.status(400).json({ message });
  }
});

router.patch("/api/store/cart/items/:itemId", authenticateToken, async (req, res) => {
  try {
    const { quantity } = req.body || {};
    const patchQty = typeof quantity === "string" ? parseInt(quantity, 10) : quantity;
    if (patchQty === undefined || typeof patchQty !== "number" || patchQty < 1 || !Number.isInteger(patchQty)) {
      return res.status(400).json({ message: "quantity must be a positive integer" });
    }
    await cart.updateCartItemQuantity(req.customer!.customerId, String(req.params.itemId), patchQty);
    const result = await cart.getCartWithItems(req.customer!.customerId);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update item";
    res.status(400).json({ message });
  }
});

router.delete("/api/store/cart/items/:itemId", authenticateToken, async (req, res) => {
  try {
    await cart.removeCartItem(req.customer!.customerId, String(req.params.itemId));
    const result = await cart.getCartWithItems(req.customer!.customerId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to remove item" });
  }
});

router.delete("/api/store/cart", authenticateToken, async (req, res) => {
  try {
    await cart.clearCart(req.customer!.customerId);
    res.json({ message: "Cart cleared" });
  } catch (error) {
    res.status(500).json({ message: "Failed to clear cart" });
  }
});

router.post("/api/store/cart/merge", authenticateToken, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ message: "items array is required" });
    await cart.mergeGuestCart(req.customer!.customerId, items);
    const result = await cart.getCartWithItems(req.customer!.customerId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to merge cart" });
  }
});

export default router;
