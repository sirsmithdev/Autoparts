/**
 * Warehouse & pick list admin routes.
 * All endpoints require admin authentication.
 */
import { Router } from "express";
import { authenticateToken, requirePermission } from "../middleware.js";
import * as warehouse from "../storage/warehouse.js";
import * as pickListStorage from "../storage/pickLists.js";
import { db } from "../db.js";
import {
  products, productBinAssignments, warehouseLocations, warehouseBins,
  cycleCounts, cycleCountItems, stockMovements,
} from "../schema.js";
import { eq, sql, and, asc, desc, count } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

// ==================== Warehouse Locations ====================

router.get(
  "/api/store/admin/warehouse/locations",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (_req, res) => {
    try {
      const locations = await warehouse.getLocations();
      res.json(locations);
    } catch (error) {
      res.status(500).json({ message: "Failed to get locations" });
    }
  },
);

router.post(
  "/api/store/admin/warehouse/locations",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      const location = await warehouse.createLocation(req.body);
      res.status(201).json(location);
    } catch (error) {
      res.status(500).json({ message: "Failed to create location" });
    }
  },
);

router.patch(
  "/api/store/admin/warehouse/locations/:id",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      await warehouse.updateLocation(String(req.params.id), req.body);
      res.json({ message: "Location updated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update location" });
    }
  },
);

router.delete(
  "/api/store/admin/warehouse/locations/:id",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      await warehouse.updateLocation(String(req.params.id), { isActive: false });
      res.json({ message: "Location deactivated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to deactivate location" });
    }
  },
);

// ==================== Overview ====================

router.get(
  "/api/store/admin/warehouse/overview",
  authenticateToken,
  requirePermission("warehouse:read"),
  async (_req, res) => {
    try {
      const [[locRow], [binRow], [prodRow]] = await Promise.all([
        db.select({ total: count() }).from(warehouseLocations).where(eq(warehouseLocations.isActive, true)),
        db.select({ total: count() }).from(warehouseBins).where(eq(warehouseBins.isActive, true)),
        db.select({ total: sql<number>`COUNT(DISTINCT ${productBinAssignments.productId})` }).from(productBinAssignments),
      ]);
      res.json({
        totalLocations: locRow.total,
        totalBins: binRow.total,
        totalProductsWithBins: Number(prodRow.total),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get overview" });
    }
  },
);

// ==================== Warehouse Bins ====================

router.get(
  "/api/store/admin/warehouse/bins",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      const locationId = req.query.locationId
        ? String(req.query.locationId)
        : undefined;
      const bins = await warehouse.getBins(locationId);
      res.json(bins);
    } catch (error) {
      res.status(500).json({ message: "Failed to get bins" });
    }
  },
);

router.post(
  "/api/store/admin/warehouse/bins",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      const bin = await warehouse.createBin(req.body);
      res.status(201).json(bin);
    } catch (error) {
      res.status(500).json({ message: "Failed to create bin" });
    }
  },
);

router.patch(
  "/api/store/admin/warehouse/bins/:id",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      await warehouse.updateBin(String(req.params.id), req.body);
      res.json({ message: "Bin updated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update bin" });
    }
  },
);

router.get(
  "/api/store/admin/warehouse/bins/:id/contents",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      const contents = await warehouse.getBinContents(String(req.params.id));
      res.json(contents);
    } catch (error) {
      res.status(500).json({ message: "Failed to get bin contents" });
    }
  },
);

// ==================== Stock Operations ====================

router.post(
  "/api/store/admin/warehouse/assign",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      await warehouse.assignProductToBin(
        req.body.productId,
        req.body.binId,
        req.body.quantity,
        req.customer!.customerId,
      );
      res.json({ message: "Product assigned to bin" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to assign product to bin";
      res.status(400).json({ message });
    }
  },
);

router.post(
  "/api/store/admin/warehouse/transfer",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      await warehouse.transferStock(
        req.body.productId,
        req.body.fromBinId,
        req.body.toBinId,
        req.body.quantity,
        req.customer!.customerId,
      );
      res.json({ message: "Stock transferred" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to transfer stock";
      res.status(400).json({ message });
    }
  },
);

router.post(
  "/api/store/admin/warehouse/adjust",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      await warehouse.adjustStock(
        req.body.productId,
        req.body.binId,
        req.body.quantity,
        req.body.reason,
        req.customer!.customerId,
      );
      res.json({ message: "Stock adjusted" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to adjust stock";
      res.status(400).json({ message });
    }
  },
);

router.get(
  "/api/store/admin/warehouse/product/:id/bins",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      const locations = await warehouse.getProductBinLocations(String(req.params.id));
      res.json(locations);
    } catch (error) {
      res.status(500).json({ message: "Failed to get product bin locations" });
    }
  },
);

// ==================== Stock Receipts ====================

router.get(
  "/api/store/admin/warehouse/receipts",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      const result = await warehouse.getStockReceipts({
        status: req.query.status ? String(req.query.status) : undefined,
        page: req.query.page ? parseInt(String(req.query.page)) : undefined,
        limit: req.query.limit ? parseInt(String(req.query.limit)) : undefined,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get stock receipts" });
    }
  },
);

router.post(
  "/api/store/admin/warehouse/receipts",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      const receipt = await warehouse.createStockReceipt(
        req.body,
        req.customer!.customerId,
      );

      // If action is "receive", immediately confirm the receipt
      if (req.body.action === "receive") {
        await warehouse.confirmStockReceipt(
          receipt.id,
          req.customer!.customerId,
        );
        const confirmed = await warehouse.getStockReceipt(receipt.id);
        res.status(201).json(confirmed);
        return;
      }

      res.status(201).json(receipt);
    } catch (error) {
      res.status(500).json({ message: "Failed to create stock receipt" });
    }
  },
);

router.get(
  "/api/store/admin/warehouse/receipts/:id",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      const receipt = await warehouse.getStockReceipt(String(req.params.id));
      if (!receipt) {
        res.status(404).json({ message: "Stock receipt not found" });
        return;
      }
      res.json(receipt);
    } catch (error) {
      res.status(500).json({ message: "Failed to get stock receipt" });
    }
  },
);

router.post(
  "/api/store/admin/warehouse/receipts/:id/receive",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      await warehouse.confirmStockReceipt(
        String(req.params.id),
        req.customer!.customerId,
      );
      res.json({ message: "Stock receipt confirmed" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to confirm receipt";
      res.status(400).json({ message });
    }
  },
);

router.post(
  "/api/store/admin/warehouse/receipts/:id/cancel",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      await warehouse.cancelStockReceipt(String(req.params.id));
      res.json({ message: "Stock receipt cancelled" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to cancel receipt";
      res.status(400).json({ message });
    }
  },
);

// ==================== Stock Movements ====================

router.get(
  "/api/store/admin/warehouse/movements",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      const result = await warehouse.getStockMovementHistory({
        productId: req.query.productId ? String(req.query.productId) : undefined,
        movementType: req.query.movementType ? String(req.query.movementType) : undefined,
        productSearch: req.query.productSearch ? String(req.query.productSearch) : undefined,
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        page: req.query.page ? parseInt(String(req.query.page)) : undefined,
        limit: req.query.limit ? parseInt(String(req.query.limit)) : undefined,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get stock movements" });
    }
  },
);

// ==================== Pick Lists ====================

router.get(
  "/api/store/admin/pick-lists",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      const result = await pickListStorage.getPickLists({
        status: req.query.status ? String(req.query.status) : undefined,
        page: req.query.page ? parseInt(String(req.query.page)) : undefined,
        limit: req.query.limit ? parseInt(String(req.query.limit)) : undefined,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get pick lists" });
    }
  },
);

router.get(
  "/api/store/admin/pick-lists/:id",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      const pickList = await pickListStorage.getPickList(String(req.params.id));
      if (!pickList) {
        res.status(404).json({ message: "Pick list not found" });
        return;
      }
      res.json(pickList);
    } catch (error) {
      res.status(500).json({ message: "Failed to get pick list" });
    }
  },
);

router.post(
  "/api/store/admin/pick-lists/:id/assign",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      await pickListStorage.assignPickList(String(req.params.id), req.body.assignedTo);
      res.json({ message: "Pick list assigned" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to assign pick list";
      res.status(400).json({ message });
    }
  },
);

router.post(
  "/api/store/admin/pick-lists/:id/start",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      await pickListStorage.startPickList(String(req.params.id));
      res.json({ message: "Pick list started" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to start pick list";
      res.status(400).json({ message });
    }
  },
);

router.post(
  "/api/store/admin/pick-lists/:id/items/:itemId/pick",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      await pickListStorage.pickItem(String(req.params.itemId), req.body.quantityPicked);
      res.json({ message: "Item picked" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to pick item";
      res.status(400).json({ message });
    }
  },
);

router.post(
  "/api/store/admin/pick-lists/:id/complete",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      await pickListStorage.completePickList(String(req.params.id));
      res.json({ message: "Pick list completed" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to complete pick list";
      res.status(400).json({ message });
    }
  },
);

router.post(
  "/api/store/admin/pick-lists/:id/cancel",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      await pickListStorage.cancelPickList(String(req.params.id));
      res.json({ message: "Pick list cancelled" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to cancel pick list";
      res.status(400).json({ message });
    }
  },
);

router.post(
  "/api/store/admin/pick-lists/:id/items/:itemId/skip",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      await pickListStorage.skipItem(String(req.params.id), String(req.params.itemId));
      res.json({ message: "Item skipped" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to skip item";
      res.status(400).json({ message });
    }
  },
);

// ==================== Damage Recording ====================

router.post(
  "/api/store/admin/warehouse/damage",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      const { productId, binId, quantity, reason } = req.body;
      if (!productId || !binId || !quantity || !reason) {
        res.status(400).json({ message: "productId, binId, quantity, and reason are required" });
        return;
      }

      const absQty = Math.abs(quantity);

      await db.transaction(async (tx) => {
        // Decrement bin assignment
        const [existing] = await tx
          .select()
          .from(productBinAssignments)
          .where(
            and(
              eq(productBinAssignments.productId, productId),
              eq(productBinAssignments.binId, binId),
            ),
          )
          .limit(1);

        if (!existing || existing.quantity < absQty) {
          throw new Error(
            `Insufficient stock in bin (available: ${existing?.quantity ?? 0}, damaged: ${absQty})`,
          );
        }

        await tx
          .update(productBinAssignments)
          .set({ quantity: existing.quantity - absQty, updatedAt: new Date() })
          .where(eq(productBinAssignments.id, existing.id));

        // Decrement products.quantity
        await tx.execute(
          sql`UPDATE products SET quantity = quantity - ${absQty} WHERE id = ${productId}`,
        );

        // Record stock movement with "damaged" type
        await tx.insert(stockMovements).values({
          id: randomUUID(),
          productId,
          binId,
          movementType: "damaged",
          quantity: -absQty,
          referenceType: "damage_report",
          referenceId: reason,
          notes: `Damaged: ${reason}`,
          performedBy: req.customer!.customerId,
        });
      });

      res.json({ message: "Damage recorded" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to record damage";
      res.status(400).json({ message });
    }
  },
);

// ==================== Low Stock Alerts ====================

router.get(
  "/api/store/admin/warehouse/low-stock",
  authenticateToken,
  requirePermission("warehouse:read"),
  async (_req, res) => {
    try {
      const items = await db
        .select({
          productId: products.id,
          productName: products.name,
          partNumber: products.partNumber,
          currentStock: products.quantity,
          reorderPoint: products.reorderPoint,
          lowStockThreshold: products.lowStockThreshold,
        })
        .from(products)
        .where(
          and(
            eq(products.isActive, true),
            sql`${products.quantity} <= ${products.reorderPoint}`,
            sql`${products.reorderPoint} > 0`,
          ),
        )
        .orderBy(asc(products.quantity));

      res.json({
        items: items.map((i) => ({
          ...i,
          currentStock: Number(i.currentStock),
          reorderPoint: Number(i.reorderPoint),
          lowStockThreshold: Number(i.lowStockThreshold),
          deficit: Number(i.reorderPoint) - Number(i.currentStock),
        })),
        total: items.length,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get low stock alerts" });
    }
  },
);

router.patch(
  "/api/store/admin/warehouse/reorder-point/:productId",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      const { reorderPoint } = req.body;
      await db
        .update(products)
        .set({ reorderPoint: Number(reorderPoint) })
        .where(eq(products.id, String(req.params.productId)));
      res.json({ message: "Reorder point updated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update reorder point" });
    }
  },
);

// ==================== Cycle Counts ====================

router.get(
  "/api/store/admin/warehouse/cycle-counts",
  authenticateToken,
  requirePermission("warehouse:read"),
  async (_req, res) => {
    try {
      const rows = await db
        .select({
          id: cycleCounts.id,
          locationId: cycleCounts.locationId,
          status: cycleCounts.status,
          startedBy: cycleCounts.startedBy,
          notes: cycleCounts.notes,
          completedAt: cycleCounts.completedAt,
          createdAt: cycleCounts.createdAt,
          locationName: warehouseLocations.name,
          itemCount: sql<number>`(SELECT COUNT(*) FROM cycle_count_items WHERE cycle_count_id = ${cycleCounts.id})`,
        })
        .from(cycleCounts)
        .leftJoin(warehouseLocations, eq(warehouseLocations.id, cycleCounts.locationId))
        .orderBy(desc(cycleCounts.createdAt));
      res.json(rows);
    } catch (error) {
      res.status(500).json({ message: "Failed to get cycle counts" });
    }
  },
);

router.post(
  "/api/store/admin/warehouse/cycle-counts",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      const { locationId } = req.body;
      const cycleCountId = randomUUID();

      // Create cycle count
      await db.insert(cycleCounts).values({
        id: cycleCountId,
        locationId,
        status: "pending",
        startedBy: req.customer!.customerId,
      });

      // Get all bin assignments for this location to pre-populate items
      const binAssignments = await db
        .select({
          productId: productBinAssignments.productId,
          binId: productBinAssignments.binId,
          quantity: productBinAssignments.quantity,
        })
        .from(productBinAssignments)
        .innerJoin(warehouseBins, eq(warehouseBins.id, productBinAssignments.binId))
        .where(eq(warehouseBins.locationId, locationId));

      if (binAssignments.length > 0) {
        await db.insert(cycleCountItems).values(
          binAssignments.map((ba) => ({
            id: randomUUID(),
            cycleCountId,
            productId: ba.productId,
            binId: ba.binId,
            expectedQuantity: ba.quantity,
            status: "pending",
          })),
        );
      }

      const [created] = await db.select().from(cycleCounts).where(eq(cycleCounts.id, cycleCountId)).limit(1);
      res.status(201).json({ ...created, itemCount: binAssignments.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to create cycle count" });
    }
  },
);

router.get(
  "/api/store/admin/warehouse/cycle-counts/:id",
  authenticateToken,
  requirePermission("warehouse:read"),
  async (req, res) => {
    try {
      const id = String(req.params.id);
      const [cc] = await db
        .select({
          id: cycleCounts.id,
          locationId: cycleCounts.locationId,
          status: cycleCounts.status,
          startedBy: cycleCounts.startedBy,
          notes: cycleCounts.notes,
          completedAt: cycleCounts.completedAt,
          createdAt: cycleCounts.createdAt,
          locationName: warehouseLocations.name,
        })
        .from(cycleCounts)
        .leftJoin(warehouseLocations, eq(warehouseLocations.id, cycleCounts.locationId))
        .where(eq(cycleCounts.id, id))
        .limit(1);

      if (!cc) {
        res.status(404).json({ message: "Cycle count not found" });
        return;
      }

      const items = await db
        .select({
          id: cycleCountItems.id,
          productId: cycleCountItems.productId,
          binId: cycleCountItems.binId,
          expectedQuantity: cycleCountItems.expectedQuantity,
          actualQuantity: cycleCountItems.actualQuantity,
          variance: cycleCountItems.variance,
          status: cycleCountItems.status,
          countedAt: cycleCountItems.countedAt,
          productName: products.name,
          partNumber: products.partNumber,
          binCode: warehouseBins.binCode,
        })
        .from(cycleCountItems)
        .innerJoin(products, eq(products.id, cycleCountItems.productId))
        .innerJoin(warehouseBins, eq(warehouseBins.id, cycleCountItems.binId))
        .where(eq(cycleCountItems.cycleCountId, id))
        .orderBy(asc(warehouseBins.binCode));

      res.json({ ...cc, items });
    } catch (error) {
      res.status(500).json({ message: "Failed to get cycle count" });
    }
  },
);

router.post(
  "/api/store/admin/warehouse/cycle-counts/:id/items/:itemId/count",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      const { actualQuantity } = req.body;
      const itemId = String(req.params.itemId);

      const [item] = await db
        .select()
        .from(cycleCountItems)
        .where(eq(cycleCountItems.id, itemId))
        .limit(1);

      if (!item) {
        res.status(404).json({ message: "Cycle count item not found" });
        return;
      }

      const variance = actualQuantity - item.expectedQuantity;

      await db
        .update(cycleCountItems)
        .set({
          actualQuantity,
          variance,
          status: "counted",
          countedAt: new Date(),
        })
        .where(eq(cycleCountItems.id, itemId));

      res.json({ message: "Count recorded", variance });
    } catch (error) {
      res.status(500).json({ message: "Failed to record count" });
    }
  },
);

router.post(
  "/api/store/admin/warehouse/cycle-counts/:id/items/:itemId/skip",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      await db
        .update(cycleCountItems)
        .set({ status: "skipped" })
        .where(eq(cycleCountItems.id, String(req.params.itemId)));
      res.json({ message: "Item skipped" });
    } catch (error) {
      res.status(500).json({ message: "Failed to skip item" });
    }
  },
);

router.post(
  "/api/store/admin/warehouse/cycle-counts/:id/complete",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      const id = String(req.params.id);

      // Verify all items counted or skipped
      const [pendingRow] = await db
        .select({ total: count() })
        .from(cycleCountItems)
        .where(and(eq(cycleCountItems.cycleCountId, id), eq(cycleCountItems.status, "pending")));

      if (pendingRow.total > 0) {
        res.status(400).json({ message: `${pendingRow.total} item(s) still pending` });
        return;
      }

      // Get counted items with variances
      const countedItems = await db
        .select()
        .from(cycleCountItems)
        .where(and(eq(cycleCountItems.cycleCountId, id), eq(cycleCountItems.status, "counted")));

      // Apply adjustments for items with variances
      let adjustmentsApplied = 0;
      for (const item of countedItems) {
        if (item.variance && item.variance !== 0) {
          try {
            await warehouse.adjustStock(
              item.productId!,
              item.binId!,
              item.variance,
              `Cycle count adjustment`,
              req.customer!.customerId,
            );
            adjustmentsApplied++;
          } catch {
            // Continue with other items
          }
        }
      }

      await db
        .update(cycleCounts)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(cycleCounts.id, id));

      res.json({ message: "Cycle count completed", adjustmentsApplied });
    } catch (error) {
      res.status(500).json({ message: "Failed to complete cycle count" });
    }
  },
);

// ==================== Stock Reconciliation ====================

router.get(
  "/api/store/admin/warehouse/reconciliation",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (_req, res) => {
    try {
      // Find products where products.quantity != SUM(product_bin_assignments.quantity)
      const discrepancies = await db
        .select({
          productId: products.id,
          productName: products.name,
          partNumber: products.partNumber,
          systemQuantity: products.quantity,
          binTotalQuantity:
            sql<number>`COALESCE(SUM(${productBinAssignments.quantity}), 0)`,
          discrepancy: sql<number>`${products.quantity} - COALESCE(SUM(${productBinAssignments.quantity}), 0)`,
        })
        .from(products)
        .leftJoin(
          productBinAssignments,
          eq(products.id, productBinAssignments.productId),
        )
        .where(eq(products.isActive, true))
        .groupBy(products.id, products.name, products.partNumber, products.quantity)
        .having(
          sql`${products.quantity} != COALESCE(SUM(${productBinAssignments.quantity}), 0)`,
        )
        .orderBy(
          sql`ABS(${products.quantity} - COALESCE(SUM(${productBinAssignments.quantity}), 0)) DESC`,
        );

      res.json({
        discrepancies: discrepancies.map((d) => ({
          productId: d.productId,
          productName: d.productName,
          partNumber: d.partNumber,
          systemQuantity: Number(d.systemQuantity),
          binTotalQuantity: Number(d.binTotalQuantity),
          discrepancy: Number(d.discrepancy),
        })),
        total: discrepancies.length,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get reconciliation data" });
    }
  },
);

router.post(
  "/api/store/admin/warehouse/reconciliation/:productId",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      const productId = String(req.params.productId);

      // Verify product exists
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);
      if (!product) {
        res.status(404).json({ message: "Product not found" });
        return;
      }

      // Get the sum of bin assignment quantities
      const [binSum] = await db
        .select({
          total: sql<number>`COALESCE(SUM(${productBinAssignments.quantity}), 0)`,
        })
        .from(productBinAssignments)
        .where(eq(productBinAssignments.productId, productId));

      const binTotal = Number(binSum.total);
      const previousQuantity = product.quantity;
      const difference = binTotal - previousQuantity;

      // Set products.quantity = SUM(bin quantities)
      await db
        .update(products)
        .set({ quantity: binTotal })
        .where(eq(products.id, productId));

      // Record stock movement for the reconciliation adjustment
      if (difference !== 0) {
        const movementType = difference > 0 ? "adjusted_up" : "adjusted_down";
        await db.insert(stockMovements).values({
          id: randomUUID(),
          productId,
          movementType,
          quantity: difference,
          referenceType: "reconciliation",
          notes: `Reconciliation adjustment (system: ${previousQuantity}, bins: ${binTotal})`,
          performedBy: req.customer!.customerId,
        });
      }

      res.json({
        message: "Product quantity reconciled",
        productId,
        previousQuantity,
        reconciledQuantity: binTotal,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to reconcile product quantity" });
    }
  },
);

export default router;
