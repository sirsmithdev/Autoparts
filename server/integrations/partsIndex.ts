/**
 * Tradesoft Parts Index API client.
 *
 * Provides access to:
 * - VIN decode (find car by VIN, get parts for that car)
 * - Part info (full details, images, parameters, barcodes)
 * - Brand lookup (which brands make a part number)
 * - Cross-references / analogs (OEM ↔ aftermarket)
 * - Vehicle fitment (which cars a part fits)
 * - Car hierarchy (brands → models → generations → engines)
 *
 * API docs: https://api.parts-index.com/docs/
 * Auth: Authorization header with API key
 * IP whitelist: calls must come from whitelisted server IPs
 */

const API_BASE = "https://api.parts-index.com/v1";

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
    const msg = body ? JSON.parse(body)?.message : `HTTP ${response.status}`;
    throw new Error(`PartsIndex API error: ${msg}`);
  }

  return response.json() as Promise<T>;
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

// ─── VIN Decode ───────────────────────────────────────────

/** Decode a VIN to find matching car(s). */
export async function vinDecodeCars(vin: string): Promise<PIVinCar[]> {
  const result = await piGet<{ list: PIVinCar[] }>("/parts-by-vin/cars", { vin });
  return result.list || [];
}

/** Get parts for a VIN-decoded car. */
export async function vinCarParts(carId: string, params?: {
  group?: string;
  query?: string;
  page?: string;
  perPage?: string;
}): Promise<{ list: PIVinResult[]; pagination?: { total: number; page: number; perPage: number } }> {
  return piGet("/parts-by-vin/cars/" + carId + "/results", params as Record<string, string>);
}

// ─── Brand Lookup ─────────────────────────────────────────

/** Find brands that manufacture a given part code. */
export async function brandsByPartCode(code: string): Promise<PIBrand[]> {
  const result = await piGet<{ list: PIBrand[] }>("/brands/by-part-code", { code });
  return result.list || [];
}

/** Parse/normalize a brand name, get synonyms. */
export async function brandsParse(query: string): Promise<PIBrand[]> {
  const result = await piGet<{ list: PIBrand[] }>("/brands/parse", { query });
  return result.list || [];
}

// ─── Part Info (Entities) ─────────────────────────────────

/** Get full part details by part code and brand ID. */
export async function getPartInfo(code: string, brandId: string): Promise<PIEntity[]> {
  const result = await piGet<{ list: PIEntity[] }>("/entities", { code, brandId });
  return result.list || [];
}

// ─── Cross-References / Analogs ───────────────────────────

/**
 * Get cross-references for a part (OEM ↔ aftermarket).
 * Returns analog parts from other brands.
 */
export async function getPartRelations(code: string, brandId: string): Promise<PIRelation[]> {
  const result = await piGet<{ list: PIRelation[] }>("/relations", { code, brandId });
  return result.list || [];
}

// ─── Vehicle Fitment ──────────────────────────────────────

/** Find which cars a part fits. */
export async function getPartFitment(code: string, brandId: string): Promise<PICarApply[]> {
  const result = await piGet<{ list: PICarApply[] }>("/cars", { code, brandId });
  return result.list || [];
}

// ─── Car Hierarchy ────────────────────────────────────────

/** Get all car brands. */
export async function getCarBrands(query?: string): Promise<PICarBrand[]> {
  const result = await piGet<{ list: PICarBrand[] }>("/car/brands", query ? { query } : undefined);
  return result.list || [];
}

/** Get models for a car brand. */
export async function getCarModels(brandId: string): Promise<PICarModel[]> {
  const result = await piGet<{ list: PICarModel[] }>(`/car/brands/${brandId}/models`);
  return result.list || [];
}

// ─── Convenience Wrappers ─────────────────────────────────

/**
 * Full part enrichment: given a part code, get all available data.
 * 1. Find brands for the code
 * 2. Get full entity info from the first (or specified) brand
 * 3. Get cross-references
 * 4. Get vehicle fitment
 */
export async function enrichPartData(code: string, brandId?: string): Promise<{
  brands: PIBrand[];
  entity: PIEntity | null;
  crossReferences: PIRelation[];
  fitment: PICarApply[];
  images: string[];
}> {
  // Step 1: find brands
  const brands = await brandsByPartCode(code);
  if (brands.length === 0) {
    return { brands: [], entity: null, crossReferences: [], fitment: [], images: [] };
  }

  const targetBrandId = brandId || brands[0].id;

  // Step 2-4: parallel fetch
  const [entities, crossReferences, fitment] = await Promise.all([
    getPartInfo(code, targetBrandId).catch(() => [] as PIEntity[]),
    getPartRelations(code, targetBrandId).catch(() => [] as PIRelation[]),
    getPartFitment(code, targetBrandId).catch(() => [] as PICarApply[]),
  ]);

  const entity = entities[0] || null;
  const images = entity?.images || [];

  return { brands, entity, crossReferences, fitment, images };
}
