/**
 * Product management routes — admin CRUD, image upload, CSV import, activity log.
 * All routes require authentication and the "products:manage" permission.
 */

import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { authenticateToken, requirePermission } from "../middleware.js";
import * as productAdmin from "../storage/productAdmin.js";
import { uploadProductImage, deleteProductImage } from "../storage/imageUpload.js";
import { db } from "../db.js";
import { productImages } from "../schema.js";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

// ─── Multer Configuration ────────────────────────────────

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, and WebP images are allowed"));
    }
  },
});

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

// ─── Zod Schemas ─────────────────────────────────────────

const createProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  partNumber: z.string().min(1, "Part number is required"),
  barcode: z.string().optional().nullable(),
  salePrice: z.string().min(1, "Sale price is required"),
  quantity: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  description: z.string().optional().nullable(),
  longDescription: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  condition: z.enum(["new", "refurbished", "used"]).optional(),
  weight: z.string().optional().nullable(),
  isOversized: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  featuredSortOrder: z.number().int().optional(),
  numbers: z.array(z.object({
    partNumber: z.string().min(1),
    numberType: z.string().min(1),
    brand: z.string().optional().nullable(),
    isPrimary: z.boolean().optional(),
  })).optional(),
  compatibility: z.array(z.object({
    make: z.string().min(1),
    model: z.string().min(1),
    yearStart: z.number().int(),
    yearEnd: z.number().int(),
    trim: z.string().optional().nullable(),
    engineType: z.string().optional().nullable(),
  })).optional(),
});

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  partNumber: z.string().min(1).optional(),
  barcode: z.string().optional().nullable(),
  salePrice: z.string().optional(),
  quantity: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  description: z.string().optional().nullable(),
  longDescription: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  condition: z.enum(["new", "refurbished", "used"]).optional(),
  weight: z.string().optional().nullable(),
  isOversized: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  featuredSortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const partNumbersSchema = z.array(z.object({
  partNumber: z.string().min(1),
  numberType: z.string().min(1),
  brand: z.string().optional().nullable(),
  isPrimary: z.boolean().optional(),
}));

const compatibilitySchema = z.array(z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  yearStart: z.number().int(),
  yearEnd: z.number().int(),
  trim: z.string().optional().nullable(),
  engineType: z.string().optional().nullable(),
}));

const lookupSchema = z.object({
  query: z.string().min(1, "Query is required"),
});

// ─── Routes ──────────────────────────────────────────────

// 1. GET /api/store/admin/products — list with pagination + search + filters
router.get(
  "/api/store/admin/products",
  authenticateToken,
  requirePermission("products:manage"),
  async (req, res) => {
    try {
      const { search, category, isActive, page, limit } = req.query;
      const result = await productAdmin.listProducts({
        search: search as string,
        category: category as string,
        isActive: isActive !== undefined ? isActive === "true" : undefined,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
      });
      res.json(result);
    } catch (error) {
      console.error("[products] Failed to list products:", error);
      res.status(500).json({ message: "Failed to list products" });
    }
  },
);

// 2. GET /api/store/admin/products/:id — get full product
router.get(
  "/api/store/admin/products/:id",
  authenticateToken,
  requirePermission("products:manage"),
  async (req, res) => {
    try {
      const result = await productAdmin.getProductFull(String(req.params.id));
      if (!result) {
        res.status(404).json({ message: "Product not found" });
        return;
      }
      res.json(result);
    } catch (error) {
      console.error("[products] Failed to get product:", error);
      res.status(500).json({ message: "Failed to get product" });
    }
  },
);

// 3. POST /api/store/admin/products — create product
router.post(
  "/api/store/admin/products",
  authenticateToken,
  requirePermission("products:manage"),
  async (req, res) => {
    try {
      const data = createProductSchema.parse(req.body);
      const product = await productAdmin.createProduct(data, req.customer!.customerId);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
        return;
      }
      console.error("[products] Failed to create product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  },
);

// 4. PATCH /api/store/admin/products/:id — update product
router.patch(
  "/api/store/admin/products/:id",
  authenticateToken,
  requirePermission("products:manage"),
  async (req, res) => {
    try {
      const data = updateProductSchema.parse(req.body);
      const product = await productAdmin.updateProduct(
        String(req.params.id),
        data,
        req.customer!.customerId,
      );
      if (!product) {
        res.status(404).json({ message: "Product not found" });
        return;
      }
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
        return;
      }
      console.error("[products] Failed to update product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  },
);

// 5. DELETE /api/store/admin/products/:id — soft delete
router.delete(
  "/api/store/admin/products/:id",
  authenticateToken,
  requirePermission("products:manage"),
  async (req, res) => {
    try {
      const result = await productAdmin.getProductFull(String(req.params.id));
      if (!result) {
        res.status(404).json({ message: "Product not found" });
        return;
      }
      await productAdmin.softDeleteProduct(String(req.params.id), req.customer!.customerId);
      res.json({ message: "Product deactivated" });
    } catch (error) {
      console.error("[products] Failed to delete product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  },
);

// 6. POST /api/store/admin/products/:id/restore — restore
router.post(
  "/api/store/admin/products/:id/restore",
  authenticateToken,
  requirePermission("products:manage"),
  async (req, res) => {
    try {
      const result = await productAdmin.getProductFull(String(req.params.id));
      if (!result) {
        res.status(404).json({ message: "Product not found" });
        return;
      }
      await productAdmin.restoreProduct(String(req.params.id), req.customer!.customerId);
      res.json({ message: "Product restored" });
    } catch (error) {
      console.error("[products] Failed to restore product:", error);
      res.status(500).json({ message: "Failed to restore product" });
    }
  },
);

// 7. POST /api/store/admin/products/:id/images — upload image(s)
router.post(
  "/api/store/admin/products/:id/images",
  authenticateToken,
  requirePermission("products:manage"),
  imageUpload.array("images", 10),
  async (req, res) => {
    try {
      const productId = String(req.params.id);
      const result = await productAdmin.getProductFull(productId);
      if (!result) {
        res.status(404).json({ message: "Product not found" });
        return;
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ message: "No images provided" });
        return;
      }

      // Determine current max sortOrder
      const currentMaxSort = result.images.reduce(
        (max, img) => Math.max(max, img.sortOrder),
        -1,
      );

      const uploaded: Array<{ id: string; imageUrl: string; sortOrder: number }> = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const imageUrl = await uploadProductImage(
          file.buffer,
          productId,
          file.originalname,
          file.mimetype,
        );

        const imageId = randomUUID();
        const sortOrder = currentMaxSort + 1 + i;

        await db.insert(productImages).values({
          id: imageId,
          productId,
          imageUrl,
          sortOrder,
          altText: null,
          isPrimary: result.images.length === 0 && i === 0, // first image is primary if none exist
        });

        uploaded.push({ id: imageId, imageUrl, sortOrder });
      }

      res.status(201).json({ uploaded });
    } catch (error) {
      console.error("[products] Failed to upload images:", error);
      const message = error instanceof Error ? error.message : "Failed to upload images";
      res.status(500).json({ message });
    }
  },
);

// 8. DELETE /api/store/admin/products/:id/images/:imageId — delete image
router.delete(
  "/api/store/admin/products/:id/images/:imageId",
  authenticateToken,
  requirePermission("products:manage"),
  async (req, res) => {
    try {
      const productId = String(req.params.id);
      const imageId = String(req.params.imageId);

      const [image] = await db
        .select()
        .from(productImages)
        .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
        .limit(1);

      if (!image) {
        res.status(404).json({ message: "Image not found" });
        return;
      }

      // Delete from S3/Spaces
      try {
        await deleteProductImage(image.imageUrl);
      } catch (err) {
        console.warn("[products] Failed to delete image from storage (continuing):", err);
      }

      // Delete from database
      await db.delete(productImages).where(eq(productImages.id, imageId));

      res.json({ message: "Image deleted" });
    } catch (error) {
      console.error("[products] Failed to delete image:", error);
      res.status(500).json({ message: "Failed to delete image" });
    }
  },
);

// 9. PUT /api/store/admin/products/:id/numbers — replace part numbers
router.put(
  "/api/store/admin/products/:id/numbers",
  authenticateToken,
  requirePermission("products:manage"),
  async (req, res) => {
    try {
      const numbers = partNumbersSchema.parse(req.body);
      const result = await productAdmin.getProductFull(String(req.params.id));
      if (!result) {
        res.status(404).json({ message: "Product not found" });
        return;
      }
      await productAdmin.replacePartNumbers(String(req.params.id), numbers);
      res.json({ message: "Part numbers updated", count: numbers.length });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
        return;
      }
      console.error("[products] Failed to update part numbers:", error);
      res.status(500).json({ message: "Failed to update part numbers" });
    }
  },
);

// 10. PUT /api/store/admin/products/:id/compatibility — replace compatibility
router.put(
  "/api/store/admin/products/:id/compatibility",
  authenticateToken,
  requirePermission("products:manage"),
  async (req, res) => {
    try {
      const entries = compatibilitySchema.parse(req.body);
      const result = await productAdmin.getProductFull(String(req.params.id));
      if (!result) {
        res.status(404).json({ message: "Product not found" });
        return;
      }
      await productAdmin.replaceCompatibility(String(req.params.id), entries);
      res.json({ message: "Compatibility updated", count: entries.length });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
        return;
      }
      console.error("[products] Failed to update compatibility:", error);
      res.status(500).json({ message: "Failed to update compatibility" });
    }
  },
);

// 11. GET /api/store/admin/products/:id/activity — get activity log
router.get(
  "/api/store/admin/products/:id/activity",
  authenticateToken,
  requirePermission("products:manage"),
  async (req, res) => {
    try {
      const result = await productAdmin.getProductFull(String(req.params.id));
      if (!result) {
        res.status(404).json({ message: "Product not found" });
        return;
      }
      const { page, limit } = req.query;
      const activity = await productAdmin.getProductActivity(String(req.params.id), {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
      });
      res.json(activity);
    } catch (error) {
      console.error("[products] Failed to get activity:", error);
      res.status(500).json({ message: "Failed to get activity log" });
    }
  },
);

// 12. POST /api/store/admin/products/lookup — barcode/part number lookup
router.post(
  "/api/store/admin/products/lookup",
  authenticateToken,
  requirePermission("products:manage"),
  async (req, res) => {
    try {
      const { query } = lookupSchema.parse(req.body);
      const results = await productAdmin.lookupByBarcodeOrPartNumber(query);
      res.json({ results });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
        return;
      }
      console.error("[products] Failed to lookup product:", error);
      res.status(500).json({ message: "Failed to lookup product" });
    }
  },
);

// 13. POST /api/store/admin/products/import — CSV bulk import
router.post(
  "/api/store/admin/products/import",
  authenticateToken,
  requirePermission("products:manage"),
  csvUpload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ message: "No CSV file provided" });
        return;
      }

      const csvText = file.buffer.toString("utf-8");
      const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);

      if (lines.length < 2) {
        res.status(400).json({ message: "CSV file must have a header row and at least one data row" });
        return;
      }

      // Parse header
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

      // Map headers to expected fields
      const fieldMap: Record<string, string> = {
        name: "name",
        partnumber: "partNumber",
        part_number: "partNumber",
        barcode: "barcode",
        saleprice: "salePrice",
        sale_price: "salePrice",
        price: "salePrice",
        quantity: "quantity",
        qty: "quantity",
        category: "category",
        manufacturer: "manufacturer",
        condition: "condition",
        description: "description",
      };

      const headerIndices: Record<string, number> = {};
      for (let i = 0; i < headers.length; i++) {
        const normalized = headers[i].replace(/[^a-z0-9_]/g, "");
        const mapped = fieldMap[normalized];
        if (mapped) {
          headerIndices[mapped] = i;
        }
      }

      // Parse rows
      const rows: Array<{
        name: string;
        partNumber: string;
        barcode?: string;
        salePrice: string;
        quantity?: string;
        category?: string;
        manufacturer?: string;
        condition?: string;
        description?: string;
      }> = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        const row: any = {};
        for (const [field, idx] of Object.entries(headerIndices)) {
          if (idx < values.length && values[idx].trim()) {
            row[field] = values[idx].trim();
          }
        }
        rows.push(row);
      }

      const result = await productAdmin.importProductsFromCsv(rows, req.customer!.customerId);
      res.json(result);
    } catch (error) {
      console.error("[products] Failed to import CSV:", error);
      const message = error instanceof Error ? error.message : "Failed to import CSV";
      res.status(500).json({ message });
    }
  },
);

// ─── Helpers ─────────────────────────────────────────────

/**
 * Simple CSV line parser that handles quoted fields with commas.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export default router;
