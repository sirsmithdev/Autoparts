/**
 * NCB Card Verification Service
 *
 * Handles card registration and verification using the JNCB verification account.
 * Implements the NCB e-commerce card registration SOP.
 *
 * Process (SPI 3DS):
 * 1. Customer enters card details on our form
 * 2. SPI /Api/spi/Sale with card Source + ThreeDSecure=true (JNCB credentials)
 * 3. Handle 3DS (SP4 → RedirectData iframe)
 * 4. Customer checks bank statement for exact amount
 * 5. Amount matches -> void charge via FPI /api/void
 * 6. Tokenize card via FPI /api/riskmgmt -> get PanToken
 *
 * Uses PowerTranz JNCB Verification Account:
 * - Env vars: POWERTRANZ_VERIFY_ID, POWERTRANZ_VERIFY_PASSWORD
 * - Purpose: Card verification without actual charges
 */

import crypto from "crypto";

// ─── Configuration ──────────────────────────────────────────────────

function getVerifyConfig() {
  const merchantId = process.env.POWERTRANZ_VERIFY_ID || "";
  const merchantPassword = process.env.POWERTRANZ_VERIFY_PASSWORD || "";
  const testMode = process.env.POWERTRANZ_TEST_MODE === "true";
  const productionUrl = process.env.POWERTRANZ_PRODUCTION_URL || "https://ptranz.com/Api/spi";
  const testUrl = process.env.POWERTRANZ_TEST_URL || "https://staging.ptranz.com/Api/spi";
  const enabled = !!(merchantId && merchantPassword);

  return { merchantId, merchantPassword, testMode, productionUrl, testUrl, enabled };
}

function getApiUrl(): string {
  const config = getVerifyConfig();
  return config.testMode ? config.testUrl : config.productionUrl;
}

function getFpiApiUrl(): string {
  try {
    const spiUrl = getApiUrl();
    const { origin } = new URL(spiUrl);
    return `${origin}/api`;
  } catch {
    const config = getVerifyConfig();
    return config.testMode
      ? "https://staging.ptranz.com/api"
      : "https://ptranz.com/api";
  }
}

/** Headers with JNCB verification account credentials */
function getVerifyHeaders(): Record<string, string> {
  const config = getVerifyConfig();
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "PowerTranz-PowerTranzId": config.merchantId,
    "PowerTranz-PowerTranzPassword": config.merchantPassword,
  };
}

/** ISO 4217 numeric currency code lookup */
function getCurrencyCode(currency: string): string {
  const currencyCodes: Record<string, string> = {
    "USD": "840",
    "JMD": "388",
    "TTD": "780",
    "BBD": "052",
    "XCD": "951",
  };
  return currencyCodes[currency.toUpperCase()] || "840";
}

// ─── Interfaces ─────────────────────────────────────────────────────

export interface CardDetails {
  cardNumber: string;
  cardExpMonth: number;
  cardExpYear: number;
  cvv: string;
  cardholderName: string;
}

export interface BillingDetails {
  billingName: string;
  billingEmail?: string;
  billingPhone?: string;
}

export interface VerificationResult {
  success: boolean;
  transactionId: string;
  spiToken?: string;
  redirectData?: string;
  amount: string;
  currency: string;
  error?: string;
}

// ─── Utility Functions ──────────────────────────────────────────────

/**
 * Generate a random verification amount between $1.01 and $4.99.
 * Amount MUST have cents (non-whole number) per NCB requirements.
 */
export function generateRandomAmount(): string {
  const minCents = 101; // $1.01
  const maxCents = 499; // $4.99
  let randomCents = crypto.randomInt(minCents, maxCents + 1);

  // Ensure non-whole dollar amount (must have cents per NCB SOP)
  if (randomCents % 100 === 0) {
    randomCents += crypto.randomInt(1, 100);
  }

  return (randomCents / 100).toFixed(2);
}

/**
 * Detect card brand from card number using standard BIN patterns.
 */
export function detectCardBrand(cardNumber: string): string {
  const cleaned = cardNumber.replace(/\s/g, "");

  if (/^4/.test(cleaned)) return "visa";
  if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) return "mastercard";
  if (/^3[47]/.test(cleaned)) return "amex";
  if (/^6(?:011|5|4[4-9]|22(?:1(?:2[6-9]|[3-9])|[2-8]|9(?:[01]|2[0-5])))/.test(cleaned)) return "discover";
  if (/^35/.test(cleaned)) return "jcb";
  if (/^3[68]/.test(cleaned)) return "diners";

  return "unknown";
}

/**
 * Extract first 4 and last 4 digits from card number (PCI compliant display).
 */
export function extractCardDigits(cardNumber: string): { first4: string; last4: string } {
  const cleaned = cardNumber.replace(/\s/g, "");
  return {
    first4: cleaned.substring(0, 4),
    last4: cleaned.substring(cleaned.length - 4),
  };
}

/**
 * Encrypt card details for temporary storage during verification flow.
 * Uses AES-256-GCM with JWT_SECRET as key material.
 * Card data is only stored until tokenization (after verification succeeds).
 */
export function encryptCardData(cardDetails: CardDetails): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET must be set for card data encryption");
  }
  const salt = Buffer.from("ncb-card-verification-v1", "utf8");
  const key = Buffer.from(crypto.hkdfSync("sha256", secret, salt, "card-encryption", 32));
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(cardDetails);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Decrypt card details for tokenization after verification succeeds.
 */
export function decryptCardData(encrypted: string): CardDetails {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET must be set for card data decryption");
  }
  const salt = Buffer.from("ncb-card-verification-v1", "utf8");
  const key = Buffer.from(crypto.hkdfSync("sha256", secret, salt, "card-encryption", 32));
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}

// ─── Core Verification Functions ────────────────────────────────────

/**
 * Charge a verification amount via SPI /Api/spi/Sale with 3DS.
 * Uses JNCB verification account credentials.
 * Returns SpiToken + RedirectData (HTML for 3DS iframe).
 */
export async function chargeVerificationAmount(params: {
  cardDetails: CardDetails;
  billingDetails?: BillingDetails;
  amount: string;
  currency: string;
  transactionId: string;
  responseUrl: string;
}): Promise<VerificationResult> {
  const config = getVerifyConfig();
  if (!config.enabled) {
    return {
      success: false,
      transactionId: params.transactionId,
      amount: params.amount,
      currency: params.currency,
      error: "Card verification is not configured (missing POWERTRANZ_VERIFY_ID/PASSWORD)",
    };
  }

  const { cardDetails, billingDetails, amount, currency, transactionId, responseUrl } = params;
  const cleanedCard = cardDetails.cardNumber.replace(/\s/g, "");
  const expiration = `${cardDetails.cardExpYear.toString().slice(-2)}${cardDetails.cardExpMonth.toString().padStart(2, "0")}`;
  const apiUrl = getApiUrl();

  const requestBody = {
    TransactionIdentifier: transactionId,
    TotalAmount: parseFloat(amount),
    CurrencyCode: getCurrencyCode(currency),
    ThreeDSecure: true,
    Source: {
      CardPan: cleanedCard,
      CardCvv: cardDetails.cvv,
      CardExpiration: expiration,
      CardholderName: cardDetails.cardholderName,
    },
    OrderIdentifier: `VERIFY-${transactionId.substring(0, 8)}`,
    BillingAddress: {
      FirstName: billingDetails?.billingName?.split(" ")[0] || "",
      LastName: billingDetails?.billingName?.split(" ").slice(1).join(" ") || "",
      ...(billingDetails?.billingEmail ? { EmailAddress: billingDetails.billingEmail } : {}),
      ...(billingDetails?.billingPhone ? { PhoneNumber: billingDetails.billingPhone } : {}),
    },
    AddressMatch: false,
    ExtendedData: {
      ThreeDSecure: {
        ChallengeWindowSize: 4,
        ChallengeIndicator: "03",
      },
      MerchantResponseUrl: responseUrl,
    },
  };

  try {
    console.log("[ncb-verify] Charging verification amount via SPI Sale", {
      transactionId,
      amount,
      currency,
      cardPanPrefix: cleanedCard.substring(0, 6),
    });

    const response = await fetch(`${apiUrl}/Sale`, {
      method: "POST",
      headers: getVerifyHeaders(),
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await response.text();
    console.log("[ncb-verify] SPI Sale response", {
      status: response.status,
      responseBody: responseText.substring(0, 500),
    });

    if (!response.ok) {
      return {
        success: false,
        transactionId,
        amount,
        currency,
        error: `Gateway error: HTTP ${response.status}`,
      };
    }

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(responseText);
    } catch {
      return { success: false, transactionId, amount, currency, error: "Invalid gateway response" };
    }

    const iso = result.IsoResponseCode as string;
    console.log("[ncb-verify] SPI Sale result", {
      isoResponseCode: iso,
      approved: result.Approved,
      hasRedirectData: !!result.RedirectData,
      hasSpiToken: !!result.SpiToken,
    });

    // SP4 = SPI Preprocessing complete (RedirectData has 3DS HTML for iframe)
    // 3D0 = Frictionless (3DS complete)
    // 00 = Approved directly
    if (iso === "SP4" || iso === "3D0" || iso === "3D5" || iso === "3D6" || iso === "00") {
      return {
        success: true,
        transactionId,
        spiToken: result.SpiToken as string,
        redirectData: result.RedirectData as string | undefined,
        amount,
        currency,
      };
    }

    return {
      success: false,
      transactionId,
      amount,
      currency,
      error: (result.ResponseMessage as string) || `Verification failed with code: ${iso}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[ncb-verify] Verification charge failed", { error: msg });
    return {
      success: false,
      transactionId,
      amount,
      currency,
      error: `Verification charge failed: ${msg}`,
    };
  }
}

/**
 * Void the verification charge after customer confirms the amount.
 * Per NCB requirements: ALWAYS void the verification charge.
 * Uses FPI /api/void with JNCB verification account credentials.
 */
export async function voidVerificationCharge(
  transactionId: string,
  amount: string,
  currency: string,
): Promise<{ success: boolean; error?: string }> {
  const config = getVerifyConfig();
  if (!config.enabled) {
    return { success: false, error: "Card verification is not configured" };
  }

  const apiUrl = getFpiApiUrl();

  const requestBody = {
    TransactionIdentifier: transactionId,
    TotalAmount: parseFloat(amount),
    CurrencyCode: getCurrencyCode(currency),
    ThreeDSecure: false,
    OrderIdentifier: `VERIFY-${transactionId.substring(0, 8)}`,
  };

  try {
    console.log("[ncb-verify] Voiding verification charge", { transactionId, amount });

    const response = await fetch(`${apiUrl}/void`, {
      method: "POST",
      headers: getVerifyHeaders(),
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("[ncb-verify] Void error", { status: response.status });
      return { success: false, error: `Gateway error: HTTP ${response.status}` };
    }

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(responseText);
    } catch {
      return { success: false, error: "Invalid gateway response" };
    }

    console.log("[ncb-verify] Void result", {
      approved: result.Approved,
      isoResponseCode: result.IsoResponseCode,
    });

    return {
      success: result.Approved === true,
      error: result.Approved ? undefined : (result.ResponseMessage as string) || "Void failed",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[ncb-verify] Void exception", { error: msg });
    return { success: false, error: `Void request failed: ${msg}` };
  }
}

/**
 * Tokenize a card to get PanToken for storage.
 * Uses FPI /api/riskmgmt with JNCB verification account credentials
 * (JNCB account has tokenization enabled; SPI merchant does not).
 */
export async function tokenizeVerifiedCard(params: {
  cardDetails: CardDetails;
  transactionId: string;
  currency: string;
}): Promise<{ success: boolean; panToken?: string; error?: string }> {
  const config = getVerifyConfig();
  if (!config.enabled) {
    return { success: false, error: "Card verification is not configured" };
  }

  const apiUrl = getFpiApiUrl();
  const cleanedCard = params.cardDetails.cardNumber.replace(/\s/g, "");
  const expiration = `${params.cardDetails.cardExpYear.toString().slice(-2)}${params.cardDetails.cardExpMonth.toString().padStart(2, "0")}`;

  const requestBody = {
    TransactionIdentifier: params.transactionId,
    TotalAmount: 0.00,
    CurrencyCode: getCurrencyCode(params.currency),
    ThreeDSecure: false,
    Tokenize: true,
    Source: {
      CardPan: cleanedCard,
      CardCvv: params.cardDetails.cvv,
      CardExpiration: expiration,
      CardholderName: params.cardDetails.cardholderName,
    },
    OrderIdentifier: `TOKEN-${params.transactionId.substring(0, 8)}`,
  };

  try {
    console.log("[ncb-verify] Tokenizing card via FPI RiskMgmt", {
      transactionId: params.transactionId,
      cardPanLength: cleanedCard.length,
    });

    const response = await fetch(`${apiUrl}/riskmgmt`, {
      method: "POST",
      headers: getVerifyHeaders(),
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("[ncb-verify] Tokenize error", { status: response.status });
      return { success: false, error: `Gateway error: HTTP ${response.status}` };
    }

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(responseText);
    } catch {
      return { success: false, error: "Invalid gateway response" };
    }

    console.log("[ncb-verify] Tokenize result", {
      isoResponseCode: result.IsoResponseCode,
      hasPanToken: !!result.PanToken,
    });

    // TK0 = Tokenization successful — check multiple possible token field names
    const panToken = (result.PanToken || result.Token || result.CardToken) as string | undefined;

    if (result.IsoResponseCode === "TK0" && panToken) {
      return { success: true, panToken };
    }

    return {
      success: false,
      error: (result.ResponseMessage as string) || `Tokenization failed: ${result.IsoResponseCode}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[ncb-verify] Tokenize exception", { error: msg });
    return { success: false, error: `Gateway communication error: ${msg}` };
  }
}
