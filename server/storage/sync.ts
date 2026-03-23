/**
 * Sync storage module — queue management (outbound events) and sync log (audit trail).
 */

import { eq, and, lte, sql, desc, isNull, or } from "drizzle-orm";
import { db } from "../db.js";
import { syncQueue, syncLog } from "../schema.js";
import crypto from "crypto";

import type { SyncQueue, SyncLog } from "../schema.js";

const MAX_ATTEMPTS = 10;
const BASE_BACKOFF_MS = 5_000;     // 5 seconds
const MAX_BACKOFF_MS = 900_000;    // 15 minutes

// ─── Sync Queue ───────────────────────────────────────────

/** Enqueue an outbound sync event. Returns the queue item ID. */
export async function enqueueSyncEvent(data: {
  endpoint: string;
  method: string;
  payload: object;
}): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(syncQueue).values({
    id,
    endpoint: data.endpoint,
    method: data.method,
    payload: data.payload,
    status: "pending",
    attempts: 0,
  });
  return id;
}

/** Get the next pending event ready for processing (oldest first, nextRetryAt <= now or null). */
export async function getNextPendingEvent(): Promise<SyncQueue | null> {
  const [result] = await db
    .select()
    .from(syncQueue)
    .where(
      and(
        eq(syncQueue.status, "pending"),
        or(
          isNull(syncQueue.nextRetryAt),
          lte(syncQueue.nextRetryAt, new Date()),
        ),
      ),
    )
    .orderBy(syncQueue.createdAt)
    .limit(1);
  return result ?? null;
}

/** Mark an event as "processing" to prevent double-processing. */
export async function markProcessing(id: string): Promise<void> {
  await db
    .update(syncQueue)
    .set({ status: "processing" })
    .where(eq(syncQueue.id, id));
}

/** Mark an event as "completed". */
export async function markCompleted(id: string): Promise<void> {
  await db
    .update(syncQueue)
    .set({ status: "completed" })
    .where(eq(syncQueue.id, id));
}

/** Mark an event as failed: increment attempts, calculate next retry with exponential backoff. */
export async function markFailed(id: string, errorMessage: string): Promise<void> {
  const [current] = await db
    .select({ attempts: syncQueue.attempts })
    .from(syncQueue)
    .where(eq(syncQueue.id, id))
    .limit(1);

  if (!current) return;

  const newAttempts = current.attempts + 1;
  const isTerminal = newAttempts >= MAX_ATTEMPTS;

  const backoffMs = Math.min(BASE_BACKOFF_MS * Math.pow(2, newAttempts - 1), MAX_BACKOFF_MS);

  await db
    .update(syncQueue)
    .set({
      attempts: newAttempts,
      status: isTerminal ? "failed" : "pending",
      nextRetryAt: isTerminal ? null : new Date(Date.now() + backoffMs),
      lastAttemptAt: new Date(),
      errorMessage,
    })
    .where(eq(syncQueue.id, id));
}

/** Get terminally failed events for admin dashboard. */
export async function getFailedEvents(limit: number = 50): Promise<SyncQueue[]> {
  return db
    .select()
    .from(syncQueue)
    .where(eq(syncQueue.status, "failed"))
    .orderBy(desc(syncQueue.createdAt))
    .limit(limit);
}

/** Retry a specific failed event (admin action): reset to pending with zero attempts. */
export async function retryEvent(id: string): Promise<void> {
  await db
    .update(syncQueue)
    .set({
      status: "pending",
      attempts: 0,
      nextRetryAt: null,
      errorMessage: null,
    })
    .where(eq(syncQueue.id, id));
}

/** Resolve a failed event (admin marks as manually handled). */
export async function resolveEvent(id: string): Promise<void> {
  await db
    .update(syncQueue)
    .set({ status: "completed" })
    .where(eq(syncQueue.id, id));
}

/** Get queue stats for admin dashboard. */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  failed: number;
  lastSuccess: Date | null;
}> {
  const rows = await db
    .select({
      status: syncQueue.status,
      count: sql<number>`count(*)`,
    })
    .from(syncQueue)
    .where(
      or(
        eq(syncQueue.status, "pending"),
        eq(syncQueue.status, "processing"),
        eq(syncQueue.status, "failed"),
      ),
    )
    .groupBy(syncQueue.status);

  const stats: Record<string, number> = {};
  for (const row of rows) {
    stats[row.status] = Number(row.count);
  }

  // Last successful outbound sync from the log
  const [lastSuccessRow] = await db
    .select({ createdAt: syncLog.createdAt })
    .from(syncLog)
    .where(
      and(
        eq(syncLog.status, "success"),
        eq(syncLog.direction, "outbound"),
      ),
    )
    .orderBy(desc(syncLog.createdAt))
    .limit(1);

  return {
    pending: stats["pending"] ?? 0,
    processing: stats["processing"] ?? 0,
    failed: stats["failed"] ?? 0,
    lastSuccess: lastSuccessRow?.createdAt ?? null,
  };
}

/**
 * Reset any events stuck in "processing" status back to "pending".
 * Called on server startup to recover from crash/restart.
 */
export async function resetStaleProcessingEvents(): Promise<number> {
  const result = await db
    .update(syncQueue)
    .set({ status: "pending" })
    .where(eq(syncQueue.status, "processing"));
  return (result as unknown as { affectedRows?: number })?.affectedRows ?? 0;
}

/**
 * Clean up old completed sync queue events and sync log entries.
 * Deletes records older than the specified number of days.
 */
export async function cleanupOldSyncRecords(daysToKeep: number = 30): Promise<{ queueDeleted: number; logDeleted: number }> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  const queueResult = await db
    .delete(syncQueue)
    .where(and(eq(syncQueue.status, "completed"), lte(syncQueue.createdAt, cutoff)));
  const logResult = await db
    .delete(syncLog)
    .where(lte(syncLog.createdAt, cutoff));
  return {
    queueDeleted: (queueResult as unknown as { affectedRows?: number })?.affectedRows ?? 0,
    logDeleted: (logResult as unknown as { affectedRows?: number })?.affectedRows ?? 0,
  };
}

// ─── Sync Log ─────────────────────────────────────────────

/** Log a sync event (called after each sync attempt). */
export async function logSyncEvent(data: {
  direction: "inbound" | "outbound";
  entity: string;
  payload: object;
  status: "success" | "failed";
  errorMessage?: string;
}): Promise<void> {
  await db.insert(syncLog).values({
    id: crypto.randomUUID(),
    direction: data.direction,
    entity: data.entity,
    payload: data.payload,
    status: data.status,
    errorMessage: data.errorMessage ?? null,
  });
}
