/**
 * Supplier CRUD routes.
 * All endpoints require admin authentication with warehouse:manage permission.
 */
import { Router } from "express";
import { authenticateToken, requirePermission } from "../middleware.js";
import * as supplierStorage from "../storage/suppliers.js";

const router = Router();

router.get(
  "/api/store/admin/suppliers",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      const includeInactive = req.query.includeInactive === "true";
      const suppliers = await supplierStorage.listSuppliers(includeInactive);
      res.json(suppliers);
    } catch (error) {
      res.status(500).json({ message: "Failed to list suppliers" });
    }
  },
);

router.get(
  "/api/store/admin/suppliers/:id",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      const supplier = await supplierStorage.getSupplier(String(req.params.id));
      if (!supplier) {
        res.status(404).json({ message: "Supplier not found" });
        return;
      }
      res.json(supplier);
    } catch (error) {
      res.status(500).json({ message: "Failed to get supplier" });
    }
  },
);

router.post(
  "/api/store/admin/suppliers",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      if (!req.body.name) {
        res.status(400).json({ message: "Supplier name is required" });
        return;
      }
      const supplier = await supplierStorage.createSupplier(req.body);
      res.status(201).json(supplier);
    } catch (error) {
      res.status(500).json({ message: "Failed to create supplier" });
    }
  },
);

router.patch(
  "/api/store/admin/suppliers/:id",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      await supplierStorage.updateSupplier(String(req.params.id), req.body);
      res.json({ message: "Supplier updated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update supplier" });
    }
  },
);

router.delete(
  "/api/store/admin/suppliers/:id",
  authenticateToken,
  requirePermission("warehouse:manage"),
  async (req, res) => {
    try {
      await supplierStorage.deactivateSupplier(String(req.params.id));
      res.json({ message: "Supplier deactivated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to deactivate supplier" });
    }
  },
);

export default router;
