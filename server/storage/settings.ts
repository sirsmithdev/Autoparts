/**
 * Store settings & delivery zone storage module.
 * Extracted from onlineStore.ts — singleton settings (id=1) + parish-based delivery zones.
 */

import { eq, asc } from "drizzle-orm";
import { db } from "../db.js";
import {
  storeSettings,
  deliveryZones,
  type StoreSettings,
  type DeliveryZone,
  type InsertDeliveryZone,
} from "../schema.js";
import { randomUUID } from "crypto";

// Simple in-memory cache for settings (no Redis dependency)
let settingsCache: { data: StoreSettings; expires: number } | null = null;

// ─── Store Settings (singleton, id=1) ─────────────────────

export async function getStoreSettings(): Promise<StoreSettings> {
  if (settingsCache && Date.now() < settingsCache.expires) {
    return settingsCache.data;
  }
  const [settings] = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.id, 1))
    .limit(1);
  if (settings) {
    settingsCache = { data: settings, expires: Date.now() + 300_000 };
  }
  return settings;
}

export async function updateStoreSettings(
  data: Partial<StoreSettings>,
): Promise<StoreSettings> {
  const { id, ...updateData } = data;
  await db
    .update(storeSettings)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(storeSettings.id, 1));
  settingsCache = null;
  return getStoreSettings();
}

// ─── Delivery Zones ───────────────────────────────────────

export async function getActiveDeliveryZones(): Promise<DeliveryZone[]> {
  return db
    .select()
    .from(deliveryZones)
    .where(eq(deliveryZones.isActive, true))
    .orderBy(asc(deliveryZones.sortOrder));
}

export async function getAllDeliveryZones(): Promise<DeliveryZone[]> {
  return db
    .select()
    .from(deliveryZones)
    .orderBy(asc(deliveryZones.sortOrder));
}

export async function getDeliveryZone(
  id: string,
): Promise<DeliveryZone | undefined> {
  const [zone] = await db
    .select()
    .from(deliveryZones)
    .where(eq(deliveryZones.id, id))
    .limit(1);
  return zone;
}

export async function createDeliveryZone(
  data: Omit<InsertDeliveryZone, "id" | "createdAt" | "updatedAt">,
): Promise<DeliveryZone> {
  const id = randomUUID();
  await db.insert(deliveryZones).values({ ...data, id });
  return (await getDeliveryZone(id))!;
}

export async function updateDeliveryZone(
  id: string,
  data: Partial<InsertDeliveryZone>,
): Promise<DeliveryZone | undefined> {
  await db
    .update(deliveryZones)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(deliveryZones.id, id));
  return getDeliveryZone(id);
}

export async function deleteDeliveryZone(id: string): Promise<void> {
  await db.delete(deliveryZones).where(eq(deliveryZones.id, id));
}

export async function getDeliveryFeeForParish(
  parish: string,
  hasOversizedItems = false,
): Promise<{
  fee: string;
  estimatedDays: number;
  zoneName: string;
} | null> {
  const zones = await getActiveDeliveryZones();
  for (const zone of zones) {
    const parishes = zone.parishes as string[];
    if (parishes.some((p) => p.toLowerCase() === parish.toLowerCase())) {
      const fee = hasOversizedItems
        ? (
            parseFloat(zone.deliveryFee) + parseFloat(zone.oversizedSurcharge)
          ).toFixed(2)
        : zone.deliveryFee;
      return { fee, estimatedDays: zone.estimatedDays, zoneName: zone.name };
    }
  }
  return null;
}
