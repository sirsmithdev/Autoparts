import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || "orders@316-automotive.com";
const STORE_NAME = "316 Automotive Parts";

// ---------------------------------------------------------------------------
// Shared layout wrapper
// ---------------------------------------------------------------------------

function wrapInLayout(title: string, body: string): string {
  return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="background: #1a1a2e; color: #ffffff; padding: 20px; text-align: center;">
    <h1 style="margin: 0; font-size: 22px;">${STORE_NAME}</h1>
  </div>
  <div style="padding: 24px 20px;">
    <h2 style="margin: 0 0 16px; color: #1a1a2e;">${title}</h2>
    ${body}
  </div>
  <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666666;">
    <p style="margin: 0;">${STORE_NAME} &middot; Kingston, Jamaica</p>
  </div>
</div>`.trim();
}

function greeting(name: string): string {
  return `<p style="margin: 0 0 12px;">Hi ${escapeHtml(name)},</p>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Core send with retry (3 attempts, 5 s backoff)
// ---------------------------------------------------------------------------

async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set, skipping email:", subject);
    return false;
  }

  const recipients = Array.isArray(to) ? to : [to];

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await resend.emails.send({
        from: `${STORE_NAME} <${FROM_EMAIL}>`,
        to: recipients,
        subject,
        html,
      });
      return true;
    } catch (error) {
      console.error(`[email] Attempt ${attempt}/3 failed:`, error);
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  console.error("[email] All 3 attempts failed for:", subject, to);
  return false;
}

// ---------------------------------------------------------------------------
// Registration & verification emails
// ---------------------------------------------------------------------------

/**
 * Sent after registration with a verification link.
 */
export async function sendVerificationEmail(
  customerEmail: string,
  customerName: string,
  verifyUrl: string,
): Promise<boolean> {
  const body = `
    ${greeting(customerName)}
    <p>Welcome to ${STORE_NAME}! Please verify your email address to complete your registration.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${escapeHtml(verifyUrl)}"
         style="display: inline-block; background: #1a1a2e; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: bold; font-size: 14px;">
        Verify Email Address
      </a>
    </div>
    <p style="font-size: 13px; color: #666;">This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.</p>
    <p style="font-size: 12px; color: #999; word-break: break-all;">Or copy this link: ${escapeHtml(verifyUrl)}</p>`;

  const subject = "Verify your email address";
  return sendEmail(customerEmail, subject, wrapInLayout(subject, body));
}

/**
 * Sent after a customer verifies their email.
 */
export async function sendWelcomeEmail(
  customerEmail: string,
  customerName: string,
): Promise<boolean> {
  const body = `
    ${greeting(customerName)}
    <p>Your email has been verified. Your account is all set!</p>
    <p>You can now enjoy the full shopping experience — browse parts, save to your cart, and check out quickly.</p>
    <p>If you have any questions, just reply to this email.</p>`;

  const subject = `Welcome to ${STORE_NAME}!`;
  return sendEmail(customerEmail, subject, wrapInLayout(subject, body));
}

// ---------------------------------------------------------------------------
// Order lifecycle emails
// ---------------------------------------------------------------------------

/**
 * Sent immediately after an order is successfully placed.
 * Includes a full items table, totals, and delivery method.
 */
export async function sendOrderPlacedEmail(params: {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  subtotal: string;
  taxAmount: string;
  deliveryFee: string;
  total: string;
  deliveryMethod: string;
}): Promise<boolean> {
  const {
    customerEmail,
    customerName,
    orderNumber,
    items,
    subtotal,
    taxAmount,
    deliveryFee,
    total,
    deliveryMethod,
  } = params;

  const itemRows = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(item.productName)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${escapeHtml(item.unitPrice)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${escapeHtml(item.lineTotal)}</td>
      </tr>`,
    )
    .join("");

  const deliveryLabel =
    deliveryMethod === "pickup" ? "In-Store Pickup" : "Delivery";

  const body = `
    ${greeting(customerName)}
    <p>Thank you for your order! Here's your confirmation.</p>
    <p style="margin: 16px 0 4px; font-weight: bold;">Order ${escapeHtml(orderNumber)}</p>
    <p style="margin: 0 0 16px; color: #666;">Fulfillment: ${deliveryLabel}</p>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
      <tr style="background: #f5f5f5;">
        <th style="padding: 8px; text-align: left;">Item</th>
        <th style="padding: 8px; text-align: center;">Qty</th>
        <th style="padding: 8px; text-align: right;">Price</th>
        <th style="padding: 8px; text-align: right;">Total</th>
      </tr>
      ${itemRows}
    </table>
    <table style="width: 100%; margin-bottom: 16px;">
      <tr><td style="padding: 4px 0;">Subtotal</td><td style="text-align: right;">$${escapeHtml(subtotal)}</td></tr>
      <tr><td style="padding: 4px 0;">Tax</td><td style="text-align: right;">$${escapeHtml(taxAmount)}</td></tr>
      <tr><td style="padding: 4px 0;">Delivery</td><td style="text-align: right;">$${escapeHtml(deliveryFee)}</td></tr>
      <tr style="font-weight: bold; font-size: 16px;">
        <td style="padding: 8px 0; border-top: 2px solid #1a1a2e;">Total</td>
        <td style="padding: 8px 0; border-top: 2px solid #1a1a2e; text-align: right;">$${escapeHtml(total)}</td>
      </tr>
    </table>
    <p>We'll email you when your order status changes.</p>`;

  const subject = `Order ${orderNumber} confirmed`;
  return sendEmail(customerEmail, subject, wrapInLayout(subject, body));
}

/**
 * Sent when staff moves an order to "confirmed" (being prepared).
 */
export async function sendOrderConfirmedEmail(
  customerEmail: string,
  customerName: string,
  orderNumber: string,
): Promise<boolean> {
  const body = `
    ${greeting(customerName)}
    <p>Great news — your order <strong>${escapeHtml(orderNumber)}</strong> has been confirmed and is now being prepared.</p>
    <p>We'll let you know as soon as it's on its way or ready for collection.</p>`;

  const subject = "Your order is being prepared";
  return sendEmail(customerEmail, subject, wrapInLayout(subject, body));
}

/**
 * Sent when a tracking number is added and order is marked shipped.
 */
export async function sendOrderShippedEmail(
  customerEmail: string,
  customerName: string,
  orderNumber: string,
  trackingNumber: string,
): Promise<boolean> {
  const body = `
    ${greeting(customerName)}
    <p>Your order <strong>${escapeHtml(orderNumber)}</strong> has shipped!</p>
    <p style="margin: 16px 0;">
      <strong>Tracking number:</strong>
      <span style="font-family: monospace; background: #f5f5f5; padding: 4px 8px; border-radius: 4px;">
        ${escapeHtml(trackingNumber)}
      </span>
    </p>
    <p>You'll receive another email when it's out for delivery.</p>`;

  const subject = `Your order has shipped — tracking: ${trackingNumber}`;
  return sendEmail(customerEmail, subject, wrapInLayout("Your order has shipped", body));
}

/**
 * Sent when order status moves to "out for delivery".
 */
export async function sendOutForDeliveryEmail(
  customerEmail: string,
  customerName: string,
  orderNumber: string,
): Promise<boolean> {
  const body = `
    ${greeting(customerName)}
    <p>Your order <strong>${escapeHtml(orderNumber)}</strong> is out for delivery and on its way to you.</p>
    <p>Please make sure someone is available to receive it.</p>`;

  const subject = "Your order is on its way";
  return sendEmail(customerEmail, subject, wrapInLayout(subject, body));
}

/**
 * Sent when order is marked as delivered.
 */
export async function sendDeliveredEmail(
  customerEmail: string,
  customerName: string,
  orderNumber: string,
): Promise<boolean> {
  const body = `
    ${greeting(customerName)}
    <p>Your order <strong>${escapeHtml(orderNumber)}</strong> has been delivered.</p>
    <p>If you have any questions or issues with your order, please don't hesitate to contact us.</p>`;

  const subject = "Your order has been delivered";
  return sendEmail(customerEmail, subject, wrapInLayout(subject, body));
}

/**
 * Sent when an in-store pickup order is packed and ready.
 */
export async function sendReadyForPickupEmail(
  customerEmail: string,
  customerName: string,
  orderNumber: string,
  pickupCode?: string,
): Promise<boolean> {
  let qrSection = "";
  if (pickupCode) {
    try {
      const QRCode = (await import("qrcode")).default;
      const qrDataUrl = await QRCode.toDataURL(pickupCode, { width: 200, margin: 2 });
      qrSection = `
        <div style="text-align:center;margin:20px 0;padding:20px;background:#f8f9fa;border-radius:8px;">
          <p style="margin:0 0 10px;font-size:14px;color:#666;">Your pickup code:</p>
          <p style="margin:0 0 15px;font-size:28px;font-weight:bold;letter-spacing:4px;color:#1a1a2e;">${escapeHtml(pickupCode)}</p>
          <img src="${qrDataUrl}" alt="Pickup QR Code" width="200" height="200" style="display:block;margin:0 auto;" />
          <p style="margin:10px 0 0;font-size:12px;color:#999;">Show this QR code at the pickup counter</p>
        </div>`;
    } catch {
      qrSection = `
        <div style="text-align:center;margin:20px 0;padding:20px;background:#f8f9fa;border-radius:8px;">
          <p style="margin:0 0 10px;font-size:14px;color:#666;">Your pickup code:</p>
          <p style="margin:0;font-size:28px;font-weight:bold;letter-spacing:4px;color:#1a1a2e;">${escapeHtml(pickupCode)}</p>
        </div>`;
    }
  }

  const body = `
    ${greeting(customerName)}
    <p>Your order <strong>${escapeHtml(orderNumber)}</strong> is packed and ready to collect from our store.</p>
    ${qrSection}
    <p>Please bring a valid ID when picking up your order.</p>`;

  const subject = "Your order is ready to collect";
  return sendEmail(customerEmail, subject, wrapInLayout(subject, body));
}

/**
 * Sent when an order is cancelled (by staff or system).
 */
export async function sendOrderCancelledEmail(
  customerEmail: string,
  customerName: string,
  orderNumber: string,
  reason: string,
): Promise<boolean> {
  const body = `
    ${greeting(customerName)}
    <p>Your order <strong>${escapeHtml(orderNumber)}</strong> has been cancelled.</p>
    <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
    <p>If you believe this was an error, please contact us. Any charges will be refunded to your original payment method.</p>`;

  const subject = `Order ${orderNumber} cancelled`;
  return sendEmail(customerEmail, subject, wrapInLayout(subject, body));
}

// ---------------------------------------------------------------------------
// Return lifecycle emails
// ---------------------------------------------------------------------------

/**
 * Sent when a return request is approved by staff.
 */
export async function sendReturnApprovedEmail(
  customerEmail: string,
  customerName: string,
  returnNumber: string,
): Promise<boolean> {
  const body = `
    ${greeting(customerName)}
    <p>Your return request <strong>${escapeHtml(returnNumber)}</strong> has been approved.</p>
    <p>Please ship the item(s) back to us. We'll process your refund once we receive and inspect the return.</p>`;

  const subject = "Your return has been approved";
  return sendEmail(customerEmail, subject, wrapInLayout(subject, body));
}

/**
 * Sent when a refund has been issued for a return.
 */
export async function sendRefundProcessedEmail(
  customerEmail: string,
  customerName: string,
  returnNumber: string,
  refundAmount: string,
): Promise<boolean> {
  const body = `
    ${greeting(customerName)}
    <p>Your refund for return <strong>${escapeHtml(returnNumber)}</strong> has been processed.</p>
    <p style="font-size: 20px; font-weight: bold; margin: 16px 0; color: #1a1a2e;">
      Refund amount: $${escapeHtml(refundAmount)}
    </p>
    <p>The refund will appear on your original payment method within 5–10 business days.</p>`;

  const subject = `Your refund of $${refundAmount} has been processed`;
  return sendEmail(customerEmail, subject, wrapInLayout("Your refund has been processed", body));
}

// ---------------------------------------------------------------------------
// Staff notification
// ---------------------------------------------------------------------------

/**
 * Sent to all addresses in STORE_ADMIN_EMAILS when a new order is placed.
 */
export async function sendNewOrderStaffEmail(
  orderNumber: string,
  total: string,
  customerName: string,
): Promise<boolean> {
  const adminEmails = (process.env.STORE_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    console.warn("[email] STORE_ADMIN_EMAILS not set, skipping staff notification for:", orderNumber);
    return false;
  }

  const body = `
    <p>A new online order has been placed.</p>
    <table style="margin: 16px 0; border-collapse: collapse;">
      <tr>
        <td style="padding: 6px 12px 6px 0; font-weight: bold;">Order</td>
        <td style="padding: 6px 0;">${escapeHtml(orderNumber)}</td>
      </tr>
      <tr>
        <td style="padding: 6px 12px 6px 0; font-weight: bold;">Customer</td>
        <td style="padding: 6px 0;">${escapeHtml(customerName)}</td>
      </tr>
      <tr>
        <td style="padding: 6px 12px 6px 0; font-weight: bold;">Total</td>
        <td style="padding: 6px 0;">$${escapeHtml(total)}</td>
      </tr>
    </table>
    <p>Log in to the admin dashboard to review and confirm this order.</p>`;

  const subject = `New online order ${orderNumber}`;
  return sendEmail(adminEmails, subject, wrapInLayout(subject, body));
}
