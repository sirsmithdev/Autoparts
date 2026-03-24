/**
 * Redis/Valkey cache for Parts Index API responses.
 *
 * Connects to the shared garage-316-redis Valkey instance.
 * All keys prefixed with "parts:pi:" to avoid collisions with the garage app.
 * Graceful fallback — cache misses on Redis errors, never crashes the app.
 */

import Redis from "ioredis";

const PREFIX = "parts:pi:";

let redis: Redis | null = null;
let connected = false;

/** Initialize Redis connection. Call once on server startup. */
export function initRedisCache(): void {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn("[cache] REDIS_URL not set — Parts Index caching disabled");
    return;
  }

  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 500, 3000);
      },
      tls: url.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
      lazyConnect: false,
    });

    redis.on("connect", () => {
      connected = true;
      console.log("[cache] Redis connected — Parts Index caching enabled");
    });

    redis.on("error", (err) => {
      if (connected) {
        console.warn("[cache] Redis error:", err.message);
      }
      connected = false;
    });

    redis.on("close", () => {
      connected = false;
    });
  } catch (err) {
    console.warn("[cache] Failed to initialize Redis:", err);
  }
}

/** Check if cache is available. */
export function isCacheAvailable(): boolean {
  return connected && redis !== null;
}

/**
 * Get a cached value by key.
 * Returns null on cache miss or Redis error (never throws).
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis || !connected) return null;
  try {
    const raw = await redis.get(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Set a cached value with TTL in seconds.
 * Silently fails on Redis error (never throws).
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!redis || !connected) return;
  try {
    await redis.setex(PREFIX + key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Silently ignore cache write failures
  }
}

/**
 * Delete a cached key.
 */
export async function cacheDel(key: string): Promise<void> {
  if (!redis || !connected) return;
  try {
    await redis.del(PREFIX + key);
  } catch {
    // Silently ignore
  }
}

/**
 * Get cache stats (for monitoring).
 */
export async function cacheStats(): Promise<{ connected: boolean; keyCount: number }> {
  if (!redis || !connected) return { connected: false, keyCount: 0 };
  try {
    const keys = await redis.keys(PREFIX + "*");
    return { connected: true, keyCount: keys.length };
  } catch {
    return { connected: false, keyCount: 0 };
  }
}
