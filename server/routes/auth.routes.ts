/**
 * Auth routes — register, login, Google sign-in, refresh, profile, set-password.
 */
import { Router } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware.js";
import {
  generateAccessToken,
  generateRefreshToken,
  generateEmailVerifyToken,
  generatePasswordResetToken,
  verifyToken,
  isAdminEmail,
} from "../auth.js";
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } from "../email.js";
import * as customerStore from "../storage/customers.js";
import type { Customer } from "../schema.js";

const router = Router();

// ─── Zod Schemas ─────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const googleSchema = z.object({
  idToken: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  parish: z.string().optional(),
});

const setPasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8),
});

// ─── Helpers ─────────────────────────────────────────────

/** Strip the password hash before sending a customer to the client. */
function toCustomerResponse(customer: Customer) {
  const { password, ...rest } = customer;
  return { ...rest, role: customer.role ?? null };
}

/** Build the token pair and persist the refresh token in the DB. */
async function issueTokens(customer: Customer) {
  let role = customer.role ?? null;

  // Auto-promote: if email is in STORE_ADMIN_EMAILS and no role set, promote to admin
  if (!role && isAdminEmail(customer.email)) {
    role = "admin";
    await customerStore.setRole(customer.id, "admin");
  }

  const isAdmin = role === "admin" || isAdminEmail(customer.email);

  const accessToken = generateAccessToken({
    id: customer.id,
    email: customer.email,
    isAdmin,
    role,
  });
  const refreshToken = generateRefreshToken({
    id: customer.id,
    email: customer.email,
    isAdmin,
    role,
  });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await customerStore.storeRefreshToken(customer.id, refreshToken, expiresAt);

  return { accessToken, refreshToken };
}

// ─── POST /api/store/auth/register ───────────────────────

router.post("/api/store/auth/register", async (req, res) => {
  try {
    const body = registerSchema.parse(req.body);

    const existing = await customerStore.findByEmail(body.email);
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const customer = await customerStore.createCustomer({
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
    });

    const tokens = await issueTokens(customer);

    // Send verification email (fire-and-forget, don't block registration)
    const verifyToken = generateEmailVerifyToken({ id: customer.id, email: customer.email });
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
    const verifyUrl = `${baseUrl}/parts/verify-email?token=${verifyToken}`;
    sendVerificationEmail(
      customer.email,
      customer.firstName || "there",
      verifyUrl,
    ).catch((err) => console.error("Failed to send verification email:", err));

    res.status(201).json({
      customer: toCustomerResponse(customer),
      ...tokens,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Register failed:", error);
    res.status(500).json({ message: "Registration failed" });
  }
});

// ─── POST /api/store/auth/login ──────────────────────────

router.post("/api/store/auth/login", async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);

    const customer = await customerStore.findByEmail(body.email);
    if (!customer) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!customer.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    if (!customer.password) {
      return res.status(401).json({
        message:
          "No password set. Sign in with Google or set a password from your account page.",
      });
    }

    const valid = await customerStore.verifyPassword(customer, body.password);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const tokens = await issueTokens(customer);

    res.json({
      customer: toCustomerResponse(customer),
      ...tokens,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Login failed:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

// ─── POST /api/store/auth/google ─────────────────────────

router.post("/api/store/auth/google", async (req, res) => {
  try {
    const body = googleSchema.parse(req.body);

    const { OAuth2Client } = await import("google-auth-library");
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    const ticket = await client.verifyIdToken({
      idToken: body.idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ message: "Google account has no email" });
    }

    const googleId = payload.sub;
    const email = payload.email;
    const firstName = payload.given_name ?? "";
    const lastName = payload.family_name ?? "";
    const picture = payload.picture ?? undefined;

    // 1. Already linked by googleId
    let customer = await customerStore.findByGoogleId(googleId);

    if (!customer) {
      // 2. Existing email account — link Google to it
      customer = await customerStore.findByEmail(email);
      if (customer) {
        await customerStore.linkGoogleAccount(customer.id, googleId, picture);
        // Re-fetch to get updated fields
        customer = await customerStore.findById(customer.id);
      }
    }

    if (!customer) {
      // 3. Brand new customer
      customer = await customerStore.createGoogleCustomer({
        email,
        googleId,
        firstName,
        lastName,
        profileImageUrl: picture,
      });
    }

    if (!customer.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    const tokens = await issueTokens(customer);

    res.json({
      customer: toCustomerResponse(customer),
      ...tokens,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Google auth failed:", error);
    res.status(500).json({ message: "Google authentication failed" });
  }
});

// ─── POST /api/store/auth/316-login ─────────────────────

router.post("/api/store/auth/316-login", async (req, res) => {
  try {
    const body = loginSchema.parse(req.body);

    const { verifyGarageCredentials } = await import(
      "../sync/garageAuth.js"
    );
    const result = await verifyGarageCredentials(body.email, body.password);

    if (!result.success || !result.user) {
      return res
        .status(401)
        .json({ message: result.error || "Invalid 316 Automotive credentials" });
    }

    const garageUser = result.user;

    // 1. Already linked by garageUserId
    let customer = await customerStore.findByGarageUserId(garageUser.id);

    if (!customer) {
      // 2. Existing email account — auto-link garage account
      customer = await customerStore.findByEmail(garageUser.email);
      if (customer) {
        await customerStore.linkGarageAccount(customer.id, garageUser.id);
        customer = await customerStore.findById(customer.id);
      }
    }

    if (!customer) {
      // 3. Brand new customer — create from garage profile
      customer = await customerStore.createGarageCustomer({
        email: garageUser.email,
        garageUserId: garageUser.id,
        firstName: garageUser.firstName,
        lastName: garageUser.lastName,
        phone: garageUser.phone,
      });
    }

    if (!customer!.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    const tokens = await issueTokens(customer!);

    res.json({
      customer: toCustomerResponse(customer!),
      ...tokens,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("316 login failed:", error);
    res.status(500).json({ message: "316 Automotive login failed" });
  }
});

// ─── POST /api/store/auth/refresh ────────────────────────

router.post("/api/store/auth/refresh", async (req, res) => {
  try {
    const body = refreshSchema.parse(req.body);

    let payload;
    try {
      payload = verifyToken(body.refreshToken);
    } catch {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    if (payload.type !== "refresh") {
      return res.status(401).json({ message: "Invalid token type" });
    }

    const storedToken = await customerStore.findRefreshToken(body.refreshToken);
    if (!storedToken) {
      return res.status(401).json({ message: "Refresh token not found" });
    }

    if (storedToken.expiresAt < new Date()) {
      return res.status(401).json({ message: "Refresh token expired" });
    }

    // Token rotation — delete the old token before issuing new ones
    await customerStore.deleteRefreshToken(body.refreshToken);

    const customer = await customerStore.findById(payload.customerId);
    if (!customer || !customer.isActive) {
      return res.status(401).json({ message: "Customer not found or inactive" });
    }

    const tokens = await issueTokens(customer);

    res.json({
      ...tokens,
      customer: toCustomerResponse(customer),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Token refresh failed:", error);
    res.status(500).json({ message: "Token refresh failed" });
  }
});

// ─── GET /api/store/auth/me ──────────────────────────────

router.get("/api/store/auth/me", authenticateToken, async (req, res) => {
  try {
    const customer = await customerStore.findById(req.customer!.customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }
    res.json(toCustomerResponse(customer));
  } catch (error) {
    console.error("Failed to get profile:", error);
    res.status(500).json({ message: "Failed to get profile" });
  }
});

// ─── PATCH /api/store/auth/me ────────────────────────────

router.patch("/api/store/auth/me", authenticateToken, async (req, res) => {
  try {
    const body = updateProfileSchema.parse(req.body);

    await customerStore.updateProfile(req.customer!.customerId, body);

    const updated = await customerStore.findById(req.customer!.customerId);
    if (!updated) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json(toCustomerResponse(updated));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("Profile update failed:", error);
    res.status(500).json({ message: "Profile update failed" });
  }
});

// ─── POST /api/store/auth/verify-email ───────────────────

router.post("/api/store/auth/verify-email", async (req, res) => {
  try {
    const { token } = req.body as { token?: string };
    if (!token) {
      return res.status(400).json({ message: "Verification token is required" });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(400).json({ message: "Invalid or expired verification link" });
    }

    if (payload.type !== "email_verify") {
      return res.status(400).json({ message: "Invalid token type" });
    }

    const customer = await customerStore.findById(payload.customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    if (customer.emailVerified) {
      return res.json({ message: "Email already verified" });
    }

    await customerStore.markEmailVerified(customer.id);

    // Send welcome email
    sendWelcomeEmail(
      customer.email,
      customer.firstName || "there",
    ).catch((err) => console.error("Failed to send welcome email:", err));

    res.json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Email verification failed:", error);
    res.status(500).json({ message: "Email verification failed" });
  }
});

// ─── POST /api/store/auth/resend-verification ────────────

router.post(
  "/api/store/auth/resend-verification",
  authenticateToken,
  async (req, res) => {
    try {
      const customer = await customerStore.findById(req.customer!.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      if (customer.emailVerified) {
        return res.json({ message: "Email already verified" });
      }

      const verifyToken = generateEmailVerifyToken({ id: customer.id, email: customer.email });
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
      const verifyUrl = `${baseUrl}/parts/verify-email?token=${verifyToken}`;

      const sent = await sendVerificationEmail(
        customer.email,
        customer.firstName || "there",
        verifyUrl,
      );

      if (!sent) {
        return res.status(500).json({ message: "Failed to send verification email" });
      }

      res.json({ message: "Verification email sent" });
    } catch (error) {
      console.error("Resend verification failed:", error);
      res.status(500).json({ message: "Failed to resend verification email" });
    }
  },
);

// ─── POST /api/store/auth/set-password ───────────────────

router.post(
  "/api/store/auth/set-password",
  authenticateToken,
  async (req, res) => {
    try {
      const body = setPasswordSchema.parse(req.body);

      const customer = await customerStore.findById(req.customer!.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // If the customer already has a password, the current password is required
      if (customer.password) {
        if (!body.currentPassword) {
          return res
            .status(400)
            .json({ message: "Current password is required" });
        }
        const valid = await customerStore.verifyPassword(
          customer,
          body.currentPassword,
        );
        if (!valid) {
          return res
            .status(401)
            .json({ message: "Current password is incorrect" });
        }
      }
      // Google-only accounts (no password) can set one without currentPassword

      await customerStore.setPassword(customer.id, body.newPassword);
      await customerStore.revokeAllRefreshTokens(customer.id);

      res.json({ message: "Password updated. Please sign in again." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Set password failed:", error);
      res.status(500).json({ message: "Set password failed" });
    }
  },
);

// ─── POST /api/store/auth/forgot-password ────────────────

router.post("/api/store/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ message: "Email is required" });

    // Always return success to prevent email enumeration
    const customer = await customerStore.findByEmail(email);
    if (customer && customer.isActive) {
      const token = generatePasswordResetToken({ id: customer.id, email: customer.email });
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
      const resetUrl = `${baseUrl}/parts/reset-password?token=${token}`;
      sendPasswordResetEmail(customer.email, customer.firstName || "there", resetUrl).catch((err) =>
        console.error("Failed to send password reset email:", err),
      );
    }

    res.json({ message: "If an account with that email exists, a reset link has been sent." });
  } catch (error) {
    console.error("Forgot password failed:", error);
    res.status(500).json({ message: "Failed to process password reset request" });
  }
});

// ─── POST /api/store/auth/reset-password ─────────────────

router.post("/api/store/auth/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    if (!token) return res.status(400).json({ message: "Reset token is required" });
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }

    if (payload.type !== "password_reset") {
      return res.status(400).json({ message: "Invalid token type" });
    }

    const customer = await customerStore.findById(payload.customerId);
    if (!customer || !customer.isActive) {
      return res.status(400).json({ message: "Account not found or inactive" });
    }

    await customerStore.setPassword(customer.id, newPassword);
    await customerStore.revokeAllRefreshTokens(customer.id);

    res.json({ message: "Password has been reset. Please sign in with your new password." });
  } catch (error) {
    console.error("Reset password failed:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
});

export default router;
