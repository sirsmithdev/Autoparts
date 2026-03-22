/**
 * Warehouse & pick list admin routes.
 * All endpoints require admin authentication.
 */
import { Router } from "express";
import { authenticateToken, requirePermission } from "../middleware.js";
import * as warehouse from "../storage/warehouse.js";
import * as pickListStorage from "../storage/pickLists.js";

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

export default router;
