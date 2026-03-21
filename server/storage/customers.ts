/**
 * Customer storage module — registration, authentication, profile, refresh tokens.
 */

import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { customers, refreshTokens } from "../schema.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

import type { Customer } from "../schema.js";

const BCRYPT_ROUNDS = 10;

// ─── Customer Queries ─────────────────────────────────────

/** Find customer by email (for login). */
export async function findByEmail(email: string): Promise<Customer | null> {
  const [result] = await db
    .select()
    .from(customers)
    .where(eq(customers.email, email))
    .limit(1);
  return result ?? null;
}

/** Find customer by ID (for middleware / profile). */
export async function findById(id: string): Promise<Customer | null> {
  const [result] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  return result ?? null;
}

/** Find customer by Google ID. */
export async function findByGoogleId(googleId: string): Promise<Customer | null> {
  const [result] = await db
    .select()
    .from(customers)
    .where(eq(customers.googleId, googleId))
    .limit(1);
  return result ?? null;
}

// ─── Customer Creation ────────────────────────────────────

/** Create customer with email/password registration. */
export async function createCustomer(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}): Promise<Customer> {
  const id = crypto.randomUUID();
  const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  await db.insert(customers).values({
    id,
    email: data.email,
    password: hashedPassword,
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone ?? null,
    authProvider: "email",
  });

  const created = await findById(id);
  if (!created) {
    throw new Error("Failed to retrieve customer after insert");
  }
  return created;
}

/** Create customer from Google sign-in (no password). */
export async function createGoogleCustomer(data: {
  email: string;
  googleId: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
}): Promise<Customer> {
  const id = crypto.randomUUID();

  await db.insert(customers).values({
    id,
    email: data.email,
    password: null,
    firstName: data.firstName,
    lastName: data.lastName,
    googleId: data.googleId,
    profileImageUrl: data.profileImageUrl ?? null,
    authProvider: "google",
  });

  const created = await findById(id);
  if (!created) {
    throw new Error("Failed to retrieve customer after insert");
  }
  return created;
}

// ─── Customer Updates ─────────────────────────────────────

/** Link a Google account to an existing customer. */
export async function linkGoogleAccount(
  customerId: string,
  googleId: string,
  profileImageUrl?: string,
): Promise<void> {
  await db
    .update(customers)
    .set({
      googleId,
      profileImageUrl: profileImageUrl ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));
}

/** Update customer profile fields. Only provided fields are changed. */
export async function updateProfile(
  customerId: string,
  data: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    address: string;
    parish: string;
  }>,
): Promise<void> {
  await db
    .update(customers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(customers.id, customerId));
}

/** Set or change a customer's password. */
export async function setPassword(
  customerId: string,
  newPassword: string,
): Promise<void> {
  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db
    .update(customers)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(eq(customers.id, customerId));
}

// ─── Password Verification ────────────────────────────────

/** Verify plain password against stored hash. Returns false for Google-only accounts. */
export async function verifyPassword(
  customer: Customer,
  plainPassword: string,
): Promise<boolean> {
  if (!customer.password) {
    return false;
  }
  return bcrypt.compare(plainPassword, customer.password);
}

// ─── Refresh Token Management ─────────────────────────────

/** Hash a token for storage (SHA-256). */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Store a refresh token (hashed). */
export async function storeRefreshToken(
  customerId: string,
  rawToken: string,
  expiresAt: Date,
): Promise<void> {
  await db.insert(refreshTokens).values({
    id: crypto.randomUUID(),
    customerId,
    tokenHash: hashToken(rawToken),
    expiresAt,
  });
}

/** Find a refresh token by raw token (hashes it first for lookup). */
export async function findRefreshToken(
  rawToken: string,
): Promise<{ id: string; customerId: string; expiresAt: Date } | null> {
  const hash = hashToken(rawToken);
  const [result] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hash))
    .limit(1);
  return result ?? null;
}

/** Delete a specific refresh token (after rotation). */
export async function deleteRefreshToken(rawToken: string): Promise<void> {
  const hash = hashToken(rawToken);
  await db
    .delete(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hash));
}

/** Revoke ALL refresh tokens for a customer (password change / compromise). */
export async function revokeAllRefreshTokens(customerId: string): Promise<void> {
  await db
    .delete(refreshTokens)
    .where(eq(refreshTokens.customerId, customerId));
}
