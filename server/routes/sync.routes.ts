/**
 * Inbound sync routes — receives product and stock data from the garage app.
 * All routes protected by x-sync-api-key header validation.
 */

import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import {
  products,
  productNumbers,
  productCompatibility,
  productImages,
  productBinAssignments,
} from "../schema.js";
import { validateSyncApiKey } from "../middleware.js";
import { logSyncEvent } from "../storage/sync.js";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

// All sync routes require API key
router.use("/api/sync", validateSyncApiKey);

// ─── Zod Schemas ─────────────────────────────────────────

const productNumberSchema = z.object({
  partNumber: z.string().min(1),
  numberType: z.string().min(1),
  brand: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

const compatibilitySchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  yearStart: z.number().int(),
  yearEnd: z.number().int(),
  trim: z.string().optional(),
  engineType: z.string().optional(),
  vin: z.string().optional(),
});

const imageSchema = z.object({
  imageUrl: z.string().min(1),
  sortOrder: z.number().int(),
  altText: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

const productSyncPayloadSchema = z.object({
  garagePartId: z.string().min(1),
  name: z.string().min(1),
  partNumber: z.string().min(1),
  salePrice: z.string(),
  quantity: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0),
  description: z.string().optional(),
  longDescription: z.string().optional(),
  manufacturer: z.string().optional(),
  category: z.string().optional(),
  imageUrl: z.string().optional(),
  condition: z.string(),
  weight: z.string().optional(),
  isOversized: z.boolean(),
  isFeatured: z.boolean(),
  featuredSortOrder: z.number().int(),
  numbers: z.array(productNumberSchema).default([]),
  compatibility: z.array(compatibilitySchema).default([]),
  images: z.array(imageSchema).default([]),
});

const bulkProductSyncSchema = z.object({
  products: z.array(productSyncPayloadSchema).min(1, "products array is required and must not be empty"),
});

const stockUpdateSchema = z.object({
  updates: z.array(z.object({
    garagePartId: z.string().min(1),
    quantity: z.number().int().min(0),
  })).min(1, "updates array is required and must not be empty"),
});

type ProductSyncPayload = z.infer<typeof productSyncPayloadSchema>;

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

  return await db.transaction(async (tx) => {
    // Check if product already exists
    const [existing] = await tx
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

      await tx
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
      await tx.delete(productNumbers).where(eq(productNumbers.productId, productId));
      await tx.delete(productCompatibility).where(eq(productCompatibility.productId, productId));
      await tx.delete(productImages).where(eq(productImages.productId, productId));
    } else {
      // INSERT new product
      productId = crypto.randomUUID();
      action = "created";

      await tx.insert(products).values({
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
      await tx.insert(productNumbers).values(
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
      await tx.insert(productCompatibility).values(
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
      await tx.insert(productImages).values(
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
  });
}

// ─── Routes ──────────────────────────────────────────────

/**
 * POST /api/sync/products — Bulk upsert products with child records.
 * Body: { products: ProductSyncPayload[] }
 */
router.post("/api/sync/products", async (req, res) => {
  try {
    const { products: productList } = bulkProductSyncSchema.parse(req.body);

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
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors[0].message });
      return;
    }
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
    const payload = productSyncPayloadSchema.parse({
      ...req.body,
      garagePartId: req.params.garagePartId,
    });

    const action = await upsertProduct(payload);

    await logSyncEvent({
      direction: "inbound",
      entity: "product",
      payload: { garagePartId: payload.garagePartId, action },
      status: "success",
    });

    res.json({ action, garagePartId: payload.garagePartId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors[0].message });
      return;
    }
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
    const { updates } = stockUpdateSchema.parse(req.body);

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

      // Update product quantity
      await db
        .update(products)
        .set({ quantity, lastSyncedAt: new Date() })
        .where(eq(products.id, existing.id));

      // Reconcile bin assignments: if bins exist, scale them proportionally
      // to match the new total quantity (prevents bin drift from #36 audit)
      const binRows = await db
        .select({ id: productBinAssignments.id, quantity: productBinAssignments.quantity })
        .from(productBinAssignments)
        .where(eq(productBinAssignments.productId, existing.id));
      if (binRows.length > 0) {
        const currentBinTotal = binRows.reduce((sum, b) => sum + b.quantity, 0);
        if (currentBinTotal > 0 && currentBinTotal !== quantity) {
          const ratio = quantity / currentBinTotal;
          let distributed = 0;
          for (let i = 0; i < binRows.length; i++) {
            const isLast = i === binRows.length - 1;
            const newQty = isLast ? quantity - distributed : Math.round(binRows[i].quantity * ratio);
            await db.update(productBinAssignments)
              .set({ quantity: Math.max(0, newQty), updatedAt: new Date() })
              .where(eq(productBinAssignments.id, binRows[i].id));
            distributed += newQty;
          }
        }
      }

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
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors[0].message });
      return;
    }
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
