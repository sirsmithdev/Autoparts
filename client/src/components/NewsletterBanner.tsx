"use client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

export function NewsletterBanner() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    try {
      await api("/api/store/newsletter/subscribe", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      toast({ title: "Subscribed!", description: "You'll receive our latest deals and updates." });
      setEmail("");
    } catch {
      toast({ title: "Failed to subscribe", description: "Please try again later.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-primary py-10 px-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-xl md:text-2xl font-bold text-white">
            Join the 316 Auto Parts VIP Club!
          </h3>
          <p className="text-sm text-white/80 mt-1 max-w-md">
            Get exclusive deals, new product alerts, and special member-only pricing delivered to your inbox.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex w-full md:w-auto">
          <input
            type="email"
            placeholder="Your email address..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 md:w-72 px-4 py-2.5 rounded-l-md text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-white/50"
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-foreground text-white text-sm font-medium rounded-r-md hover:bg-foreground/90 transition-colors shrink-0 disabled:opacity-50"
          >
            {submitting ? "Subscribing..." : "Subscribe"}
          </button>
        </form>
      </div>
    </section>
  );
}
