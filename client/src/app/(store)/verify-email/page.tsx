"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token");
      return;
    }

    api<{ message: string }>("/api/store/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((data) => {
        if (data.message === "Email already verified") {
          setStatus("already");
        } else {
          setStatus("success");
        }
        setMessage(data.message);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Verification failed");
      });
  }, [token]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Verifying your email...</p>
          </>
        )}

        {(status === "success" || status === "already") && (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <h1 className="text-2xl font-bold">
              {status === "already" ? "Already Verified" : "Email Verified!"}
            </h1>
            <p className="text-muted-foreground">
              {status === "already"
                ? "Your email address has already been verified."
                : "Your email address has been verified successfully. You're all set!"}
            </p>
            <Link
              href="/"
              className="inline-block mt-4 px-6 py-2.5 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              Continue Shopping
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold">Verification Failed</h1>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">
              The link may have expired. You can request a new one from your{" "}
              <Link href="/account" className="text-primary hover:underline">account settings</Link>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
