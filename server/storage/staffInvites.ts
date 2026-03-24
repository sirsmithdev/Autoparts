/**
 * Staff invite storage — create, find, accept, and list staff invitations.
 */

import { eq, and, desc } from "drizzle-orm";
import { db } from "../db.js";
import { staffInvites } from "../schema.js";
import crypto from "crypto";

import type { StaffInvite } from "../schema.js";

/** Create a new staff invite with a random 64-char token, expiring in 7 days. */
export async function createInvite(params: {
  email: string;
  role: string;
  invitedBy: string;
}): Promise<StaffInvite> {
  const id = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString("hex"); // 64-char hex string

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await db.insert(staffInvites).values({
    id,
    email: params.email,
    role: params.role as typeof staffInvites.role.enumValues[number],
    invitedBy: params.invitedBy,
    status: "pending",
    token,
    expiresAt,
  });

  const created = await findById(id);
  if (!created) {
    throw new Error("Failed to retrieve invite after insert");
  }
  return created;
}

/** Find invite by ID. */
async function findById(id: string): Promise<StaffInvite | null> {
  const [result] = await db
    .select()
    .from(staffInvites)
    .where(eq(staffInvites.id, id))
    .limit(1);
  return result ?? null;
}

/** Find a pending invite by email. */
export async function findPendingInviteByEmail(email: string): Promise<StaffInvite | null> {
  const [result] = await db
    .select()
    .from(staffInvites)
    .where(
      and(
        eq(staffInvites.email, email),
        eq(staffInvites.status, "pending"),
      ),
    )
    .limit(1);
  return result ?? null;
}

/** Find invite by token. Returns null if expired. */
export async function findInviteByToken(token: string): Promise<StaffInvite | null> {
  const [result] = await db
    .select()
    .from(staffInvites)
    .where(eq(staffInvites.token, token))
    .limit(1);

  if (!result) return null;

  // Check expiry
  if (result.expiresAt < new Date()) return null;

  return result;
}

/** Mark an invite as accepted. */
export async function acceptInvite(id: string): Promise<void> {
  await db
    .update(staffInvites)
    .set({ status: "accepted" })
    .where(eq(staffInvites.id, id));
}

/** List all invites ordered by createdAt desc. */
export async function listInvites(): Promise<StaffInvite[]> {
  return db
    .select()
    .from(staffInvites)
    .orderBy(desc(staffInvites.createdAt));
}
