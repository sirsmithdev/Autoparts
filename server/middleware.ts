/**
 * Parts-store Express middleware for customer JWT auth, admin checks,
 * and sync API key validation.
 */

import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "./auth.js";

// Extend Express Request to include customer info from JWT
declare global {
  namespace Express {
    interface Request {
      customer?: {
        customerId: string;
        email: string;
        isAdmin: boolean;
      };
    }
  }
}

/**
 * Extracts JWT from "Authorization: Bearer <token>" header,
 * verifies it, and attaches { customerId, email, isAdmin } to req.customer.
 * Returns 401 if token is missing, invalid, or expired.
 */
export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.customer = {
      customerId: payload.customerId,
      email: payload.email,
      isAdmin: payload.isAdmin,
    };
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

/**
 * Same as authenticateToken but never fails.
 * Sets req.customer if a valid token is present, otherwise leaves it undefined.
 * Always calls next() — useful for optional auth on catalog endpoints.
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      const payload = verifyToken(token);
      req.customer = {
        customerId: payload.customerId,
        email: payload.email,
        isAdmin: payload.isAdmin,
      };
    }
  } catch {
    // Swallow errors — optional auth should never block the request
  }
  next();
}

/**
 * Requires req.customer.isAdmin to be true. Must be used after authenticateToken.
 * Returns 403 if the current customer is not an admin.
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.customer?.isAdmin !== true) {
    res.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
}

/**
 * Validates the x-sync-api-key header against process.env.SYNC_API_KEY.
 * Returns 401 if the key is missing or does not match.
 */
export function validateSyncApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expected = process.env.SYNC_API_KEY;
  const provided = req.headers["x-sync-api-key"] as string | undefined;

  if (!expected || !provided || provided !== expected) {
    res.status(401).json({ message: "Invalid or missing sync API key" });
    return;
  }
  next();
}
