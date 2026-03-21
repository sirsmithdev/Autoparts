/**
 * Outbound sync queue processor — polls the sync_queue table for pending events
 * and dispatches them to the garage app via garageClient.
 *
 * Runs on a configurable interval (default 30s). Processes up to 10 events per tick
 * to avoid long-running cycles. Failed events are automatically retried with
 * exponential backoff (handled by markFailed in storage/sync.ts).
 */

import {
  getNextPendingEvent,
  markProcessing,
  markCompleted,
  markFailed,
  logSyncEvent,
} from "../storage/sync.js";
import { sendStockDecrement, sendStockRestore } from "./garageClient.js";

/**
 * Process the next pending sync event from the queue.
 * Returns true if an event was processed, false if the queue was empty.
 */
export async function processNextSyncEvent(): Promise<boolean> {
  const event = await getNextPendingEvent();
  if (!event) return false;

  await markProcessing(event.id);

  try {
    const payload =
      typeof event.payload === "string"
        ? JSON.parse(event.payload)
        : event.payload;

    let result: { success: boolean; error?: string };

    if (event.endpoint === "/stock-decrement") {
      result = await sendStockDecrement(payload);
    } else if (event.endpoint === "/stock-restore") {
      result = await sendStockRestore(payload);
    } else {
      result = { success: false, error: `Unknown endpoint: ${event.endpoint}` };
    }

    if (result.success) {
      await markCompleted(event.id);
      await logSyncEvent({
        direction: "outbound",
        entity: "stock",
        payload,
        status: "success",
      });
    } else {
      await markFailed(event.id, result.error || "Unknown error");
      await logSyncEvent({
        direction: "outbound",
        entity: "stock",
        payload,
        status: "failed",
        errorMessage: result.error,
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    await markFailed(event.id, msg);
    await logSyncEvent({
      direction: "outbound",
      entity: "stock",
      payload: {},
      status: "failed",
      errorMessage: msg,
    });
  }

  return true;
}

/**
 * Start the background queue processor on a fixed interval.
 * Processes up to 10 events per tick, then waits for the next interval.
 */
export function startQueueProcessor(intervalMs: number = 30_000): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      let processed = 0;
      while (processed < 10) {
        const didProcess = await processNextSyncEvent();
        if (!didProcess) break;
        processed++;
      }
      if (processed > 0) {
        console.log(`[sync] Processed ${processed} outbound sync event(s)`);
      }
    } catch (error) {
      console.error("[sync] Queue processor error:", error);
    }
  }, intervalMs);
}
