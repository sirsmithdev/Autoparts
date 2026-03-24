/**
 * Tradesoft Parts Index API client with Redis caching.
 *
 * All API responses are cached in the shared Valkey instance to reduce
 * expensive external API calls. Cache is transparent — misses fall through
 * to the live API, hits return instantly from Redis.
 *
 * API docs: https://api.parts-index.com/docs/
 * Auth: Authorization header with API key
 * IP whitelist: calls must come from whitelisted server IPs
 */

import { cacheGet, cacheSet } from "../cache/redis.js";

const API_BASE = "https://api.parts-index.com/v1";

// TTLs in seconds
const TTL = {
  CAR_BRANDS: 90 * 24 * 3600,   // 90 days — brands never change
  CAR_MODELS: 90 * 24 * 3600,   // 90 days — models never change
  VIN_DECODE: 30 * 24 * 3600,   // 30 days — VIN is permanent
  BRANDS_BY_CODE: 7 * 24 * 3600, // 7 days
  PART_INFO: 7 * 24 * 3600,      // 7 days
  RELATIONS: 7 * 24 * 3600,      // 7 days
  FITMENT: 14 * 24 * 3600,       // 14 days
  VIN_PARTS: 24 * 3600,          // 24 hours — most volatile
};

function getApiKey(): string {
  const key = process.env.PARTS_INDEX_API_KEY;
  if (!key) throw new Error("PARTS_INDEX_API_KEY not configured");
  return key;
}

async function piGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: getApiKey(),
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (response.status === 204) return { list: [] } as T;

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let msg = `HTTP ${response.status}`;
    try { msg = JSON.parse(body)?.message || msg; } catch {}
    throw new Error(`PartsIndex API error: ${msg}`);
  }

  return response.json() as Promise<T>;
}

/** Cache-aware wrapper: check cache → call API on miss → store result */
async function cached<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const result = await fetcher();
  cacheSet(key, result, ttl).catch(() => {}); // fire-and-forget
  return result;
}

// ─── Types ────────────────────────────────────────────────

export interface PIBrand {
  id: string;
  name: string;
}

export interface PIEntity {
  id: string;
  name: { id: string; name: string };
  originalName: string;
  code: string;
  barcodes: string[];
  brand: PIBrand;
  groups: {
    main: Array<{ id: string; name: string; level: number }>;
    additional: Array<Array<{ id: string; name: string; level: number }>>;
  };
  description: string;
  parameters: Array<{
    id: string;
    name: string;
    params: Array<{
      id: string;
      title: string;
      type: string;
      values: Array<{ id: string; value: string }>;
    }>;
  }>;
  images: string[];
  links: Array<{
    partId: string;
    code: string;
    brand: PIBrand;
    parameters?: Array<{ id: string; name: string; unit: string; value: string }>;
  }>;
}

export interface PIRelation {
  id: string;
  code: string;
  brand: PIBrand;
  name?: { id: string; name: string };
  direction: string;
}

export interface PICarApply {
  id: string;
  brand: string;
  model: string;
  generation: string;
  engine: string;
  yearFrom: number;
  yearTo: number;
}

export interface PICarBrand {
  id: string;
  name: string;
}

export interface PICarModel {
  id: string;
  name: string;
  brand: PICarBrand;
}

export interface PIVinCar {
  id: string;
  brand: string;
  model: string;
  generation: string;
  engine: string;
  year: number;
  bodyType: string;
}

export interface PIVinResult {
  id: string;
  code: string;
  name: string;
  brand: PIBrand;
  quantity: number;
  group: string;
}

// ─── VIN Decode (cached 30 days) ──────────────────────────

export async function vinDecodeCars(vin: string): Promise<PIVinCar[]> {
  return cached(`vin:${vin}`, TTL.VIN_DECODE, async () => {
    const result = await piGet<{ list: PIVinCar[] }>("/parts-by-vin/cars", { vin });
    return result.list || [];
  });
}

export async function vinCarParts(carId: string, params?: {
  group?: string;
  query?: string;
  page?: string;
  perPage?: string;
}): Promise<{ list: PIVinResult[]; pagination?: { total: number; page: number; perPage: number } }> {
  const key = `vin-parts:${carId}:${params?.group || ""}:${params?.query || ""}:${params?.page || "1"}`;
  return cached(key, TTL.VIN_PARTS, () =>
    piGet("/parts-by-vin/cars/" + carId + "/results", params as Record<string, string>),
  );
}

// ─── Brand Lookup (cached 7 days) ─────────────────────────

export async function brandsByPartCode(code: string): Promise<PIBrand[]> {
  return cached(`brands-by-code:${code}`, TTL.BRANDS_BY_CODE, async () => {
    const result = await piGet<{ list: PIBrand[] }>("/brands/by-part-code", { code });
    return result.list || [];
  });
}

export async function brandsParse(query: string): Promise<PIBrand[]> {
  return cached(`brands-parse:${query}`, TTL.BRANDS_BY_CODE, async () => {
    const result = await piGet<{ list: PIBrand[] }>("/brands/parse", { query });
    return result.list || [];
  });
}

// ─── Part Info (cached 7 days) ────────────────────────────

export async function getPartInfo(code: string, brandId: string): Promise<PIEntity[]> {
  return cached(`entity:${code}:${brandId}`, TTL.PART_INFO, async () => {
    const result = await piGet<{ list: PIEntity[] }>("/entities", { code, brandId });
    return result.list || [];
  });
}

// ─── Cross-References (cached 7 days) ─────────────────────

export async function getPartRelations(code: string, brandId: string): Promise<PIRelation[]> {
  return cached(`relations:${code}:${brandId}`, TTL.RELATIONS, async () => {
    const result = await piGet<{ list: PIRelation[] }>("/relations", { code, brandId });
    return result.list || [];
  });
}

// ─── Vehicle Fitment (cached 14 days) ─────────────────────

export async function getPartFitment(code: string, brandId: string): Promise<PICarApply[]> {
  return cached(`fitment:${code}:${brandId}`, TTL.FITMENT, async () => {
    const result = await piGet<{ list: PICarApply[] }>("/cars", { code, brandId });
    return result.list || [];
  });
}

// ─── Car Hierarchy (cached 90 days) ───────────────────────

export async function getCarBrands(query?: string): Promise<PICarBrand[]> {
  return cached(`car-brands:${query || "all"}`, TTL.CAR_BRANDS, async () => {
    const result = await piGet<{ list: PICarBrand[] }>("/car/brands", query ? { query } : undefined);
    return result.list || [];
  });
}

export async function getCarModels(brandId: string): Promise<PICarModel[]> {
  return cached(`car-models:${brandId}`, TTL.CAR_MODELS, async () => {
    const result = await piGet<{ list: PICarModel[] }>(`/car/brands/${brandId}/models`);
    return result.list || [];
  });
}

// ─── Convenience Wrappers ─────────────────────────────────

export async function enrichPartData(code: string, brandId?: string): Promise<{
  brands: PIBrand[];
  entity: PIEntity | null;
  crossReferences: PIRelation[];
  fitment: PICarApply[];
  images: string[];
}> {
  const brands = await brandsByPartCode(code);
  if (brands.length === 0) {
    return { brands: [], entity: null, crossReferences: [], fitment: [], images: [] };
  }

  const targetBrandId = brandId || brands[0].id;

  const [entities, crossReferences, fitment] = await Promise.all([
    getPartInfo(code, targetBrandId).catch(() => [] as PIEntity[]),
    getPartRelations(code, targetBrandId).catch(() => [] as PIRelation[]),
    getPartFitment(code, targetBrandId).catch(() => [] as PICarApply[]),
  ]);

  const entity = entities[0] || null;
  const images = entity?.images || [];

  return { brands, entity, crossReferences, fitment, images };
}
