/**
 * PowerTranz Payment Service
 *
 * Ported from the garage app (PowerTranzPaymentService class) to a
 * functional module that reads credentials from environment variables.
 *
 * Supports:
 * - SPI auth with card data + 3DS (initiateSPIAuthWithCard)
 * - SPI auth with saved PanToken + 3DS (initiateSPIAuthWithToken)
 * - SPI payment completion after 3DS (completeSPIPayment)
 * - FPI Sale with token / no 3DS (chargeSavedCard)
 * - SPI callback parsing (parseSPICallback)
 * - Refund (refundPayment)
 * - Void (voidTransaction)
 * - Tokenize via /Api/riskmgmt (tokenizeCard)
 */

// ─── Configuration ──────────────────────────────────────────────────

interface PowerTranzConfig {
  merchantId: string;
  merchantPassword: string;
  testMode: boolean;
  productionUrl: string;
  testUrl: string;
  callbackUrl: string;
  enabled: boolean;
}

function getConfig(): PowerTranzConfig {
  return {
    merchantId: process.env.POWERTRANZ_MERCHANT_ID || "",
    merchantPassword: process.env.POWERTRANZ_MERCHANT_PASSWORD || "",
    testMode: process.env.POWERTRANZ_TEST_MODE === "true",
    productionUrl: process.env.POWERTRANZ_PRODUCTION_URL || "https://ptranz.com/Api/spi",
    testUrl: process.env.POWERTRANZ_TEST_URL || "https://staging.ptranz.com/Api/spi",
    callbackUrl: process.env.POWERTRANZ_CALLBACK_URL || "",
    enabled: !!(process.env.POWERTRANZ_MERCHANT_ID && process.env.POWERTRANZ_MERCHANT_PASSWORD),
  };
}

// ─── Exported Interfaces ────────────────────────────────────────────

export interface SPIAuthResult {
  success: boolean;
  spiToken?: string;
  redirectData?: string;
  approved?: boolean;
  isoResponseCode?: string;
  responseMessage?: string;
  transactionId?: string;
  error?: string;
}

export interface SPIPaymentResult {
  success: boolean;
  approved: boolean;
  isoResponseCode?: string;
  responseMessage?: string;
  transactionId?: string;
  referenceNumber?: string;
  authorizationCode?: string;
  cardBrand?: string;
  maskedPan?: string;
  totalAmount?: number;
  error?: string;
}

export interface SPICallbackResult {
  isValid: boolean;
  spiToken?: string;
  isoResponseCode?: string;
  responseMessage?: string;
  transactionId?: string;
  approved?: boolean;
  cardBrand?: string;
  maskedPan?: string;
}

// ─── Internal PowerTranz API Types ──────────────────────────────────

interface SPIAuthRequest {
  TransactionIdentifier: string;
  TotalAmount: number;
  CurrencyCode: string;
  ThreeDSecure: boolean;
  Source?: {
    CardPan?: string;
    CardCvv?: string;
    CardExpiration?: string;
    CardholderName?: string;
    Token?: string;
    PanToken?: string;
  };
  OrderIdentifier: string;
  BillingAddress?: {
    FirstName?: string;
    LastName?: string;
    EmailAddress?: string;
    PhoneNumber?: string;
  };
  AddressMatch?: boolean;
  ExtendedData?: {
    ThreeDSecure?: {
      ChallengeWindowSize?: number;
      ChallengeIndicator?: string;
    };
    MerchantResponseUrl?: string;
  };
}

interface SPIAuthResponse {
  SpiToken: string;
  RedirectData?: string;
  Approved: boolean;
  IsoResponseCode: string;
  ResponseMessage?: string;
  TransactionIdentifier?: string;
  OrderIdentifier?: string;
  TotalAmount?: number;
  RRN?: string;
  AuthorizationCode?: string;
  CardBrand?: string;
  MaskedPan?: string;
  PanToken?: string;
}

interface SPIPaymentResponse {
  Approved: boolean;
  IsoResponseCode: string;
  ResponseMessage?: string;
  TransactionIdentifier?: string;
  OrderIdentifier?: string;
  TotalAmount?: number;
  RRN?: string;
  AuthorizationCode?: string;
  CardBrand?: string;
  MaskedPan?: string;
}

interface FPITokenizeRequest {
  TransactionIdentifier: string;
  TotalAmount: number;
  CurrencyCode: string;
  ThreeDSecure: boolean;
  Tokenize: boolean;
  Source: {
    CardPan: string;
    CardCvv?: string;
    CardExpiration?: string;
    CardholderName?: string;
  };
  OrderIdentifier: string;
}

interface FPITokenizeResponse {
  IsoResponseCode: string;
  ResponseMessage?: string;
  PanToken?: string;
  Approved: boolean;
  TransactionIdentifier?: string;
}

interface FPIVoidRequest {
  TransactionIdentifier: string;
  TotalAmount: number;
  CurrencyCode: string;
  ThreeDSecure: boolean;
  OrderIdentifier: string;
}

// ─── Internal Helpers ───────────────────────────────────────────────

/** Get the SPI API base URL based on test/production mode */
function getApiUrl(): string {
  const config = getConfig();
  return config.testMode ? config.testUrl : config.productionUrl;
}

/** Derive the FPI API base URL from the SPI URL */
function getFpiApiUrl(): string {
  try {
    const spiUrl = getApiUrl();
    const { origin } = new URL(spiUrl);
    return `${origin}/api`;
  } catch {
    const config = getConfig();
    console.warn("[powertranz] Failed to parse SPI URL for FPI derivation, using hardcoded fallback");
    return config.testMode
      ? "https://staging.ptranz.com/api"
      : "https://ptranz.com/api";
  }
}

/** Get SPI authorization headers (main merchant credentials) */
function getSpiHeaders(): Record<string, string> {
  const config = getConfig();
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "PowerTranz-PowerTranzId": config.merchantId,
    "PowerTranz-PowerTranzPassword": config.merchantPassword,
  };
}

/** Get FPI authorization headers, with optional credential overrides */
function getFpiHeaders(merchantId?: string, merchantPassword?: string): Record<string, string> {
  const config = getConfig();
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "PowerTranz-PowerTranzId": merchantId || config.merchantId,
    "PowerTranz-PowerTranzPassword": merchantPassword || config.merchantPassword,
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
    "GYD": "328",
    "BSD": "044",
    "BZD": "084",
  };
  return currencyCodes[currency.toUpperCase()] || "840"; // Default to USD
}

// ─── Exported Functions ─────────────────────────────────────────────

/**
 * Initiate SPI payment with raw card data + 3DS.
 *
 * Sends card details in Source to /Api/spi/Sale with ThreeDSecure=true.
 * Returns SP4 + RedirectData (HTML for 3DS iframe), or a direct approval.
 */
export async function initiateSPIAuthWithCard(params: {
  transactionId: string;
  amount: number;
  currency: string;
  orderNumber: string;
  source: { cardPan: string; cardCvv: string; cardExpiration: string; cardholderName: string };
  billing?: { firstName?: string; lastName?: string; email?: string; phone?: string };
  responseUrl: string;
}): Promise<SPIAuthResult> {
  const config = getConfig();
  if (!config.enabled) {
    return { success: false, error: "PowerTranz payment gateway is not enabled" };
  }

  const apiUrl = getApiUrl();

  const requestBody: SPIAuthRequest = {
    TransactionIdentifier: params.transactionId,
    TotalAmount: params.amount,
    CurrencyCode: getCurrencyCode(params.currency),
    ThreeDSecure: true,
    Source: {
      CardPan: params.source.cardPan,
      ...(params.source.cardCvv ? { CardCvv: params.source.cardCvv } : {}),
      ...(params.source.cardExpiration ? { CardExpiration: params.source.cardExpiration } : {}),
      ...(params.source.cardholderName ? { CardholderName: params.source.cardholderName } : {}),
    },
    OrderIdentifier: params.orderNumber,
    BillingAddress: {
      FirstName: params.billing?.firstName || "",
      LastName: params.billing?.lastName || "",
      ...(params.billing?.email ? { EmailAddress: params.billing.email } : {}),
      ...(params.billing?.phone ? { PhoneNumber: params.billing.phone } : {}),
    },
    AddressMatch: false,
    ExtendedData: {
      ThreeDSecure: {
        ChallengeWindowSize: 4,
        ChallengeIndicator: "03",
      },
      MerchantResponseUrl: params.responseUrl,
    },
  };

  try {
    console.log("[powertranz] Initiating SPI Sale with card data", {
      url: `${apiUrl}/Sale`,
      transactionId: params.transactionId,
      amount: params.amount,
      currencyCode: requestBody.CurrencyCode,
      hasCvv: !!params.source.cardCvv,
      hasExpiration: !!params.source.cardExpiration,
      cardPanPrefix: params.source.cardPan?.substring(0, 6),
      cardPanLength: params.source.cardPan?.length,
      orderIdentifier: requestBody.OrderIdentifier,
    });

    const response = await fetch(`${apiUrl}/Sale`, {
      method: "POST",
      headers: getSpiHeaders(),
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await response.text();
    console.log("[powertranz] SPI Sale with card response", {
      status: response.status,
      responseBody: responseText.substring(0, 500),
    });

    if (!response.ok) {
      console.error("[powertranz] SPI Sale with card error", { status: response.status });
      return { success: false, error: `Gateway error: HTTP ${response.status}` };
    }

    let result: SPIAuthResponse;
    try {
      result = JSON.parse(responseText);
    } catch {
      return { success: false, error: "Invalid gateway response" };
    }

    console.log("[powertranz] SPI Sale with card result", {
      isoResponseCode: result.IsoResponseCode,
      approved: result.Approved,
      hasRedirectData: !!result.RedirectData,
      hasSpiToken: !!result.SpiToken,
    });

    const iso = result.IsoResponseCode;

    // SP4 = SPI Preprocessing complete (RedirectData has 3DS HTML for iframe)
    // 3D0 = Frictionless (3DS complete, call Payment)
    // 3D5 = Device fingerprint needed
    // 3D6 = Challenge needed
    // 00 = Approved directly
    if (iso === "SP4" || iso === "3D0" || iso === "3D5" || iso === "3D6" || iso === "00") {
      return {
        success: true,
        spiToken: result.SpiToken,
        isoResponseCode: iso,
        responseMessage: result.ResponseMessage,
        redirectData: result.RedirectData,
        transactionId: result.TransactionIdentifier,
      };
    }

    return {
      success: false,
      isoResponseCode: iso,
      responseMessage: result.ResponseMessage,
      error: result.ResponseMessage || `Auth failed with code: ${iso}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[powertranz] SPI Sale with card exception", { error: msg });
    return { success: false, error: `Gateway communication error: ${msg}` };
  }
}

/**
 * Initiate SPI payment with saved PanToken + 3DS.
 *
 * Sends the PanToken in Source.Token along with CardExpiration.
 * Returns SP4 + RedirectData (3DS iframe needed), 3D0/00 (frictionless/approved), or error.
 */
export async function initiateSPIAuthWithToken(params: {
  transactionId: string;
  amount: number;
  currency: string;
  orderNumber: string;
  panToken: string;
  billing?: { firstName?: string; lastName?: string; email?: string; phone?: string };
  responseUrl: string;
}): Promise<SPIAuthResult> {
  const config = getConfig();
  if (!config.enabled) {
    return { success: false, error: "PowerTranz payment gateway is not enabled" };
  }

  const apiUrl = getApiUrl();

  const requestBody = {
    TransactionIdentifier: params.transactionId,
    TotalAmount: params.amount,
    CurrencyCode: getCurrencyCode(params.currency),
    ThreeDSecure: true,
    Source: {
      Token: params.panToken,
    },
    OrderIdentifier: params.orderNumber,
    BillingAddress: {
      FirstName: params.billing?.firstName || "",
      LastName: params.billing?.lastName || "",
      ...(params.billing?.email ? { EmailAddress: params.billing.email } : {}),
      ...(params.billing?.phone ? { PhoneNumber: params.billing.phone } : {}),
    },
    AddressMatch: false,
    ExtendedData: {
      ThreeDSecure: {
        ChallengeWindowSize: 4,
        ChallengeIndicator: "03",
      },
      MerchantResponseUrl: params.responseUrl,
    },
  };

  try {
    console.log("[powertranz] Initiating SPI Sale with Token + 3DS", {
      url: `${apiUrl}/Sale`,
      transactionId: params.transactionId,
      amount: params.amount,
      tokenPrefix: params.panToken?.substring(0, 10),
      tokenLength: params.panToken?.length,
      orderIdentifier: requestBody.OrderIdentifier,
    });

    const response = await fetch(`${apiUrl}/Sale`, {
      method: "POST",
      headers: getSpiHeaders(),
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await response.text();
    console.log("[powertranz] SPI Token Sale response", {
      status: response.status,
      responseBody: responseText.substring(0, 500),
    });

    if (!response.ok) {
      return { success: false, error: `Gateway error: HTTP ${response.status}` };
    }

    let result: SPIAuthResponse;
    try {
      result = JSON.parse(responseText);
    } catch {
      return { success: false, error: "Invalid gateway response" };
    }

    const isoCode = result.IsoResponseCode;
    console.log("[powertranz] SPI Token Sale result", {
      isoResponseCode: isoCode,
      approved: result.Approved,
      hasRedirectData: !!result.RedirectData,
      hasSpiToken: !!result.SpiToken,
    });

    return {
      success: isoCode === "SP4" || isoCode === "3D0" || isoCode === "00",
      spiToken: result.SpiToken,
      redirectData: result.RedirectData,
      isoResponseCode: isoCode,
      responseMessage: result.ResponseMessage,
      transactionId: result.TransactionIdentifier,
      error: !result.Approved && isoCode !== "SP4" && isoCode !== "3D0"
        ? (result.ResponseMessage || "Payment failed")
        : undefined,
    };
  } catch (error) {
    console.error("[powertranz] SPI Token Sale error", { error });
    return { success: false, error: "Payment gateway error" };
  }
}

/**
 * Complete payment using SpiToken (after 3DS).
 *
 * Per PowerTranz docs: "the payload is just the SPI Token surrounded by quotes"
 */
export async function completeSPIPayment(spiToken: string): Promise<SPIPaymentResult> {
  const config = getConfig();
  if (!config.enabled) {
    return { success: false, approved: false, error: "PowerTranz payment gateway is not enabled" };
  }

  const apiUrl = getApiUrl();

  try {
    console.log("[powertranz] Completing SPI Payment", {
      spiTokenPrefix: spiToken?.substring(0, 50),
      spiTokenLength: spiToken?.length,
      apiUrl: `${apiUrl}/Payment`,
    });

    // Per PowerTranz docs: payload is just the SPI Token surrounded by quotes
    const requestBody = JSON.stringify(spiToken);

    const response = await fetch(`${apiUrl}/Payment`, {
      method: "POST",
      headers: getSpiHeaders(),
      body: requestBody,
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await response.text();
    console.log("[powertranz] SPI Payment response", { status: response.status });

    if (!response.ok) {
      console.error("[powertranz] SPI Payment error", { status: response.status });
      return { success: false, approved: false, error: `Gateway error: HTTP ${response.status}` };
    }

    let result: SPIPaymentResponse;
    try {
      result = JSON.parse(responseText);
    } catch {
      return { success: false, approved: false, error: `Invalid gateway response: ${responseText}` };
    }

    console.log("[powertranz] SPI Payment result", {
      approved: result.Approved,
      isoResponseCode: result.IsoResponseCode,
      rrn: result.RRN,
      authCode: result.AuthorizationCode,
    });

    return {
      success: true,
      approved: result.Approved,
      isoResponseCode: result.IsoResponseCode,
      responseMessage: result.ResponseMessage,
      transactionId: result.TransactionIdentifier,
      referenceNumber: result.RRN,
      authorizationCode: result.AuthorizationCode,
      cardBrand: result.CardBrand,
      maskedPan: result.MaskedPan,
      totalAmount: result.TotalAmount,
      error: result.Approved ? undefined : result.ResponseMessage,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[powertranz] SPI Payment exception", { error: errorMessage });
    return { success: false, approved: false, error: `Gateway communication error: ${errorMessage}` };
  }
}

/**
 * Charge a saved card via FPI Sale (no 3DS).
 *
 * Uses FPI /api/sale with Source.Token + ThreeDSecure=true.
 * Per PowerTranz: even card-on-file token payments must include ThreeDSecure=true
 * and cardholder name + email/phone in BillingAddress.
 */
export async function chargeSavedCard(params: {
  transactionId: string;
  amount: number;
  currency: string;
  orderNumber: string;
  panToken: string;
}): Promise<SPIPaymentResult> {
  const config = getConfig();
  if (!config.enabled) {
    return { success: false, approved: false, transactionId: params.transactionId, error: "Payment gateway is not enabled" };
  }

  const apiUrl = getFpiApiUrl();

  const requestBody = {
    TransactionIdentifier: params.transactionId,
    TotalAmount: params.amount,
    CurrencyCode: getCurrencyCode(params.currency),
    ThreeDSecure: true,
    Source: {
      Token: params.panToken,
    },
    OrderIdentifier: params.orderNumber,
  };

  try {
    console.log("[powertranz] Charging saved card via FPI Sale with Token", {
      transactionId: params.transactionId,
      amount: params.amount,
      tokenPrefix: params.panToken?.substring(0, 10),
      orderNumber: params.orderNumber,
    });

    const response = await fetch(`${apiUrl}/sale`, {
      method: "POST",
      headers: getFpiHeaders(),
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("[powertranz] FPI Sale error for saved card", { status: response.status });
      return { success: false, approved: false, transactionId: params.transactionId, error: `Gateway error: HTTP ${response.status}` };
    }

    let result: SPIPaymentResponse;
    try {
      result = JSON.parse(responseText);
    } catch {
      return { success: false, approved: false, transactionId: params.transactionId, error: "Invalid gateway response" };
    }

    console.log("[powertranz] FPI Sale result for saved card", {
      approved: result.Approved,
      isoResponseCode: result.IsoResponseCode,
      cardBrand: result.CardBrand,
      rrn: result.RRN,
    });

    return {
      success: result.Approved,
      approved: result.Approved,
      transactionId: params.transactionId,
      referenceNumber: result.RRN,
      authorizationCode: result.AuthorizationCode,
      cardBrand: result.CardBrand,
      maskedPan: result.MaskedPan,
      isoResponseCode: result.IsoResponseCode,
      responseMessage: result.ResponseMessage,
      error: result.Approved ? undefined : (result.ResponseMessage || "Payment declined"),
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[powertranz] FPI Sale exception for saved card", { error: errorMessage });
    return { success: false, approved: false, transactionId: params.transactionId, error: `Gateway error: ${errorMessage}` };
  }
}

/**
 * Parse SPI callback data.
 *
 * PowerTranz POSTs back to MerchantResponseUrl after 3DS.
 */
export function parseSPICallback(callbackData: Record<string, unknown>): SPICallbackResult {
  return {
    isValid: !!callbackData.SpiToken || !!callbackData.IsoResponseCode,
    spiToken: callbackData.SpiToken as string | undefined,
    isoResponseCode: callbackData.IsoResponseCode as string | undefined,
    responseMessage: callbackData.ResponseMessage as string | undefined,
    transactionId: callbackData.TransactionIdentifier as string | undefined,
    approved: callbackData.Approved === true || callbackData.IsoResponseCode === "00",
    cardBrand: callbackData.CardBrand as string | undefined,
    maskedPan: callbackData.MaskedPan as string | undefined,
  };
}

/**
 * Refund a payment.
 *
 * Uses SPI /Api/spi/Refund endpoint.
 * Amounts are decimal (e.g., 99.99), NOT cents.
 */
export async function refundPayment(params: {
  originalTransactionId: string;
  amount: number;
  currency: string;
}): Promise<{ success: boolean; error?: string }> {
  const config = getConfig();
  if (!config.enabled) {
    return { success: false, error: "Payment gateway is not enabled" };
  }

  const apiUrl = getApiUrl();

  const requestBody: SPIAuthRequest = {
    TransactionIdentifier: params.originalTransactionId,
    TotalAmount: params.amount,
    CurrencyCode: getCurrencyCode(params.currency),
    ThreeDSecure: false,
    OrderIdentifier: params.originalTransactionId,
  };

  try {
    console.log("[powertranz] Initiating SPI Refund", {
      transactionId: params.originalTransactionId,
      amount: params.amount,
    });

    const response = await fetch(`${apiUrl}/Refund`, {
      method: "POST",
      headers: getSpiHeaders(),
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error("[powertranz] SPI Refund error", { status: response.status });
      return { success: false, error: `Gateway error: HTTP ${response.status}` };
    }

    let result: SPIPaymentResponse;
    try {
      result = JSON.parse(responseText);
    } catch {
      return { success: false, error: "Invalid gateway response" };
    }

    console.log("[powertranz] SPI Refund result", {
      approved: result.Approved,
      isoResponseCode: result.IsoResponseCode,
    });

    return {
      success: result.Approved,
      error: result.Approved ? undefined : result.ResponseMessage,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[powertranz] SPI Refund exception", { error: msg });
    return { success: false, error: `Gateway communication error: ${msg}` };
  }
}

/**
 * Void a transaction.
 *
 * Uses FPI /api/void endpoint.
 */
export async function voidTransaction(params: {
  transactionId: string;
  amount: number;
  currency: string;
  orderNumber: string;
}): Promise<{ success: boolean; error?: string }> {
  const config = getConfig();
  if (!config.enabled) {
    return { success: false, error: "Payment gateway is not enabled" };
  }

  const apiUrl = getFpiApiUrl();

  const requestBody: FPIVoidRequest = {
    TransactionIdentifier: params.transactionId,
    TotalAmount: params.amount,
    CurrencyCode: getCurrencyCode(params.currency),
    ThreeDSecure: false,
    OrderIdentifier: params.orderNumber,
  };

  try {
    console.log("[powertranz] FPI Void transaction", {
      transactionId: params.transactionId,
      amount: params.amount,
    });

    const response = await fetch(`${apiUrl}/void`, {
      method: "POST",
      headers: getFpiHeaders(),
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("[powertranz] FPI Void error", { status: response.status });
      return { success: false, error: `Gateway error: HTTP ${response.status}` };
    }

    let result: SPIAuthResponse;
    try {
      result = JSON.parse(responseText);
    } catch {
      return { success: false, error: "Invalid gateway response" };
    }

    console.log("[powertranz] FPI Void result", {
      approved: result.Approved,
      isoResponseCode: result.IsoResponseCode,
    });

    return {
      success: result.Approved,
      error: result.Approved ? undefined : result.ResponseMessage,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[powertranz] FPI Void exception", { error: msg });
    return { success: false, error: `Gateway communication error: ${msg}` };
  }
}

/**
 * Tokenize a card via /Api/riskmgmt.
 *
 * Uses FPI path with Tokenize=true, TotalAmount=0.00, ThreeDSecure=false.
 * Returns PanToken when IsoResponseCode is TK0.
 */
export async function tokenizeCard(params: {
  transactionId: string;
  amount: number;
  currency: string;
  source: { cardPan: string; cardCvv: string; cardExpiration: string; cardholderName: string };
}): Promise<{ success: boolean; panToken?: string; error?: string }> {
  const config = getConfig();
  if (!config.enabled) {
    return { success: false, error: "Payment gateway is not enabled" };
  }

  const apiUrl = getFpiApiUrl();
  const tokenizeUrl = `${apiUrl}/riskmgmt`;

  const requestBody: FPITokenizeRequest = {
    TransactionIdentifier: params.transactionId,
    TotalAmount: 0.00,
    CurrencyCode: getCurrencyCode(params.currency),
    ThreeDSecure: false,
    Tokenize: true,
    Source: {
      CardPan: params.source.cardPan,
      ...(params.source.cardCvv ? { CardCvv: params.source.cardCvv } : {}),
      ...(params.source.cardExpiration ? { CardExpiration: params.source.cardExpiration } : {}),
      ...(params.source.cardholderName ? { CardholderName: params.source.cardholderName } : {}),
    },
    OrderIdentifier: `TOKEN-${params.transactionId.substring(0, 8)}`,
  };

  try {
    console.log("[powertranz] Tokenize card via FPI RiskMgmt", {
      transactionId: params.transactionId,
      hasCardPan: !!params.source.cardPan,
      cardPanLength: params.source.cardPan?.length,
      hasExpiration: !!params.source.cardExpiration,
      hasCvv: !!params.source.cardCvv,
      url: tokenizeUrl,
    });

    const response = await fetch(tokenizeUrl, {
      method: "POST",
      headers: getFpiHeaders(),
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("[powertranz] FPI Tokenize error", { status: response.status });
      return { success: false, error: `Gateway error: HTTP ${response.status}` };
    }

    let result: FPITokenizeResponse;
    try {
      result = JSON.parse(responseText);
    } catch {
      return { success: false, error: "Invalid gateway response" };
    }

    console.log("[powertranz] FPI Tokenize result", {
      isoResponseCode: result.IsoResponseCode,
      hasPanToken: !!result.PanToken,
      responseKeys: Object.keys(result),
      responseBody: responseText.substring(0, 500),
    });

    // TK0 = Tokenization successful -- check multiple possible token field names
    const panToken = result.PanToken
      || (result as unknown as Record<string, unknown>)["Token"] as string
      || (result as unknown as Record<string, unknown>)["CardToken"] as string;

    if (result.IsoResponseCode === "TK0" && panToken) {
      return {
        success: true,
        panToken,
      };
    }

    return {
      success: false,
      error: result.ResponseMessage || `Tokenization failed: ${result.IsoResponseCode}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[powertranz] FPI Tokenize exception", { error: msg });
    return { success: false, error: `Gateway communication error: ${msg}` };
  }
}
