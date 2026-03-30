/**
 * Supplier storage module — CRUD for supplier records.
 */

import { eq, asc } from "drizzle-orm";
import { db } from "../db.js";
import { suppliers, type Supplier } from "../schema.js";
import { randomUUID } from "crypto";

export async function listSuppliers(
  includeInactive?: boolean,
): Promise<Supplier[]> {
  if (includeInactive) {
    return db.select().from(suppliers).orderBy(asc(suppliers.name));
  }
  return db
    .select()
    .from(suppliers)
    .where(eq(suppliers.isActive, true))
    .orderBy(asc(suppliers.name));
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, id))
    .limit(1);
  return supplier ?? null;
}

export async function createSupplier(data: {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}): Promise<Supplier> {
  const id = randomUUID();
  await db.insert(suppliers).values({ id, ...data });
  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, id))
    .limit(1);
  return supplier;
}

export async function updateSupplier(
  id: string,
  data: Partial<{
    name: string;
    contactName: string;
    email: string;
    phone: string;
    address: string;
    notes: string;
    isActive: boolean;
  }>,
): Promise<void> {
  await db.update(suppliers).set(data).where(eq(suppliers.id, id));
}

export async function deactivateSupplier(id: string): Promise<void> {
  await db
    .update(suppliers)
    .set({ isActive: false })
    .where(eq(suppliers.id, id));
}
