/**
 * Staff activity logging — tracks admin/staff actions for audit trail.
 */

import { eq, and, desc, sql, count } from "drizzle-orm";
import { db } from "../db.js";
import { staffActivityLog, customers } from "../schema.js";
import crypto from "crypto";

export interface ActivityEntry {
  id: string;
  staffName: string | null;
  staffEmail: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: Date;
}

/** Insert a staff activity log entry. */
export async function logActivity(params: {
  staffId: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  await db.insert(staffActivityLog).values({
    id: crypto.randomUUID(),
    staffId: params.staffId,
    action: params.action,
    entity: params.entity ?? null,
    entityId: params.entityId ?? null,
    details: params.details ?? null,
    ipAddress: params.ipAddress ?? null,
  });
}

/** Paginated activity log with optional filters. Joins with customers for staff name/email. */
export async function getActivityLog(params: {
  staffId?: string;
  action?: string;
  entity?: string;
  page?: number;
  limit?: number;
}): Promise<{ entries: ActivityEntry[]; total: number }> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions = [];
  if (params.staffId) conditions.push(eq(staffActivityLog.staffId, params.staffId));
  if (params.action) conditions.push(eq(staffActivityLog.action, params.action));
  if (params.entity) conditions.push(eq(staffActivityLog.entity, params.entity));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const [countResult] = await db
    .select({ total: count() })
    .from(staffActivityLog)
    .where(where);

  const total = countResult?.total ?? 0;

  // Get entries with staff info
  const rows = await db
    .select({
      id: staffActivityLog.id,
      staffFirstName: customers.firstName,
      staffLastName: customers.lastName,
      staffEmail: customers.email,
      action: staffActivityLog.action,
      entity: staffActivityLog.entity,
      entityId: staffActivityLog.entityId,
      details: staffActivityLog.details,
      ipAddress: staffActivityLog.ipAddress,
      createdAt: staffActivityLog.createdAt,
    })
    .from(staffActivityLog)
    .leftJoin(customers, eq(staffActivityLog.staffId, customers.id))
    .where(where)
    .orderBy(desc(staffActivityLog.createdAt))
    .limit(limit)
    .offset(offset);

  const entries: ActivityEntry[] = rows.map((row) => ({
    id: row.id,
    staffName: row.staffFirstName && row.staffLastName
      ? `${row.staffFirstName} ${row.staffLastName}`
      : row.staffFirstName || row.staffLastName || null,
    staffEmail: row.staffEmail ?? "",
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    details: row.details,
    ipAddress: row.ipAddress,
    createdAt: row.createdAt,
  }));

  return { entries, total };
}

/** Get most recent activity timestamp for a staff member. */
export async function getStaffLastActivity(staffId: string): Promise<Date | null> {
  const [result] = await db
    .select({ createdAt: staffActivityLog.createdAt })
    .from(staffActivityLog)
    .where(eq(staffActivityLog.staffId, staffId))
    .orderBy(desc(staffActivityLog.createdAt))
    .limit(1);
  return result?.createdAt ?? null;
}
