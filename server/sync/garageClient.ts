/**
 * Outbound HTTP client — sends stock change notifications to the garage app.
 *
 * Never throws. Always returns { success, error? } so the queue processor
 * can decide whether to retry or mark as failed.
 */

interface SyncResult {
  success: boolean;
  error?: string;
}

/**
 * Notify the garage app that stock was sold online (decrement their inventory).
 */
export async function sendStockDecrement(data: {
  garagePartId: string;
  quantity: number;
  orderId: string;
  orderNumber: string;
}): Promise<SyncResult> {
  return postToGarage("/stock-decrement", data);
}

/**
 * Notify the garage app that stock was returned/cancelled (restore their inventory).
 */
export async function sendStockRestore(data: {
  garagePartId: string;
  quantity: number;
  orderId: string;
  reason: string;
}): Promise<SyncResult> {
  return postToGarage("/stock-restore", data);
}

/**
 * Generic POST to the garage sync API. Handles all error cases without throwing.
 */
async function postToGarage(
  endpoint: string,
  payload: object,
): Promise<SyncResult> {
  try {
    const syncUrl = process.env.GARAGE_SYNC_URL;
    const syncApiKey = process.env.GARAGE_SYNC_API_KEY;

    if (!syncUrl) {
      return { success: false, error: "GARAGE_SYNC_URL not configured" };
    }

    if (!syncApiKey) {
      return { success: false, error: "GARAGE_SYNC_API_KEY not configured" };
    }

    const url = `${syncUrl}${endpoint}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-api-key": syncApiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      return { success: true };
    }

    // Non-200 response — extract error message if possible
    let errorBody = "";
    try {
      const body = await response.json() as { message?: string };
      errorBody = body.message || JSON.stringify(body);
    } catch {
      errorBody = `HTTP ${response.status} ${response.statusText}`;
    }

    return { success: false, error: `Garage API error: ${errorBody}` };
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return { success: false, error: "Request timed out (10s)" };
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: msg };
  }
}
