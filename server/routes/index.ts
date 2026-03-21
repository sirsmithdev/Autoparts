/**
 * Register all route modules with Express app.
 */
import type { Express } from "express";
import authRoutes from "./auth.routes.js";
import syncRoutes from "./sync.routes.js";
import catalogRoutes from "./catalog.routes.js";
import cartRoutes from "./cart.routes.js";
import checkoutRoutes from "./checkout.routes.js";
import ordersRoutes from "./orders.routes.js";
import adminRoutes from "./admin.routes.js";

export function registerRoutes(app: Express): void {
  app.use(authRoutes);
  app.use(syncRoutes);
  app.use(catalogRoutes);
  app.use(cartRoutes);
  app.use(checkoutRoutes);
  app.use(ordersRoutes);
  app.use(adminRoutes);
}
