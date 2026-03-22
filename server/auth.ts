/**
 * Parts-store authentication — customer-based JWT tokens.
 * No database access here; just token creation, verification, and admin checks.
 */

import jwt from "jsonwebtoken";

const ACCESS_EXPIRY = "15m";
const REFRESH_EXPIRY = "7d";

export interface TokenPayload {
  customerId: string;
  email: string;
  isAdmin: boolean;
  type: "access" | "refresh" | "email_verify";
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
}): string {
  const payload: TokenPayload = {
    customerId: customer.id,
    email: customer.email,
    isAdmin: customer.isAdmin,
    type: "access",
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_EXPIRY });
}

/** Creates a long-lived refresh token for the given customer. */
export function generateRefreshToken(customer: {
  id: string;
  email: string;
  isAdmin: boolean;
}): string {
  const payload: TokenPayload = {
    customerId: customer.id,
    email: customer.email,
    isAdmin: customer.isAdmin,
    type: "refresh",
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: REFRESH_EXPIRY });
}

/** Decodes and verifies a token. Throws on invalid or expired tokens. */
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, getJwtSecret()) as TokenPayload;
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
    type: "email_verify",
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "24h" });
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
