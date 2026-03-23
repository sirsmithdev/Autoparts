"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { Loader2, Send, CheckCircle } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";

const SUBJECTS = [
  "General Inquiry",
  "Order Issue",
  "Return Question",
  "Part Availability",
  "Other",
] as const;

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState<string>("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/api/store/contact", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          phone: phone || undefined,
          subject,
          message,
        }),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold">Message Sent</h1>
          <p className="text-muted-foreground">
            Thank you for contacting us. We&apos;ll get back to you as soon as
            possible. A confirmation email has been sent to your inbox.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <Breadcrumbs items={[{ label: "Contact Us" }]} />
        <h1 className="text-2xl font-bold">Contact Us</h1>
        <p className="text-muted-foreground text-sm">
          Have a question or need help? Fill out the form below and we&apos;ll
          get back to you.
        </p>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Name</label>
            <input
              type="text"
              required
              className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">Email</label>
            <input
              type="email"
              required
              className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">
              Phone <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              type="tel"
              className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Your phone number"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">Subject</label>
            <select
              required
              className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="" disabled>
                Select a subject
              </option>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">Message</label>
            <textarea
              required
              rows={5}
              className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-vertical"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can we help?"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-primary-foreground rounded-md font-semibold text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Send Message
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
