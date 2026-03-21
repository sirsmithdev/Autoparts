/**
 * Payment methods storage — saved cards CRUD for customers.
 *
 * Each card is stored as a PanToken (from PowerTranz tokenization) with
 * masked display info. Actual card numbers are never stored.
 */

import { eq, and, desc } from "drizzle-orm";
import { db } from "../db.js";
import { paymentMethods, type PaymentMethod } from "../schema.js";
import { randomUUID } from "crypto";

/**
 * List all saved payment methods for a customer.
 * Ordered by default first, then most recent.
 */
export async function getPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
  return db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.customerId, customerId))
    .orderBy(desc(paymentMethods.isDefault), desc(paymentMethods.createdAt));
}

/**
 * Get a single payment method by ID, scoped to a customer.
 */
export async function getPaymentMethod(id: string, customerId: string): Promise<PaymentMethod | null> {
  const [method] = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.customerId, customerId)))
    .limit(1);
  return method || null;
}

/**
 * Save a new payment method (tokenized card).
 * If this is the first card for the customer, it becomes the default.
 */
export async function createPaymentMethod(data: {
  customerId: string;
  panToken: string;
  cardBrand: string;
  maskedPan: string;
  cardholderName: string;
  expiryMonth: number;
  expiryYear: number;
}): Promise<PaymentMethod> {
  // Check if customer already has cards
  const existing = await db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.customerId, data.customerId))
    .limit(1);

  const isFirst = existing.length === 0;
  const id = randomUUID();

  await db.insert(paymentMethods).values({
    id,
    customerId: data.customerId,
    panToken: data.panToken,
    cardBrand: data.cardBrand,
    maskedPan: data.maskedPan,
    cardholderName: data.cardholderName,
    expiryMonth: data.expiryMonth,
    expiryYear: data.expiryYear,
    isDefault: isFirst,
    isVerified: true,
  });

  const [created] = await db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.id, id))
    .limit(1);

  return created;
}

/**
 * Delete a saved payment method.
 * If it was the default, promote the next most recent card.
 */
export async function deletePaymentMethod(id: string, customerId: string): Promise<void> {
  // Check if this was the default
  const [method] = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.customerId, customerId)))
    .limit(1);

  if (!method) return;

  await db
    .delete(paymentMethods)
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.customerId, customerId)));

  // If the deleted card was the default, promote the next card
  if (method.isDefault) {
    const [next] = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.customerId, customerId))
      .orderBy(desc(paymentMethods.createdAt))
      .limit(1);

    if (next) {
      await db
        .update(paymentMethods)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(paymentMethods.id, next.id));
    }
  }
}

/**
 * Set a payment method as the default for a customer.
 * Unsets all other defaults first.
 */
export async function setDefaultPaymentMethod(id: string, customerId: string): Promise<void> {
  // Unset all defaults for this customer
  await db
    .update(paymentMethods)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(eq(paymentMethods.customerId, customerId));

  // Set the chosen one as default
  await db
    .update(paymentMethods)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(and(eq(paymentMethods.id, id), eq(paymentMethods.customerId, customerId)));
}

/**
 * Mark a payment method as verified (after NCB verification succeeds).
 */
export async function markAsVerified(id: string): Promise<void> {
  await db
    .update(paymentMethods)
    .set({ isVerified: true, updatedAt: new Date() })
    .where(eq(paymentMethods.id, id));
}
