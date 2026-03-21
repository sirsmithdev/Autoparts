/**
 * Register all route modules with Express app.
 */
import type { Express } from "express";
import authRoutes from "./auth.routes.js";
// Plan 2: these modules need middleware updates (isAuthenticated, requireStaff, req.jwtUser)
// import catalogRoutes from "./catalog.routes.js";
// import cartRoutes from "./cart.routes.js";
// import checkoutRoutes from "./checkout.routes.js";
// import ordersRoutes from "./orders.routes.js";
// import returnsRoutes from "./returns.routes.js";
// import adminRoutes from "./admin.routes.js";
import syncRoutes from "./sync.routes.js";

export function registerRoutes(app: Express): void {
  app.use(authRoutes);
  // Plan 2: re-enable once middleware exports are updated
  // app.use(catalogRoutes);
  // app.use(cartRoutes);
  // app.use(checkoutRoutes);
  // app.use(ordersRoutes);
  // app.use(returnsRoutes);
  // app.use(adminRoutes);
  app.use(syncRoutes);
}
