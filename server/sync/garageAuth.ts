/**
 * Garage auth client — verifies 316 Automotive credentials against the garage API.
 *
 * The garage app exposes POST /api/auth/verify-credentials which accepts
 * { email, password } and returns { valid, user } if the credentials are correct.
 *
 * Never throws. Returns { success, user?, error? } so the auth route can
 * handle all outcomes gracefully.
 */

export interface GarageUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

interface GarageAuthResult {
  success: boolean;
  user?: GarageUser;
  error?: string;
}

/**
 * Verify email/password against the 316 Automotive garage app.
 */
export async function verifyGarageCredentials(
  email: string,
  password: string,
): Promise<GarageAuthResult> {
  try {
    const authUrl = process.env.GARAGE_AUTH_URL;
    const syncApiKey = process.env.GARAGE_SYNC_API_KEY;

    if (!authUrl) {
      return { success: false, error: "GARAGE_AUTH_URL not configured" };
    }

    if (!syncApiKey) {
      return { success: false, error: "GARAGE_SYNC_API_KEY not configured" };
    }

    const response = await fetch(authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-api-key": syncApiKey,
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: "Invalid 316 Automotive credentials" };
      }
      let errorBody = "";
      try {
        const body = (await response.json()) as { message?: string };
        errorBody = body.message || JSON.stringify(body);
      } catch {
        errorBody = `HTTP ${response.status} ${response.statusText}`;
      }
      return { success: false, error: `Garage auth error: ${errorBody}` };
    }

    const data = (await response.json()) as {
      valid: boolean;
      user?: GarageUser;
    };

    if (!data.valid || !data.user) {
      return { success: false, error: "Invalid 316 Automotive credentials" };
    }

    return { success: true, user: data.user };
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return { success: false, error: "316 Automotive service timed out" };
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: msg };
  }
}
