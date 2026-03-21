#!/usr/bin/env node
/**
 * Run Drizzle migrations against the parts store database.
 * Used by CI/CD pipeline before deployment.
 */
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL must be set");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const connection = await mysql.createConnection({
    uri: url,
    ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" },
  });

  const db = drizzle(connection);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./migrations" });

  console.log("Migrations complete.");
  await connection.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
