/**
 * PartsIndex integration routes — VIN decode, cross-references, part enrichment.
 * Public endpoints (no auth required) for customer-facing features.
 * Server-side only — API key is IP-whitelisted to our DO servers.
 */

import { Router } from "express";
import { authenticateToken, optionalAuth } from "../middleware.js";
import * as pi from "../integrations/partsIndex.js";

const router = Router();

// ─── VIN Decode ───────────────────────────────────────────

/**
 * GET /api/store/catalog/decode-vin/:vin
 * Decode a VIN and return matching car info.
 * Returns the first match with make/model/year for the vehicle selector.
 */
router.get("/api/store/catalog/decode-vin/:vin", async (req, res) => {
  try {
    const vin = String(req.params.vin).trim().toUpperCase();
    if (!vin || vin.length !== 17) {
      return res.status(400).json({ message: "VIN must be 17 characters" });
    }

    const cars = await pi.vinDecodeCars(vin);
    if (cars.length === 0) {
      return res.status(404).json({ message: "No vehicle found for this VIN" });
    }

    const car = cars[0];
    res.json({
      make: car.brand,
      model: car.model,
      year: String(car.year),
      generation: car.generation,
      engine: car.engine,
      bodyType: car.bodyType,
      vinCarId: car.id,
      alternatives: cars.length > 1 ? cars.slice(1).map(c => ({
        make: c.brand,
        model: c.model,
        year: String(c.year),
        engine: c.engine,
        id: c.id,
      })) : [],
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "VIN decode failed";
    console.error("[parts-index] VIN decode error:", msg);
    res.status(502).json({ message: "VIN decode service unavailable" });
  }
});

/**
 * GET /api/store/catalog/vin-parts/:carId
 * Get parts for a VIN-decoded car.
 */
router.get("/api/store/catalog/vin-parts/:carId", async (req, res) => {
  try {
    const carId = String(req.params.carId);
    const { group, query, page, perPage } = req.query;
    const result = await pi.vinCarParts(carId, {
      group: group as string,
      query: query as string,
      page: page as string,
      perPage: perPage as string,
    });
    res.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Parts lookup failed";
    console.error("[parts-index] VIN parts error:", msg);
    res.status(502).json({ message: "Parts lookup service unavailable" });
  }
});

// ─── Part Cross-References ────────────────────────────────

/**
 * GET /api/store/catalog/cross-references
 * Find OEM ↔ aftermarket equivalents for a part code.
 */
router.get("/api/store/catalog/cross-references", async (req, res) => {
  try {
    const code = String(req.query.code || "").trim();
    const brandId = String(req.query.brandId || "").trim();

    if (!code) {
      return res.status(400).json({ message: "code parameter is required" });
    }

    // If no brandId, first find brands for this code
    let targetBrandId = brandId;
    if (!targetBrandId) {
      const brands = await pi.brandsByPartCode(code);
      if (brands.length === 0) {
        return res.json({ crossReferences: [], brands: [] });
      }
      targetBrandId = brands[0].id;
    }

    const [crossReferences, fitment] = await Promise.all([
      pi.getPartRelations(code, targetBrandId),
      pi.getPartFitment(code, targetBrandId).catch(() => []),
    ]);

    res.json({
      crossReferences: crossReferences.map(r => ({
        code: r.code,
        brand: r.brand.name,
        brandId: r.brand.id,
        direction: r.direction,
        name: r.name?.name || null,
      })),
      fitment: fitment.map(f => ({
        brand: f.brand,
        model: f.model,
        generation: f.generation,
        engine: f.engine,
        yearFrom: f.yearFrom,
        yearTo: f.yearTo,
      })),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Cross-reference lookup failed";
    console.error("[parts-index] Cross-reference error:", msg);
    res.status(502).json({ message: "Cross-reference service unavailable" });
  }
});

// ─── Part Enrichment ──────────────────────────────────────

/**
 * GET /api/store/catalog/enrich
 * Get full part data from PartsIndex: images, parameters, cross-refs, fitment.
 * Used to enrich product pages with external data.
 */
router.get("/api/store/catalog/enrich", async (req, res) => {
  try {
    const code = String(req.query.code || "").trim();
    const brandId = req.query.brandId ? String(req.query.brandId) : undefined;

    if (!code) {
      return res.status(400).json({ message: "code parameter is required" });
    }

    const data = await pi.enrichPartData(code, brandId);

    res.json({
      brands: data.brands.map(b => ({ id: b.id, name: b.name })),
      part: data.entity ? {
        name: data.entity.name?.name || data.entity.originalName,
        originalName: data.entity.originalName,
        code: data.entity.code,
        brand: data.entity.brand.name,
        description: data.entity.description,
        barcodes: data.entity.barcodes,
        images: data.entity.images,
        parameters: data.entity.parameters.flatMap(group =>
          group.params.map(p => ({
            name: p.title,
            value: p.values.map(v => v.value).join(", "),
          }))
        ),
      } : null,
      crossReferences: data.crossReferences.map(r => ({
        code: r.code,
        brand: r.brand.name,
        brandId: r.brand.id,
        direction: r.direction,
      })),
      fitment: data.fitment.map(f => ({
        brand: f.brand,
        model: f.model,
        yearFrom: f.yearFrom,
        yearTo: f.yearTo,
        engine: f.engine,
      })),
      images: data.images,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Part enrichment failed";
    console.error("[parts-index] Enrichment error:", msg);
    res.status(502).json({ message: "Part enrichment service unavailable" });
  }
});

// ─── Car Brands (for vehicle selector enrichment) ─────────

/**
 * GET /api/store/catalog/pi-car-brands
 * Get car brands from PartsIndex (richer than local database).
 */
router.get("/api/store/catalog/pi-car-brands", async (_req, res) => {
  try {
    const brands = await pi.getCarBrands();
    res.json(brands.map(b => ({ id: b.id, name: b.name })));
  } catch (error) {
    console.error("[parts-index] Car brands error:", error);
    res.status(502).json({ message: "Car brands service unavailable" });
  }
});

/**
 * GET /api/store/catalog/pi-car-models/:brandId
 * Get car models for a brand from PartsIndex.
 */
router.get("/api/store/catalog/pi-car-models/:brandId", async (req, res) => {
  try {
    const models = await pi.getCarModels(String(req.params.brandId));
    res.json(models.map(m => ({ id: m.id, name: m.name })));
  } catch (error) {
    console.error("[parts-index] Car models error:", error);
    res.status(502).json({ message: "Car models service unavailable" });
  }
});

// ─── Admin: Enrich & Import ──────────────────────────────

/**
 * POST /api/store/admin/products/:id/enrich
 * Enrich a product's data from PartsIndex.
 * Fetches images, cross-references, and fitment data and optionally saves to DB.
 */
router.post("/api/store/admin/products/:id/enrich", authenticateToken, async (req, res) => {
  try {
    const { code, brandId, saveImages, saveFitment } = req.body as {
      code: string;
      brandId?: string;
      saveImages?: boolean;
      saveFitment?: boolean;
    };

    if (!code) {
      return res.status(400).json({ message: "code is required" });
    }

    const data = await pi.enrichPartData(code, brandId);

    // Optionally save images to product
    if (saveImages && data.images.length > 0) {
      const { db } = await import("../db.js");
      const { productImages } = await import("../schema.js");
      const { randomUUID } = await import("crypto");
      const productId = String(req.params.id);

      for (let i = 0; i < data.images.length; i++) {
        await db.insert(productImages).values({
          id: randomUUID(),
          productId,
          imageUrl: data.images[i],
          sortOrder: i + 1,
          altText: data.entity?.originalName || null,
          isPrimary: i === 0,
        });
      }
    }

    // Optionally save fitment data
    if (saveFitment && data.fitment.length > 0) {
      const { db } = await import("../db.js");
      const { productCompatibility } = await import("../schema.js");
      const { randomUUID } = await import("crypto");
      const productId = String(req.params.id);

      for (const fit of data.fitment) {
        await db.insert(productCompatibility).values({
          id: randomUUID(),
          productId,
          make: fit.brand,
          model: fit.model,
          yearStart: fit.yearFrom,
          yearEnd: fit.yearTo,
          engineType: fit.engine || null,
        });
      }
    }

    res.json({
      enriched: true,
      part: data.entity ? {
        name: data.entity.originalName,
        brand: data.entity.brand.name,
        barcodes: data.entity.barcodes,
        parameters: data.entity.parameters.flatMap(g =>
          g.params.map(p => ({ name: p.title, value: p.values.map(v => v.value).join(", ") }))
        ),
      } : null,
      imagesFound: data.images.length,
      imagesSaved: saveImages ? data.images.length : 0,
      crossReferences: data.crossReferences.length,
      fitmentRecords: data.fitment.length,
      fitmentSaved: saveFitment ? data.fitment.length : 0,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Enrichment failed";
    console.error("[parts-index] Admin enrich error:", msg);
    res.status(502).json({ message: msg });
  }
});

export default router;
