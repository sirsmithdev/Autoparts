/**
 * Parts-store Express server entry point.
 * In production: serves both API routes and Next.js pages in a single process.
 * In development: serves only API routes (Next.js dev server runs separately).
 */

import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { registerRoutes } from "./routes/index.js";
import { cleanupStaleCarts } from "./storage/cart.js";
import { cleanupExpiredPendingOrders } from "./storage/orders.js";
import { startQueueProcessor } from "./sync/queueProcessor.js";

const app = express();
const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || process.env.PARTS_STORE_API_PORT || "5002", 10);

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// Middleware
app.use(cors({
  origin: dev
    ? ["http://localhost:3001", "http://localhost:5001"]
    : [process.env.BASE_URL || "https://316-automotive.com"],
  credentials: true,
}));

// Capture raw body for payment callback HMAC verification
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.__rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "parts-store" });
});

// Register API routes
registerRoutes(app);

// Global error handler — catches unhandled route errors
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[parts-store] Unhandled route error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// Cron jobs — cleanup stale carts and expired pending orders
function startCronJobs() {
  // Every 15 minutes: cancel pending_payment orders older than 30 minutes
  setInterval(async () => {
    try {
      const cancelled = await cleanupExpiredPendingOrders();
      if (cancelled > 0) console.log(`[cron] Cleaned up ${cancelled} expired pending orders`);
    } catch (error) {
      console.error("[cron] Error cleaning up expired orders:", error);
    }
  }, 15 * 60 * 1000);

  // Every 24 hours: remove stale shopping carts
  setInterval(async () => {
    try {
      const removed = await cleanupStaleCarts();
      if (removed > 0) console.log(`[cron] Cleaned up ${removed} stale carts`);
    } catch (error) {
      console.error("[cron] Error cleaning up stale carts:", error);
    }
  }, 24 * 60 * 60 * 1000);

  // Every 30 seconds: process outbound sync queue (stock changes → garage app)
  startQueueProcessor(30_000);

  console.log("[cron] Scheduled: expired order cleanup (15m), stale cart cleanup (24h), sync queue processor (30s)");
}

// Process-level error handlers
process.on("unhandledRejection", (reason) => {
  console.error("[parts-store] Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[parts-store] Uncaught exception:", error);
  process.exit(1);
});

async function start() {
  if (!dev) {
    // Production: serve Next.js pages via custom server
    try {
      // @ts-ignore - next types are in the client package, not the server
      const next = (await import("next")).default;
      const nextApp = next({ dev: false, dir: "./client", conf: { basePath: "/parts" } });
      const handle = nextApp.getRequestHandler();

      await nextApp.prepare();

      // Next.js handles all /parts/* page routes
      app.all("/parts/*", (req, res) => handle(req, res));
      app.all("/parts", (req, res) => handle(req, res));

      console.log(`Parts store (production): Next.js pages served at /parts`);
    } catch (error) {
      console.error("Failed to initialize Next.js:", error);
      // Continue without Next.js — API still works (useful for API-only deployments)
    }
  }

  // Start cron jobs
  startCronJobs();

  app.listen(port, () => {
    console.log(`Parts store server listening on port ${port} (${dev ? "development" : "production"})`);
  });
}

start().catch((error) => {
  console.error("Failed to start parts-store server:", error);
  process.exit(1);
});
