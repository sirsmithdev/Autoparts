/**
 * Contact form route — public endpoint for customer inquiries.
 */
import { Router } from "express";
import { z } from "zod";
import { sendContactFormEmail, sendContactConfirmationEmail } from "../email.js";

const router = Router();

const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email address"),
  phone: z.string().max(30).optional(),
  subject: z.enum([
    "General Inquiry",
    "Order Issue",
    "Return Question",
    "Part Availability",
    "Other",
  ]),
  message: z.string().min(1, "Message is required").max(5000),
});

// POST /api/store/contact
router.post("/api/store/contact", async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const { name, email, phone, subject, message } = parsed.data;

  try {
    // Send email to store admins
    await sendContactFormEmail({ name, email, phone, subject, message });

    // Send confirmation to the customer
    await sendContactConfirmationEmail(email, name, subject);

    res.json({ success: true });
  } catch (error) {
    console.error("[contact] Failed to process contact form:", error);
    res.status(500).json({ error: "Failed to send message. Please try again." });
  }
});

export default router;
