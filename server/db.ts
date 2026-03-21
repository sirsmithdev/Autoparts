import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema.js";
import fs from "fs";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

let url: URL;
try {
  url = new URL(process.env.DATABASE_URL);
} catch {
  throw new Error(
    `DATABASE_URL is not a valid URL (length=${process.env.DATABASE_URL.length}, starts with "${process.env.DATABASE_URL.slice(0, 8)}...") — check that the managed database binding resolved correctly.`,
  );
}

// Strip SSL params from URL to prevent insecure overrides
url.searchParams.delete("sslmode");
url.searchParams.delete("ssl");
url.searchParams.delete("rejectUnauthorized");

// Build SSL config: use CA certificate if available, otherwise rejectUnauthorized defaults to true
const caCertPath =
  process.env.DB_CA_CERT_PATH || path.resolve(process.cwd(), "ca-certificate.crt");
const caCert = fs.existsSync(caCertPath) ? fs.readFileSync(caCertPath) : undefined;

const sslConfig: mysql.SslOptions = caCert
  ? { ca: caCert }
  : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" };

const poolConfig: mysql.PoolOptions = {
  host: url.hostname,
  port: parseInt(url.port, 10) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: sslConfig,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_POOL_SIZE || "10", 10),
  queueLimit: 50,
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
};

export const pool = mysql.createPool(poolConfig);
export const db = drizzle(pool, { schema, mode: "default" });
