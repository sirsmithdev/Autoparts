/**
 * Stock sync helpers — thin wrappers that enqueue stock change events
 * for the garage app to process.
 *
 * Called when: online order placed, POS sale completed, order cancelled, return restocked.
 */

import { enqueueSyncEvent } from "../storage/sync.js";

/**
 * Enqueue stock decrement events for the garage app.
 * Called when: online order placed, POS sale completed.
 * Each item creates a separate queue event so failures are isolated.
 */
export async function enqueueStockDecrement(
  items: Array<{
    garagePartId: string | null;
    quantity: number;
  }>,
  orderId: string,
  orderNumber: string,
): Promise<void> {
  for (const item of items) {
    if (!item.garagePartId) continue; // Skip products not synced from garage
    await enqueueSyncEvent({
      endpoint: "/stock-decrement",
      method: "POST",
      payload: {
        garagePartId: item.garagePartId,
        quantity: item.quantity,
        orderId,
        orderNumber,
      },
    });
  }
}

/**
 * Enqueue stock restore events for the garage app.
 * Called when: order cancelled, return received and restocked.
 */
export async function enqueueStockRestore(
  items: Array<{
    garagePartId: string | null;
    quantity: number;
  }>,
  orderId: string,
  reason: string,
): Promise<void> {
  for (const item of items) {
    if (!item.garagePartId) continue; // Skip products not synced from garage
    await enqueueSyncEvent({
      endpoint: "/stock-restore",
      method: "POST",
      payload: {
        garagePartId: item.garagePartId,
        quantity: item.quantity,
        orderId,
        reason,
      },
    });
  }
}
