/**
 * Parts-store authentication — customer-based JWT tokens with role support.
 * No database access here; just token creation, verification, and admin checks.
 */

import jwt from "jsonwebtoken";

const ACCESS_EXPIRY = "15m";
const REFRESH_EXPIRY = "7d";

export interface TokenPayload {
  customerId: string;
  email: string;
  isAdmin: boolean;
  role: string | null;
  type: "access" | "refresh" | "email_verify" | "password_reset";
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required.");
  }
  return secret;
}

/** Creates a short-lived access token for the given customer. */
export function generateAccessToken(customer: {
  id: string;
  email: string;
  isAdmin: boolean;
  role: string | null;
}): string {
  const payload: TokenPayload = {
    customerId: customer.id,
    email: customer.email,
    isAdmin: customer.isAdmin,
    role: customer.role,
    type: "access",
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_EXPIRY });
}

/** Creates a long-lived refresh token for the given customer. */
export function generateRefreshToken(customer: {
  id: string;
  email: string;
  isAdmin: boolean;
  role: string | null;
}): string {
  const payload: TokenPayload = {
    customerId: customer.id,
    email: customer.email,
    isAdmin: customer.isAdmin,
    role: customer.role,
    type: "refresh",
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: REFRESH_EXPIRY });
}

/** Decodes and verifies a token. Throws on invalid or expired tokens. */
export function verifyToken(token: string): TokenPayload {
  const payload = jwt.verify(token, getJwtSecret()) as TokenPayload;
  // Handle old tokens that don't have the role field
  if (payload.role === undefined) payload.role = null;
  return payload;
}

/** Creates a 24-hour email verification token. */
export function generateEmailVerifyToken(customer: {
  id: string;
  email: string;
}): string {
  const payload: TokenPayload = {
    customerId: customer.id,
    email: customer.email,
    isAdmin: false,
    role: null,
    type: "email_verify",
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "24h" });
}

/** Creates a 1-hour password reset token. */
export function generatePasswordResetToken(customer: {
  id: string;
  email: string;
}): string {
  const payload: TokenPayload = {
    customerId: customer.id,
    email: customer.email,
    isAdmin: false,
    role: null,
    type: "password_reset",
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "1h" });
}

/** Checks if the given email is in the STORE_ADMIN_EMAILS env var (comma-separated). */
export function isAdminEmail(email: string): boolean {
  const raw = process.env.STORE_ADMIN_EMAILS || "";
  const adminEmails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}
