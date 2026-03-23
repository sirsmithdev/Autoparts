/**
 * Product admin storage module — CRUD, bulk import, activity logging.
 * Used by the admin product management routes.
 */

import { eq, and, like, sql, desc, asc, or } from "drizzle-orm";
import { db } from "../db.js";
import {
  products,
  productNumbers,
  productCompatibility,
  productImages,
  productActivityLog,
  stockMovements,
  type Product,
  type ProductNumber,
  type ProductCompatibility,
  type ProductImage,
} from "../schema.js";
import { randomUUID } from "crypto";

// ==================== List Products ====================

export async function listProducts(params: {
  search?: string;
  category?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}): Promise<{ products: (Product & { primaryImageUrl: string | null })[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * pageSize;

  const conditions: ReturnType<typeof eq>[] = [];

  if (params.isActive !== undefined) {
    conditions.push(eq(products.isActive, params.isActive));
  }

  if (params.category) {
    conditions.push(eq(products.category, params.category));
  }

  if (params.search) {
    const term = `%${params.search.toLowerCase()}%`;
    conditions.push(
      sql`(LOWER(${products.name}) LIKE ${term} OR LOWER(${products.partNumber}) LIKE ${term} OR LOWER(${products.barcode}) LIKE ${term})` as any,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(whereClause);
  const total = countResult?.count || 0;

  const rows = await db
    .select()
    .from(products)
    .where(whereClause)
    .orderBy(desc(products.createdAt))
    .limit(pageSize)
    .offset(offset);

  // Fetch primary images for all products in the result set
  const productIds = rows.map((r) => r.id);
  let primaryImageMap = new Map<string, string>();

  if (productIds.length > 0) {
    const images = await db
      .select({
        productId: productImages.productId,
        imageUrl: productImages.imageUrl,
        isPrimary: productImages.isPrimary,
        sortOrder: productImages.sortOrder,
      })
      .from(productImages)
      .where(
        sql`${productImages.productId} IN (${sql.join(
          productIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
      .orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder));

    for (const img of images) {
      if (!primaryImageMap.has(img.productId)) {
        primaryImageMap.set(img.productId, img.imageUrl);
      }
    }
  }

  const enriched = rows.map((p) => ({
    ...p,
    primaryImageUrl: primaryImageMap.get(p.id) || p.imageUrl || null,
  }));

  return { products: enriched, total, page, pageSize };
}

// ==================== Get Full Product ====================

export async function getProductFull(id: string): Promise<
  | {
      product: Product;
      numbers: ProductNumber[];
      compatibility: ProductCompatibility[];
      images: ProductImage[];
    }
  | undefined
> {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!product) return undefined;

  const [numbers, compatibility, images] = await Promise.all([
    db
      .select()
      .from(productNumbers)
      .where(eq(productNumbers.productId, id))
      .orderBy(asc(productNumbers.partNumber)),
    db
      .select()
      .from(productCompatibility)
      .where(eq(productCompatibility.productId, id))
      .orderBy(asc(productCompatibility.make), asc(productCompatibility.model)),
    db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, id))
      .orderBy(asc(productImages.sortOrder)),
  ]);

  return { product, numbers, compatibility, images };
}

// ==================== Create Product ====================

export async function createProduct(
  data: {
    name: string;
    partNumber: string;
    barcode?: string | null;
    salePrice: string;
    quantity?: number;
    lowStockThreshold?: number;
    description?: string | null;
    longDescription?: string | null;
    manufacturer?: string | null;
    category?: string | null;
    imageUrl?: string | null;
    condition?: "new" | "refurbished" | "used";
    weight?: string | null;
    isOversized?: boolean;
    isFeatured?: boolean;
    featuredSortOrder?: number;
    numbers?: Array<{ partNumber: string; numberType: string; brand?: string | null; isPrimary?: boolean }>;
    compatibility?: Array<{ make: string; model: string; yearStart: number; yearEnd: number; trim?: string | null; engineType?: string | null }>;
  },
  performedBy: string,
): Promise<Product> {
  const productId = randomUUID();

  return await db.transaction(async (tx) => {
    await tx.insert(products).values({
      id: productId,
      name: data.name,
      partNumber: data.partNumber,
      barcode: data.barcode ?? null,
      salePrice: data.salePrice,
      quantity: data.quantity ?? 0,
      lowStockThreshold: data.lowStockThreshold ?? 10,
      description: data.description ?? null,
      longDescription: data.longDescription ?? null,
      manufacturer: data.manufacturer ?? null,
      category: data.category ?? null,
      imageUrl: data.imageUrl ?? null,
      condition: data.condition ?? "new",
      weight: data.weight ?? null,
      isOversized: data.isOversized ?? false,
      isFeatured: data.isFeatured ?? false,
      featuredSortOrder: data.featuredSortOrder ?? 0,
    });

    // Insert child records
    if (data.numbers && data.numbers.length > 0) {
      await tx.insert(productNumbers).values(
        data.numbers.map((n) => ({
          id: randomUUID(),
          productId,
          partNumber: n.partNumber,
          numberType: n.numberType as "oem" | "aftermarket" | "interchange",
          brand: n.brand ?? null,
          isPrimary: n.isPrimary ?? false,
        })),
      );
    }

    if (data.compatibility && data.compatibility.length > 0) {
      await tx.insert(productCompatibility).values(
        data.compatibility.map((c) => ({
          id: randomUUID(),
          productId,
          make: c.make,
          model: c.model,
          yearStart: c.yearStart,
          yearEnd: c.yearEnd,
          trim: c.trim ?? null,
          engineType: c.engineType ?? null,
        })),
      );
    }

    // Log activity
    await tx.insert(productActivityLog).values({
      id: randomUUID(),
      productId,
      action: "created",
      details: { name: data.name, partNumber: data.partNumber },
      performedBy,
    });

    const [created] = await tx
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    return created;
  });
}

// ==================== Update Product ====================

export async function updateProduct(
  id: string,
  data: Partial<{
    name: string;
    partNumber: string;
    barcode: string | null;
    salePrice: string;
    quantity: number;
    lowStockThreshold: number;
    description: string | null;
    longDescription: string | null;
    manufacturer: string | null;
    category: string | null;
    imageUrl: string | null;
    condition: "new" | "refurbished" | "used";
    weight: string | null;
    isOversized: boolean;
    isFeatured: boolean;
    featuredSortOrder: number;
    isActive: boolean;
  }>,
  performedBy: string,
): Promise<Product | undefined> {
  const [existing] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!existing) return undefined;

  // Build diff for activity log
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  for (const [key, value] of Object.entries(data)) {
    const oldVal = (existing as any)[key];
    if (oldVal !== value) {
      changes[key] = { old: oldVal, new: value };
    }
  }

  if (Object.keys(data).length > 0) {
    await db.update(products).set(data).where(eq(products.id, id));
  }

  // Log activity
  await db.insert(productActivityLog).values({
    id: randomUUID(),
    productId: id,
    action: "updated",
    details: changes,
    performedBy,
  });

  const [updated] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  return updated;
}

// ==================== Soft Delete / Restore ====================

export async function softDeleteProduct(
  id: string,
  performedBy: string,
): Promise<void> {
  await db
    .update(products)
    .set({ isActive: false })
    .where(eq(products.id, id));

  await db.insert(productActivityLog).values({
    id: randomUUID(),
    productId: id,
    action: "deleted",
    details: { isActive: false },
    performedBy,
  });
}

export async function restoreProduct(
  id: string,
  performedBy: string,
): Promise<void> {
  await db
    .update(products)
    .set({ isActive: true })
    .where(eq(products.id, id));

  await db.insert(productActivityLog).values({
    id: randomUUID(),
    productId: id,
    action: "restored",
    details: { isActive: true },
    performedBy,
  });
}

// ==================== Replace Part Numbers ====================

export async function replacePartNumbers(
  productId: string,
  numbers: Array<{ partNumber: string; numberType: string; brand?: string | null; isPrimary?: boolean }>,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(productNumbers).where(eq(productNumbers.productId, productId));

    if (numbers.length > 0) {
      await tx.insert(productNumbers).values(
        numbers.map((n) => ({
          id: randomUUID(),
          productId,
          partNumber: n.partNumber,
          numberType: n.numberType as "oem" | "aftermarket" | "interchange",
          brand: n.brand ?? null,
          isPrimary: n.isPrimary ?? false,
        })),
      );
    }
  });
}

// ==================== Replace Compatibility ====================

export async function replaceCompatibility(
  productId: string,
  entries: Array<{ make: string; model: string; yearStart: number; yearEnd: number; trim?: string | null; engineType?: string | null }>,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(productCompatibility).where(eq(productCompatibility.productId, productId));

    if (entries.length > 0) {
      await tx.insert(productCompatibility).values(
        entries.map((c) => ({
          id: randomUUID(),
          productId,
          make: c.make,
          model: c.model,
          yearStart: c.yearStart,
          yearEnd: c.yearEnd,
          trim: c.trim ?? null,
          engineType: c.engineType ?? null,
        })),
      );
    }
  });
}

// ==================== Activity Log ====================

export async function getProductActivity(
  productId: string,
  params: { page?: number; limit?: number },
): Promise<{ entries: Array<{ id: string; type: "activity" | "stock_movement"; action: string; details: unknown; performedBy: string | null; createdAt: Date }>; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * pageSize;

  // Count both tables
  const [activityCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(productActivityLog)
    .where(eq(productActivityLog.productId, productId));

  const [movementCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(stockMovements)
    .where(eq(stockMovements.productId, productId));

  const total = (activityCount?.count || 0) + (movementCount?.count || 0);

  // Fetch from both tables using UNION ALL via raw SQL for merged sorting
  const rows = await db.execute(sql`
    (SELECT id, 'activity' as entry_type, action, details, performed_by, created_at
     FROM product_activity_log
     WHERE product_id = ${productId})
    UNION ALL
    (SELECT id, 'stock_movement' as entry_type, movement_type as action,
     JSON_OBJECT('quantity', quantity, 'referenceType', reference_type, 'referenceId', reference_id, 'notes', notes) as details,
     performed_by, created_at
     FROM stock_movements
     WHERE product_id = ${productId})
    ORDER BY created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  const entries = (rows[0] as unknown as any[]).map((row: any) => ({
    id: row.id,
    type: row.entry_type as "activity" | "stock_movement",
    action: row.action,
    details: typeof row.details === "string" ? JSON.parse(row.details) : row.details,
    performedBy: row.performed_by,
    createdAt: row.created_at,
  }));

  return { entries, total, page, pageSize };
}

// ==================== Lookup ====================

export async function lookupByBarcodeOrPartNumber(
  query: string,
): Promise<Product[]> {
  // Exact match on barcode
  const barcodeResults = await db
    .select()
    .from(products)
    .where(eq(products.barcode, query))
    .limit(20);

  if (barcodeResults.length > 0) return barcodeResults;

  // Exact match on partNumber
  const partNumberResults = await db
    .select()
    .from(products)
    .where(eq(products.partNumber, query))
    .limit(20);

  if (partNumberResults.length > 0) return partNumberResults;

  // LIKE match on name
  const term = `%${query.toLowerCase()}%`;
  const nameResults = await db
    .select()
    .from(products)
    .where(like(sql`LOWER(${products.name})`, term))
    .limit(20);

  return nameResults;
}

// ==================== CSV Import ====================

export async function importProductsFromCsv(
  rows: Array<{
    name: string;
    partNumber: string;
    barcode?: string;
    salePrice: string;
    quantity?: string;
    category?: string;
    manufacturer?: string;
    condition?: string;
    description?: string;
  }>,
  performedBy: string,
): Promise<{ created: number; updated: number; errors: Array<{ row: number; message: string }> }> {
  let created = 0;
  let updated = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.name || !row.partNumber || !row.salePrice) {
        errors.push({ row: i + 1, message: "Missing required fields: name, partNumber, salePrice" });
        continue;
      }

      // Check if product exists by partNumber
      const [existing] = await db
        .select()
        .from(products)
        .where(eq(products.partNumber, row.partNumber))
        .limit(1);

      if (existing) {
        // Update existing product
        await db
          .update(products)
          .set({
            name: row.name,
            salePrice: row.salePrice,
            quantity: row.quantity ? parseInt(row.quantity, 10) : undefined,
            category: row.category ?? undefined,
            manufacturer: row.manufacturer ?? undefined,
            condition: row.condition ? (row.condition as "new" | "refurbished" | "used") : undefined,
            description: row.description ?? undefined,
            barcode: row.barcode ?? undefined,
          })
          .where(eq(products.id, existing.id));

        await db.insert(productActivityLog).values({
          id: randomUUID(),
          productId: existing.id,
          action: "updated",
          details: { source: "csv_import", row: i + 1 },
          performedBy,
        });

        updated++;
      } else {
        // Create new product
        const productId = randomUUID();
        await db.insert(products).values({
          id: productId,
          name: row.name,
          partNumber: row.partNumber,
          barcode: row.barcode ?? null,
          salePrice: row.salePrice,
          quantity: row.quantity ? parseInt(row.quantity, 10) : 0,
          category: row.category ?? null,
          manufacturer: row.manufacturer ?? null,
          condition: row.condition ? (row.condition as "new" | "refurbished" | "used") : "new",
          description: row.description ?? null,
        });

        await db.insert(productActivityLog).values({
          id: randomUUID(),
          productId,
          action: "created",
          details: { source: "csv_import", row: i + 1 },
          performedBy,
        });

        created++;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      errors.push({ row: i + 1, message: msg });
    }
  }

  return { created, updated, errors };
}
