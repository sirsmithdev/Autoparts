/**
 * Saved vehicles routes — multi-vehicle garage for authenticated customers.
 */
import { Router } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware.js";
import * as vehicles from "../storage/vehicles.js";

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/store/vehicles — List saved vehicles
// ---------------------------------------------------------------------------

router.get("/api/store/vehicles", authenticateToken, async (req, res) => {
  try {
    const result = await vehicles.getSavedVehicles(req.customer!.customerId);
    res.json(result);
  } catch (error) {
    console.error("Get saved vehicles failed", error);
    res.status(500).json({ message: "Failed to get saved vehicles" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/store/vehicles — Add a vehicle
// ---------------------------------------------------------------------------

const addVehicleSchema = z.object({
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1900).max(2100),
  nickname: z.string().max(200).optional(),
});

router.post("/api/store/vehicles", authenticateToken, async (req, res) => {
  try {
    const body = addVehicleSchema.parse(req.body);
    const vehicle = await vehicles.addVehicle(req.customer!.customerId, body);
    res.status(201).json(vehicle);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors[0].message });
      return;
    }
    console.error("Add vehicle failed", error);
    res.status(500).json({ message: "Failed to add vehicle" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/store/vehicles/:id — Remove a vehicle
// ---------------------------------------------------------------------------

router.delete("/api/store/vehicles/:id", authenticateToken, async (req, res) => {
  try {
    const deleted = await vehicles.deleteVehicle(String(req.params.id), req.customer!.customerId);
    if (!deleted) {
      res.status(404).json({ message: "Vehicle not found" });
      return;
    }
    res.json({ message: "Vehicle removed" });
  } catch (error) {
    console.error("Delete vehicle failed", error);
    res.status(500).json({ message: "Failed to delete vehicle" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/store/vehicles/:id/default — Set as default vehicle
// ---------------------------------------------------------------------------

router.post("/api/store/vehicles/:id/default", authenticateToken, async (req, res) => {
  try {
    const updated = await vehicles.setDefaultVehicle(String(req.params.id), req.customer!.customerId);
    if (!updated) {
      res.status(404).json({ message: "Vehicle not found" });
      return;
    }
    res.json({ message: "Default vehicle updated" });
  } catch (error) {
    console.error("Set default vehicle failed", error);
    res.status(500).json({ message: "Failed to set default vehicle" });
  }
});

export default router;
