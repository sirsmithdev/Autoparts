import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./server/schema.ts",
  dialect: "mysql",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
