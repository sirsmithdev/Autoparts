/**
 * Wishlist storage module — save products for later.
 */

import { eq, and, sql } from "drizzle-orm";
import { db } from "../db.js";
import {
  wishlists,
  products,
  productImages,
  type Product,
  type ProductImage,
} from "../schema.js";
import { randomUUID } from "crypto";

// ─── Types ───────────────────────────────────────────────

export type WishlistItemWithProduct = {
  wishlistId: string;
  productId: string;
  createdAt: Date;
  product: Product;
  images: ProductImage[];
};

// ─── Queries ─────────────────────────────────────────────

/** Get the full wishlist for a customer, including product details and images. */
export async function getWishlist(customerId: string): Promise<WishlistItemWithProduct[]> {
  const rows = await db
    .select()
    .from(wishlists)
    .where(eq(wishlists.customerId, customerId))
    .orderBy(wishlists.createdAt);

  if (rows.length === 0) return [];

  const productIds = rows.map((r) => r.productId);

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

  return rows
    .filter((r) => productMap.has(r.productId))
    .map((r) => ({
      wishlistId: r.id,
      productId: r.productId,
      createdAt: r.createdAt,
      product: productMap.get(r.productId)!,
      images: imageMap.get(r.productId) ?? [],
    }));
}

/** Add a product to the wishlist. No-ops if already present. */
export async function addToWishlist(customerId: string, productId: string): Promise<void> {
  // Verify product exists and is active
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.isActive, true)))
    .limit(1);

  if (!product) throw new Error("Product not found or not available");

  // Check if already in wishlist
  const [existing] = await db
    .select()
    .from(wishlists)
    .where(
      and(
        eq(wishlists.customerId, customerId),
        eq(wishlists.productId, productId),
      ),
    )
    .limit(1);

  if (existing) return; // Already in wishlist, no-op

  await db.insert(wishlists).values({
    id: randomUUID(),
    customerId,
    productId,
  });
}

/** Remove a product from the wishlist. */
export async function removeFromWishlist(customerId: string, productId: string): Promise<void> {
  await db
    .delete(wishlists)
    .where(
      and(
        eq(wishlists.customerId, customerId),
        eq(wishlists.productId, productId),
      ),
    );
}

/** Check if a specific product is in the customer's wishlist. */
export async function isInWishlist(customerId: string, productId: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(wishlists)
    .where(
      and(
        eq(wishlists.customerId, customerId),
        eq(wishlists.productId, productId),
      ),
    )
    .limit(1);

  return !!row;
}
