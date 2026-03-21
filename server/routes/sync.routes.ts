/**
 * Inbound sync routes — receives product and stock data from the garage app.
 * All routes protected by x-sync-api-key header validation.
 */

import { Router } from "express";
import { db } from "../db.js";
import {
  products,
  productNumbers,
  productCompatibility,
  productImages,
} from "../schema.js";
import { validateSyncApiKey } from "../middleware.js";
import { logSyncEvent } from "../storage/sync.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

// All sync routes require API key
router.use("/api/sync", validateSyncApiKey);

// ─── Types ───────────────────────────────────────────────

interface ProductSyncPayload {
  garagePartId: string;
  name: string;
  partNumber: string;
  salePrice: string;
  quantity: number;
  lowStockThreshold: number;
  description?: string;
  longDescription?: string;
  manufacturer?: string;
  category?: string;
  imageUrl?: string;
  condition: string;
  weight?: string;
  isOversized: boolean;
  isFeatured: boolean;
  featuredSortOrder: number;
  numbers: Array<{
    partNumber: string;
    numberType: string;
    brand?: string;
    isPrimary?: boolean;
  }>;
  compatibility: Array<{
    make: string;
    model: string;
    yearStart: number;
    yearEnd: number;
    trim?: string;
    engineType?: string;
    vin?: string;
  }>;
  images: Array<{
    imageUrl: string;
    sortOrder: number;
    altText?: string;
    isPrimary?: boolean;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────

/**
 * Upsert a single product with its child records (numbers, compatibility, images).
 * Returns "created" or "updated".
 */
async function upsertProduct(
  payload: ProductSyncPayload,
): Promise<"created" | "updated"> {
  const {
    garagePartId,
    numbers,
    compatibility,
    images,
    ...productFields
  } = payload;

  // Check if product already exists
  const [existing] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.garagePartId, garagePartId))
    .limit(1);

  const now = new Date();
  let productId: string;
  let action: "created" | "updated";

  if (existing) {
    // UPDATE existing product
    productId = existing.id;
    action = "updated";

    await db
      .update(products)
      .set({
        name: productFields.name,
        partNumber: productFields.partNumber,
        salePrice: productFields.salePrice,
        quantity: productFields.quantity,
        lowStockThreshold: productFields.lowStockThreshold,
        description: productFields.description ?? null,
        longDescription: productFields.longDescription ?? null,
        manufacturer: productFields.manufacturer ?? null,
        category: productFields.category ?? null,
        imageUrl: productFields.imageUrl ?? null,
        condition: productFields.condition as "new" | "refurbished" | "used",
        weight: productFields.weight ?? null,
        isOversized: productFields.isOversized,
        isFeatured: productFields.isFeatured,
        featuredSortOrder: productFields.featuredSortOrder,
        lastSyncedAt: now,
      })
      .where(eq(products.id, productId));

    // Delete all child records — will re-insert below
    await db.delete(productNumbers).where(eq(productNumbers.productId, productId));
    await db.delete(productCompatibility).where(eq(productCompatibility.productId, productId));
    await db.delete(productImages).where(eq(productImages.productId, productId));
  } else {
    // INSERT new product
    productId = crypto.randomUUID();
    action = "created";

    await db.insert(products).values({
      id: productId,
      garagePartId,
      name: productFields.name,
      partNumber: productFields.partNumber,
      salePrice: productFields.salePrice,
      quantity: productFields.quantity,
      lowStockThreshold: productFields.lowStockThreshold,
      description: productFields.description ?? null,
      longDescription: productFields.longDescription ?? null,
      manufacturer: productFields.manufacturer ?? null,
      category: productFields.category ?? null,
      imageUrl: productFields.imageUrl ?? null,
      condition: productFields.condition as "new" | "refurbished" | "used",
      weight: productFields.weight ?? null,
      isOversized: productFields.isOversized,
      isFeatured: productFields.isFeatured,
      featuredSortOrder: productFields.featuredSortOrder,
      lastSyncedAt: now,
    });
  }

  // Insert child records
  if (numbers.length > 0) {
    await db.insert(productNumbers).values(
      numbers.map((n) => ({
        id: crypto.randomUUID(),
        productId,
        partNumber: n.partNumber,
        numberType: n.numberType as "oem" | "aftermarket" | "interchange",
        brand: n.brand ?? null,
        isPrimary: n.isPrimary ?? false,
      })),
    );
  }

  if (compatibility.length > 0) {
    await db.insert(productCompatibility).values(
      compatibility.map((c) => ({
        id: crypto.randomUUID(),
        productId,
        make: c.make,
        model: c.model,
        yearStart: c.yearStart,
        yearEnd: c.yearEnd,
        trim: c.trim ?? null,
        engineType: c.engineType ?? null,
        vin: c.vin ?? null,
      })),
    );
  }

  if (images.length > 0) {
    await db.insert(productImages).values(
      images.map((img) => ({
        id: crypto.randomUUID(),
        productId,
        imageUrl: img.imageUrl,
        sortOrder: img.sortOrder,
        altText: img.altText ?? null,
        isPrimary: img.isPrimary ?? false,
      })),
    );
  }

  return action;
}

// ─── Routes ──────────────────────────────────────────────

/**
 * POST /api/sync/products — Bulk upsert products with child records.
 * Body: { products: ProductSyncPayload[] }
 */
router.post("/api/sync/products", async (req, res) => {
  try {
    const { products: productList } = req.body as {
      products: ProductSyncPayload[];
    };

    if (!Array.isArray(productList) || productList.length === 0) {
      res.status(400).json({ message: "products array is required and must not be empty" });
      return;
    }

    let created = 0;
    let updated = 0;
    const errors: Array<{ garagePartId: string; error: string }> = [];

    for (const product of productList) {
      try {
        const action = await upsertProduct(product);
        if (action === "created") created++;
        else updated++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        errors.push({ garagePartId: product.garagePartId, error: msg });
      }
    }

    await logSyncEvent({
      direction: "inbound",
      entity: "products",
      payload: { created, updated, errors: errors.length, total: productList.length },
      status: errors.length === productList.length ? "failed" : "success",
      errorMessage: errors.length > 0 ? `${errors.length} product(s) failed` : undefined,
    });

    res.json({ created, updated, errors });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    await logSyncEvent({
      direction: "inbound",
      entity: "products",
      payload: {},
      status: "failed",
      errorMessage: msg,
    });
    console.error("[sync] Bulk product upsert failed:", error);
    res.status(500).json({ message: "Bulk product sync failed" });
  }
});

/**
 * POST /api/sync/products/:garagePartId — Single product upsert.
 * Body: ProductSyncPayload (single object, not wrapped in array)
 */
router.post("/api/sync/products/:garagePartId", async (req, res) => {
  try {
    const payload = req.body as ProductSyncPayload;
    // Ensure garagePartId from URL is used
    payload.garagePartId = req.params.garagePartId;

    const action = await upsertProduct(payload);

    await logSyncEvent({
      direction: "inbound",
      entity: "product",
      payload: { garagePartId: payload.garagePartId, action },
      status: "success",
    });

    res.json({ action, garagePartId: payload.garagePartId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    await logSyncEvent({
      direction: "inbound",
      entity: "product",
      payload: { garagePartId: req.params.garagePartId },
      status: "failed",
      errorMessage: msg,
    });
    console.error("[sync] Single product upsert failed:", error);
    res.status(500).json({ message: "Product sync failed" });
  }
});

/**
 * DELETE /api/sync/products/:garagePartId — Soft delete a product.
 * Sets isActive = false rather than removing the row.
 */
router.delete("/api/sync/products/:garagePartId", async (req, res) => {
  try {
    const { garagePartId } = req.params;

    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.garagePartId, garagePartId))
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "Product not found" });
      return;
    }

    await db
      .update(products)
      .set({ isActive: false, lastSyncedAt: new Date() })
      .where(eq(products.id, existing.id));

    await logSyncEvent({
      direction: "inbound",
      entity: "product",
      payload: { garagePartId, action: "deactivated" },
      status: "success",
    });

    res.json({ message: "Product deactivated", garagePartId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    await logSyncEvent({
      direction: "inbound",
      entity: "product",
      payload: { garagePartId: req.params.garagePartId },
      status: "failed",
      errorMessage: msg,
    });
    console.error("[sync] Product delete failed:", error);
    res.status(500).json({ message: "Product delete failed" });
  }
});

/**
 * POST /api/sync/stock — Batch stock level update.
 * Body: { updates: Array<{ garagePartId: string; quantity: number }> }
 */
router.post("/api/sync/stock", async (req, res) => {
  try {
    const { updates } = req.body as {
      updates: Array<{ garagePartId: string; quantity: number }>;
    };

    if (!Array.isArray(updates) || updates.length === 0) {
      res.status(400).json({ message: "updates array is required and must not be empty" });
      return;
    }

    let updated = 0;
    let notFound = 0;

    for (const { garagePartId, quantity } of updates) {
      const [existing] = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.garagePartId, garagePartId))
        .limit(1);

      if (!existing) {
        notFound++;
        continue;
      }

      await db
        .update(products)
        .set({ quantity, lastSyncedAt: new Date() })
        .where(eq(products.id, existing.id));

      updated++;
    }

    await logSyncEvent({
      direction: "inbound",
      entity: "stock",
      payload: { updated, notFound, total: updates.length },
      status: notFound === updates.length ? "failed" : "success",
      errorMessage: notFound > 0 ? `${notFound} product(s) not found` : undefined,
    });

    res.json({ updated, notFound });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    await logSyncEvent({
      direction: "inbound",
      entity: "stock",
      payload: {},
      status: "failed",
      errorMessage: msg,
    });
    console.error("[sync] Stock update failed:", error);
    res.status(500).json({ message: "Stock update failed" });
  }
});

export default router;
