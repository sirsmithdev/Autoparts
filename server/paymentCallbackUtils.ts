/**
 * PowerTranz payment callback utilities.
 * Copied from garage app — verifies HMAC signatures on payment gateway callbacks.
 */

import crypto from "crypto";
import type { Request } from "express";

/**
 * Verify HMAC signature on PowerTranz payment gateway callbacks.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyPowerTranzCallback(req: Request): boolean {
  const secret = process.env.POWERTRANZ_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "development") {
      console.warn("POWERTRANZ_WEBHOOK_SECRET not set — skipping verification (dev only)");
      return true;
    }
    console.error("POWERTRANZ_WEBHOOK_SECRET not set — rejecting callback");
    return false;
  }
  const signature = req.headers["x-signature"] || req.headers["x-powertranz-signature"];
  if (!signature || typeof signature !== "string") return false;
  try {
    const rawBody = (req as any).__rawBody as Buffer | undefined;
    const body = rawBody ?? Buffer.from(JSON.stringify(req.body));
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const sigBuf = Buffer.from(signature, "utf8");
    const expectedBuf = Buffer.from(expected, "utf8");
    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Escape HTML to prevent XSS in callback response pages.
 */
export function escapeHtmlSafe(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
