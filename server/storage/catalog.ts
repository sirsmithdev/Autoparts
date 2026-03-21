/**
 * Catalog storage module (read-only functions copied from garage's vendorCatalog.storage.ts)
 * Handles: catalog search, featured parts, categories, manufacturers, compatibility
 */

import { eq, and, desc, asc, like, sql, gte, lte } from "drizzle-orm";
import { db } from "../db.js";
import {
  products,
  productNumbers,
  productCompatibility,
  productImages,
  type Product,
  type ProductNumber,
  type ProductCompatibility,
  type ProductImage,
} from "../schema.js";

// ==================== Part Number Lookup ====================

export async function getPartByAnyNumber(partNumber: string): Promise<Product | undefined> {
  const mainResult = await db
    .select()
    .from(products)
    .where(eq(products.partNumber, partNumber))
    .limit(1);

  if (mainResult[0]) return mainResult[0];

  const crossRef = await db
    .select({ part: products })
    .from(productNumbers)
    .innerJoin(products, eq(productNumbers.productId, products.id))
    .where(eq(productNumbers.partNumber, partNumber))
    .limit(1);

  return crossRef[0]?.part;
}

export async function getPartNumbers(productId: string): Promise<ProductNumber[]> {
  return db.select().from(productNumbers).where(eq(productNumbers.productId, productId)).orderBy(asc(productNumbers.partNumber));
}

// ==================== Vehicle Compatibility ====================

export async function getCompatibleParts(make: string, model: string, year: number): Promise<Product[]> {
  const results = await db
    .select({ part: products })
    .from(productCompatibility)
    .innerJoin(products, eq(productCompatibility.productId, products.id))
    .where(and(
      like(sql`LOWER(${productCompatibility.make})`, make.toLowerCase()),
      like(sql`LOWER(${productCompatibility.model})`, model.toLowerCase()),
      lte(productCompatibility.yearStart, year),
      gte(productCompatibility.yearEnd, year)
    ))
    .orderBy(asc(products.name));

  return results.map(r => r.part);
}

export async function getVehicleCompatibilityForPart(productId: string): Promise<ProductCompatibility[]> {
  return db.select().from(productCompatibility).where(eq(productCompatibility.productId, productId)).orderBy(asc(productCompatibility.make), asc(productCompatibility.model));
}

export async function getUniqueMakes(): Promise<string[]> {
  const results = await db
    .selectDistinct({ make: productCompatibility.make })
    .from(productCompatibility)
    .orderBy(asc(productCompatibility.make));
  return results.map(r => r.make);
}

export async function getUniqueModels(make: string): Promise<string[]> {
  const results = await db
    .selectDistinct({ model: productCompatibility.model })
    .from(productCompatibility)
    .where(like(sql`LOWER(${productCompatibility.make})`, make.toLowerCase()))
    .orderBy(asc(productCompatibility.model));
  return results.map(r => r.model);
}

// ==================== Part Images ====================

export async function getPartImages(productId: string): Promise<ProductImage[]> {
  return db.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(asc(productImages.sortOrder));
}

// ==================== Online Store Catalog Search ====================

export type CatalogSortOption = "name" | "price_asc" | "price_desc" | "newest";

export async function searchStoreCatalog(query: {
  q?: string;
  partNumber?: string;
  make?: string;
  model?: string;
  year?: number;
  category?: string;
  manufacturer?: string;
  condition?: string;
  inStockOnly?: boolean;
  orderBy?: CatalogSortOption;
  page?: number;
  limit?: number;
}): Promise<{ parts: Product[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, query.page || 1);
  const pageSize = Math.min(50, Math.max(1, query.limit || 20));
  const offset = (page - 1) * pageSize;

  const conditions: ReturnType<typeof eq>[] = [eq(products.isActive, true)];

  if (query.q) {
    const term = `%${query.q.toLowerCase()}%`;
    conditions.push(sql`(LOWER(${products.name}) LIKE ${term} OR LOWER(${products.partNumber}) LIKE ${term} OR LOWER(${products.description}) LIKE ${term})` as any);
  }

  if (query.partNumber) {
    conditions.push(like(sql`LOWER(${products.partNumber})`, `%${query.partNumber.toLowerCase()}%`) as any);
  }

  if (query.category) {
    conditions.push(eq(products.category, query.category));
  }

  if (query.manufacturer) {
    conditions.push(eq(products.manufacturer, query.manufacturer));
  }

  if (query.condition && ["new", "refurbished", "used"].includes(query.condition)) {
    conditions.push(eq(products.condition, query.condition as "new" | "refurbished" | "used"));
  }

  if (query.inStockOnly) {
    conditions.push(gte(products.quantity, 1));
  }

  const whereClause = and(...conditions);

  const orderBy = query.orderBy || "name";
  const orderClause =
    orderBy === "price_asc" ? asc(products.salePrice) :
    orderBy === "price_desc" ? desc(products.salePrice) :
    orderBy === "newest" ? desc(products.createdAt) :
    asc(products.name);

  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(products).where(whereClause);
  let total = countResult?.count || 0;

  let parts = await db.select().from(products).where(whereClause).orderBy(orderClause).limit(pageSize).offset(offset);

  // Pre-filter by vehicle compatibility if specified
  if (query.make && query.model && query.year) {
    const compatibleParts = await getCompatibleParts(query.make, query.model, query.year);
    const compatibleIds = new Set(compatibleParts.map(p => p.id));

    // Re-query with compatible IDs for accurate pagination
    if (compatibleIds.size === 0) {
      return { parts: [], total: 0, page, pageSize };
    }
    const compatFilter = and(whereClause!, sql`${products.id} IN (${sql.join([...compatibleIds].map(id => sql`${id}`), sql`, `)})`);
    const [filteredCount] = await db.select({ count: sql<number>`count(*)` }).from(products).where(compatFilter);
    total = filteredCount?.count || 0;
    parts = await db.select().from(products).where(compatFilter).orderBy(orderClause).limit(pageSize).offset(offset);
  }

  return { parts, total, page, pageSize };
}

export async function getFeaturedParts(limit = 12): Promise<Product[]> {
  return db.select().from(products)
    .where(and(eq(products.isActive, true), eq(products.isFeatured, true)))
    .orderBy(asc(products.featuredSortOrder))
    .limit(limit);
}

export async function getPublishedCategories(): Promise<string[]> {
  const results = await db.selectDistinct({ category: products.category })
    .from(products)
    .where(and(eq(products.isActive, true), sql`${products.category} IS NOT NULL`))
    .orderBy(asc(products.category));
  return results.map(r => r.category).filter(Boolean) as string[];
}

export async function getPublishedManufacturers(): Promise<string[]> {
  const results = await db.selectDistinct({ manufacturer: products.manufacturer })
    .from(products)
    .where(and(eq(products.isActive, true), sql`${products.manufacturer} IS NOT NULL`))
    .orderBy(asc(products.manufacturer));
  return results.map(r => r.manufacturer).filter(Boolean) as string[];
}

/**
 * Get full part details including cross-references and compatibility.
 * Simplified version without vendor data (parts-store doesn't need vendor info).
 */
export async function getPartWithFullDetails(productId: string): Promise<{
  part: Product;
  partNumbers: ProductNumber[];
  vehicleCompatibility: ProductCompatibility[];
  images: ProductImage[];
} | undefined> {
  const part = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!part[0]) return undefined;

  const [partNumbersList, compatibility, images] = await Promise.all([
    getPartNumbers(productId),
    getVehicleCompatibilityForPart(productId),
    getPartImages(productId),
  ]);

  return {
    part: part[0],
    partNumbers: partNumbersList,
    vehicleCompatibility: compatibility,
    images,
  };
}
