/**
 * Saved vehicles storage module — multi-vehicle garage for customers.
 */

import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { savedVehicles, type SavedVehicle } from "../schema.js";
import { randomUUID } from "crypto";

// ─── Queries ─────────────────────────────────────────────

/** Get all saved vehicles for a customer, ordered by default first then newest. */
export async function getSavedVehicles(customerId: string): Promise<SavedVehicle[]> {
  return db
    .select()
    .from(savedVehicles)
    .where(eq(savedVehicles.customerId, customerId))
    .orderBy(savedVehicles.isDefault, savedVehicles.createdAt);
}

// ─── Mutations ───────────────────────────────────────────

/** Add a vehicle to the customer's garage. If it's the first vehicle, auto-set as default. */
export async function addVehicle(
  customerId: string,
  data: { make: string; model: string; year: number; nickname?: string },
): Promise<SavedVehicle> {
  // Check if customer has any vehicles yet
  const existing = await db
    .select()
    .from(savedVehicles)
    .where(eq(savedVehicles.customerId, customerId))
    .limit(1);

  const isFirst = existing.length === 0;
  const id = randomUUID();

  await db.insert(savedVehicles).values({
    id,
    customerId,
    make: data.make,
    model: data.model,
    year: data.year,
    nickname: data.nickname ?? null,
    isDefault: isFirst,
  });

  const [vehicle] = await db
    .select()
    .from(savedVehicles)
    .where(eq(savedVehicles.id, id))
    .limit(1);
  return vehicle;
}

/** Delete a vehicle. Only allowed if it belongs to the customer. */
export async function deleteVehicle(id: string, customerId: string): Promise<boolean> {
  const [vehicle] = await db
    .select()
    .from(savedVehicles)
    .where(and(eq(savedVehicles.id, id), eq(savedVehicles.customerId, customerId)))
    .limit(1);

  if (!vehicle) return false;

  await db.delete(savedVehicles).where(eq(savedVehicles.id, id));

  // If the deleted vehicle was the default, promote another one
  if (vehicle.isDefault) {
    const [next] = await db
      .select()
      .from(savedVehicles)
      .where(eq(savedVehicles.customerId, customerId))
      .limit(1);
    if (next) {
      await db
        .update(savedVehicles)
        .set({ isDefault: true })
        .where(eq(savedVehicles.id, next.id));
    }
  }

  return true;
}

/** Set a vehicle as the default, clearing the flag on all others. */
export async function setDefaultVehicle(id: string, customerId: string): Promise<boolean> {
  // Verify ownership
  const [vehicle] = await db
    .select()
    .from(savedVehicles)
    .where(and(eq(savedVehicles.id, id), eq(savedVehicles.customerId, customerId)))
    .limit(1);

  if (!vehicle) return false;

  // Clear all defaults for this customer
  await db
    .update(savedVehicles)
    .set({ isDefault: false })
    .where(eq(savedVehicles.customerId, customerId));

  // Set the new default
  await db
    .update(savedVehicles)
    .set({ isDefault: true })
    .where(eq(savedVehicles.id, id));

  return true;
}
