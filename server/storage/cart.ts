/**
 * Cart storage module — shopping cart CRUD, stock validation, guest merge, stale cleanup.
 */

import { eq, and, sql, desc } from "drizzle-orm";
import { db } from "../db.js";
import {
  shoppingCarts,
  shoppingCartItems,
  products,
  productImages,
  storeSettings,
  type ShoppingCart,
  type ShoppingCartItem,
  type Product,
  type ProductImage,
  type StoreSettings,
} from "../schema.js";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CartItemStockStatus =
  | "available"
  | "low_stock"
  | "insufficient_stock"
  | "out_of_stock";

export type CartItemWithProduct = ShoppingCartItem & {
  product: Product;
  images: ProductImage[];
  stockStatus: CartItemStockStatus;
  priceChanged: boolean;
  currentPrice: string;
};

export type CartWithItems = {
  cart: ShoppingCart;
  items: CartItemWithProduct[];
  itemCount: number;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getSettings(): Promise<StoreSettings | undefined> {
  const [row] = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.id, 1))
    .limit(1);
  return row;
}

// ---------------------------------------------------------------------------
// Cart CRUD
// ---------------------------------------------------------------------------

/** Get or create a cart for the given customer (upsert). */
export async function getOrCreateCart(customerId: string): Promise<ShoppingCart> {
  const [existing] = await db
    .select()
    .from(shoppingCarts)
    .where(eq(shoppingCarts.customerId, customerId))
    .limit(1);

  if (existing) {
    const now = new Date();
    await db
      .update(shoppingCarts)
      .set({ lastActivityAt: now })
      .where(eq(shoppingCarts.id, existing.id));
    return { ...existing, lastActivityAt: now };
  }

  const id = randomUUID();
  await db.insert(shoppingCarts).values({ id, customerId });
  const [cart] = await db
    .select()
    .from(shoppingCarts)
    .where(eq(shoppingCarts.id, id))
    .limit(1);
  return cart;
}

/** Get cart with enriched items — live product data, stock status, price-change detection. */
export async function getCartWithItems(customerId: string): Promise<CartWithItems> {
  const cart = await getOrCreateCart(customerId);

  const items = await db
    .select()
    .from(shoppingCartItems)
    .where(eq(shoppingCartItems.cartId, cart.id))
    .orderBy(desc(shoppingCartItems.addedAt));

  if (items.length === 0) {
    return { cart, items: [], itemCount: 0 };
  }

  // Batch-fetch products and images for all items in the cart
  const productIds = items.map((i) => i.productId);
  const productRows = await db
    .select()
    .from(products)
    .where(
      sql`${products.id} IN (${sql.join(
        productIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
  const imageRows = await db
    .select()
    .from(productImages)
    .where(
      sql`${productImages.productId} IN (${sql.join(
        productIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );

  const productMap = new Map(productRows.map((p) => [p.id, p]));
  const imageMap = new Map<string, ProductImage[]>();
  for (const img of imageRows) {
    const bucket = imageMap.get(img.productId) ?? [];
    bucket.push(img);
    imageMap.set(img.productId, bucket);
  }

  const enrichedItems: CartItemWithProduct[] = items
    .filter((item) => productMap.has(item.productId))
    .map((item) => {
      const product = productMap.get(item.productId)!;
      const currentPrice = product.salePrice ?? "0.00";
      const priceChanged = item.priceAtAddTime !== currentPrice;

      let stockStatus: CartItemStockStatus = "available";
      if (product.quantity <= 0) {
        stockStatus = "out_of_stock";
      } else if (product.quantity < item.quantity) {
        stockStatus = "insufficient_stock";
      } else if (product.quantity <= product.lowStockThreshold) {
        stockStatus = "low_stock";
      }

      return {
        ...item,
        product,
        images: imageMap.get(item.productId) ?? [],
        stockStatus,
        priceChanged,
        currentPrice,
      };
    });

  const itemCount = enrichedItems.reduce((sum, i) => sum + i.quantity, 0);
  return { cart, items: enrichedItems, itemCount };
}

/** Add an item to the cart (validates product active, stock, qty limits from settings). */
export async function addCartItem(
  customerId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) throw new Error("Quantity must be greater than zero");

  const cart = await getOrCreateCart(customerId);
  const settings = await getSettings();

  // Validate product exists and is active
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.isActive, true)))
    .limit(1);
  if (!product) throw new Error("Product not found or not available");

  const maxQty = settings?.maxQuantityPerItem ?? 50;
  if (quantity > maxQty) throw new Error(`Maximum ${maxQty} per item`);
  if (quantity > product.quantity) throw new Error("Insufficient stock");

  // Check if the item is already in the cart
  const [existing] = await db
    .select()
    .from(shoppingCartItems)
    .where(
      and(
        eq(shoppingCartItems.cartId, cart.id),
        eq(shoppingCartItems.productId, productId),
      ),
    )
    .limit(1);

  if (existing) {
    const newQty = existing.quantity + quantity;
    if (newQty > maxQty) throw new Error(`Maximum ${maxQty} per item`);
    if (newQty > product.quantity) throw new Error("Insufficient stock");
    await db
      .update(shoppingCartItems)
      .set({ quantity: newQty })
      .where(eq(shoppingCartItems.id, existing.id));
  } else {
    // Enforce max distinct items per order
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(shoppingCartItems)
      .where(eq(shoppingCartItems.cartId, cart.id));
    const maxItems = settings?.maxItemsPerOrder ?? 200;
    if ((countResult?.count ?? 0) >= maxItems)
      throw new Error("Cart item limit reached");

    await db.insert(shoppingCartItems).values({
      id: randomUUID(),
      cartId: cart.id,
      productId,
      quantity,
      priceAtAddTime: product.salePrice,
    });
  }

  await db
    .update(shoppingCarts)
    .set({ lastActivityAt: new Date() })
    .where(eq(shoppingCarts.id, cart.id));
}

/** Update the quantity of a cart item (revalidates stock). Removes the item if qty <= 0. */
export async function updateCartItemQuantity(
  customerId: string,
  itemId: string,
  quantity: number,
): Promise<void> {
  const cart = await getOrCreateCart(customerId);

  const [item] = await db
    .select()
    .from(shoppingCartItems)
    .where(
      and(
        eq(shoppingCartItems.id, itemId),
        eq(shoppingCartItems.cartId, cart.id),
      ),
    )
    .limit(1);
  if (!item) throw new Error("Cart item not found");

  if (quantity <= 0) {
    await db
      .delete(shoppingCartItems)
      .where(eq(shoppingCartItems.id, itemId));
    return;
  }

  const settings = await getSettings();
  const maxQty = settings?.maxQuantityPerItem ?? 50;
  if (quantity > maxQty) throw new Error(`Maximum ${maxQty} per item`);

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, item.productId))
    .limit(1);
  if (product && quantity > product.quantity)
    throw new Error("Insufficient stock");

  await db
    .update(shoppingCartItems)
    .set({ quantity })
    .where(eq(shoppingCartItems.id, itemId));
  await db
    .update(shoppingCarts)
    .set({ lastActivityAt: new Date() })
    .where(eq(shoppingCarts.id, cart.id));
}

/** Remove a single item from the cart. */
export async function removeCartItem(
  customerId: string,
  itemId: string,
): Promise<void> {
  const cart = await getOrCreateCart(customerId);
  await db
    .delete(shoppingCartItems)
    .where(
      and(
        eq(shoppingCartItems.id, itemId),
        eq(shoppingCartItems.cartId, cart.id),
      ),
    );
}

/** Clear all items from the customer's cart. */
export async function clearCart(customerId: string): Promise<void> {
  const [cart] = await db
    .select()
    .from(shoppingCarts)
    .where(eq(shoppingCarts.customerId, customerId))
    .limit(1);
  if (cart) {
    await db
      .delete(shoppingCartItems)
      .where(eq(shoppingCartItems.cartId, cart.id));
  }
}

/**
 * Merge guest cart items into the authenticated customer's cart.
 * Union strategy: for duplicate products the higher quantity wins.
 */
export async function mergeGuestCart(
  customerId: string,
  items: Array<{ productId: string; quantity: number }>,
): Promise<void> {
  const cart = await getOrCreateCart(customerId);

  for (const guest of items) {
    try {
      // Check if the product is already in the cart
      const [existing] = await db
        .select()
        .from(shoppingCartItems)
        .where(
          and(
            eq(shoppingCartItems.cartId, cart.id),
            eq(shoppingCartItems.productId, guest.productId),
          ),
        )
        .limit(1);

      if (existing) {
        // Keep the higher quantity
        if (guest.quantity > existing.quantity) {
          const settings = await getSettings();
          const maxQty = settings?.maxQuantityPerItem ?? 50;
          const [product] = await db
            .select()
            .from(products)
            .where(
              and(
                eq(products.id, guest.productId),
                eq(products.isActive, true),
              ),
            )
            .limit(1);
          if (!product) continue;

          const clampedQty = Math.min(guest.quantity, maxQty, product.quantity);
          if (clampedQty > existing.quantity) {
            await db
              .update(shoppingCartItems)
              .set({ quantity: clampedQty })
              .where(eq(shoppingCartItems.id, existing.id));
          }
        }
      } else {
        // Product not yet in cart — add it via the standard path
        await addCartItem(customerId, guest.productId, guest.quantity);
      }
    } catch {
      // Skip items that fail validation (inactive, out of stock, etc.)
    }
  }
}

/** Cron: delete carts older than cartExpirationDays from store settings. Returns count deleted.
 *  Before deleting, sends abandoned-cart recovery emails for carts that are 3–30 days old
 *  and belong to a registered customer.
 */
export async function cleanupStaleCarts(): Promise<number> {
  const settings = await getSettings();
  const days = settings?.cartExpirationDays ?? 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // ── Send abandoned-cart emails for eligible carts (3–30 days old) ──
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Find carts that are about to be deleted (past cutoff) AND are in the 3–30 day window
    // Also find carts in the 3–30 day window that aren't yet expired (for future-proofing)
    const staleCarts = await db
      .select({
        cartId: shoppingCarts.id,
        customerId: shoppingCarts.customerId,
        lastActivityAt: shoppingCarts.lastActivityAt,
      })
      .from(shoppingCarts)
      .where(
        and(
          sql`${shoppingCarts.lastActivityAt} < ${threeDaysAgo}`,
          sql`${shoppingCarts.lastActivityAt} >= ${thirtyDaysAgo}`,
          sql`${shoppingCarts.customerId} IS NOT NULL`,
        ),
      );

    if (staleCarts.length > 0) {
      const { sendAbandonedCartEmail } = await import("../email.js");
      const { customers: customersTable } = await import("../schema.js");

      for (const cart of staleCarts) {
        try {
          // Count items in this cart
          const [countResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(shoppingCartItems)
            .where(eq(shoppingCartItems.cartId, cart.cartId));

          const itemCount = countResult?.count ?? 0;
          if (itemCount === 0) continue; // Skip empty carts

          // Look up the customer's email and name
          const [customer] = await db
            .select({
              email: customersTable.email,
              firstName: customersTable.firstName,
            })
            .from(customersTable)
            .where(eq(customersTable.id, cart.customerId))
            .limit(1);

          if (customer?.email) {
            const name = customer.firstName || "there";
            await sendAbandonedCartEmail(customer.email, name, itemCount);
          }
        } catch (emailError) {
          console.error("[cart cleanup] Failed to send abandoned cart email for cart:", cart.cartId, emailError);
        }
      }
    }
  } catch (error) {
    console.error("[cart cleanup] Error during abandoned cart email phase:", error);
    // Continue with deletion even if emails fail
  }

  // ── Delete expired carts ──
  const [result] = await db.execute(
    sql`DELETE FROM shopping_carts WHERE last_activity_at < ${cutoff}`,
  );
  return (result as any)?.affectedRows ?? 0;
}
