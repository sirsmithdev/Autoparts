/**
 * Public catalog routes — no auth required for browsing.
 */
import { Router } from "express";
import { optionalAuth } from "../middleware.js";
import * as catalog from "../storage/catalog.js";
import * as settings from "../storage/settings.js";

const router = Router();

/** Strip sensitive fields, add stock status. Never expose exact quantities or cost. */
function toPublicPart(part: { quantity: number; lowStockThreshold: number; [key: string]: unknown }) {
  const { quantity, lowStockThreshold, ...rest } = part;
  return {
    ...rest,
    stockStatus: quantity <= 0 ? "out_of_stock" : quantity <= lowStockThreshold ? "low_stock" : "in_stock",
  };
}

// Search/browse parts
router.get("/api/store/catalog", optionalAuth, async (req, res) => {
  try {
    const { q, partNumber, category, make, model, year, manufacturer, condition, inStockOnly, orderBy, page, limit } = req.query;
    const result = await catalog.searchStoreCatalog({
      q: q as string,
      partNumber: partNumber as string,
      category: category as string,
      make: make as string,
      model: model as string,
      year: year ? parseInt(year as string) : undefined,
      manufacturer: manufacturer as string,
      condition: condition as string,
      inStockOnly: inStockOnly === "true" || inStockOnly === "1",
      orderBy: (orderBy as "name" | "price_asc" | "price_desc" | "newest") || "name",
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });
    res.json({ ...result, parts: result.parts.map(toPublicPart) });
  } catch (error) {
    console.error("Catalog search failed", error);
    res.status(500).json({ message: "Failed to search catalog" });
  }
});

// Featured parts for homepage
router.get("/api/store/catalog/featured", async (_req, res) => {
  try {
    const parts = await catalog.getFeaturedParts();
    res.json(parts.map(toPublicPart));
  } catch (error) {
    res.status(500).json({ message: "Failed to get featured parts" });
  }
});

// Make dropdown
router.get("/api/store/catalog/makes", async (_req, res) => {
  try {
    res.json(await catalog.getUniqueMakes());
  } catch (error) {
    res.status(500).json({ message: "Failed to get makes" });
  }
});

// Model dropdown
router.get("/api/store/catalog/models", async (req, res) => {
  try {
    const { make } = req.query;
    if (!make) return res.status(400).json({ message: "make is required" });
    res.json(await catalog.getUniqueModels(make as string));
  } catch (error) {
    res.status(500).json({ message: "Failed to get models" });
  }
});

// Vehicle compatibility search
router.get("/api/store/catalog/compatible", async (req, res) => {
  try {
    const { make, model, year } = req.query;
    if (!make || !model || !year) return res.status(400).json({ message: "make, model, and year are required" });
    const parts = await catalog.getCompatibleParts(make as string, model as string, parseInt(year as string));
    res.json(parts.filter(p => p.isActive).map(toPublicPart));
  } catch (error) {
    res.status(500).json({ message: "Failed to search compatible parts" });
  }
});

// Manufacturers
router.get("/api/store/catalog/manufacturers", async (_req, res) => {
  try {
    res.json(await catalog.getPublishedManufacturers());
  } catch (error) {
    res.status(500).json({ message: "Failed to get manufacturers" });
  }
});

// Part number lookup
router.get("/api/store/catalog/lookup/:partNumber", async (req, res) => {
  try {
    const part = await catalog.getPartByAnyNumber(String(req.params.partNumber));
    if (!part || !part.isActive) return res.status(404).json({ message: "Part not found" });
    res.json(toPublicPart(part));
  } catch (error) {
    res.status(500).json({ message: "Failed to lookup part" });
  }
});

// Part detail — MUST be after all static /catalog/* routes
router.get("/api/store/catalog/:partId", optionalAuth, async (req, res) => {
  try {
    const detail = await catalog.getPartWithFullDetails(String(req.params.partId));
    if (!detail || !detail.part.isActive) {
      return res.status(404).json({ message: "Part not found" });
    }
    const { vehicleCompatibility, ...rest } = detail;
    res.json({
      ...rest,
      part: toPublicPart(detail.part),
      compatibility: vehicleCompatibility ?? [],
    });
  } catch (error) {
    console.error("Part detail failed", error);
    res.status(500).json({ message: "Failed to get part detail" });
  }
});

// Categories
router.get("/api/store/categories", async (_req, res) => {
  try {
    res.json(await catalog.getPublishedCategories());
  } catch (error) {
    res.status(500).json({ message: "Failed to get categories" });
  }
});

// Delivery zones (public)
router.get("/api/store/delivery-zones", async (_req, res) => {
  try {
    res.json(await settings.getActiveDeliveryZones());
  } catch (error) {
    res.status(500).json({ message: "Failed to get delivery zones" });
  }
});

// Public store settings
router.get("/api/store/settings/public", async (_req, res) => {
  try {
    const s = await settings.getStoreSettings();
    res.json({
      taxRate: s?.taxRate ?? "0.00",
      taxName: s?.taxName ?? "GCT",
      currency: s?.currency ?? "JMD",
      currencySymbol: s?.currencySymbol ?? "$",
      returnWindowDays: s?.returnWindowDays ?? 14,
      defectiveReturnWindowDays: s?.defectiveReturnWindowDays ?? 30,
      maxQuantityPerItem: s?.maxQuantityPerItem ?? 50,
      maxItemsPerOrder: s?.maxItemsPerOrder ?? 200,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to get store settings" });
  }
});

// Newsletter subscription (public)
router.post("/api/store/newsletter/subscribe", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ message: "Valid email is required" });
    }
    const { newsletterSubscribers } = await import("../schema.js");
    const { db } = await import("../db.js");
    const { randomUUID } = await import("crypto");
    // Upsert: ignore duplicate
    try {
      await db.insert(newsletterSubscribers).values({ id: randomUUID(), email: email.trim().toLowerCase() });
    } catch (err: unknown) {
      // Duplicate email — treat as success
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "ER_DUP_ENTRY") {
        return res.json({ message: "Subscribed successfully" });
      }
      throw err;
    }
    res.json({ message: "Subscribed successfully" });
  } catch (error) {
    console.error("Newsletter subscribe failed", error);
    res.status(500).json({ message: "Failed to subscribe" });
  }
});

export default router;
