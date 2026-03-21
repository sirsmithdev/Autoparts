"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";

interface StoreSettings {
  returnWindowDays?: number;
  defectiveReturnWindowDays?: number;
  restockingFeePercent?: number;
}

export default function ReturnPolicyPage() {
  const { data: settings, isLoading } = useQuery<StoreSettings>({
    queryKey: ["store-settings-public"],
    queryFn: () => api("/api/store/settings/public"),
  });

  const returnWindow = settings?.returnWindowDays ?? 14;
  const defectiveWindow = settings?.defectiveReturnWindowDays ?? 30;
  const restockingFee = settings?.restockingFeePercent ?? 15;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Return Policy" }]} />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : (
        <article className="prose prose-gray dark:prose-invert max-w-none">
          <h1>Return Policy</h1>

          <p>
            At 316 Auto Parts, we want you to be completely satisfied with your purchase.
            If something isn&apos;t right, we&apos;re here to help. Please review the details
            below for information on returns, exchanges, and refunds.
          </p>

          <h2>Return Window</h2>
          <ul>
            <li>
              <strong>Standard returns:</strong> Items may be returned within{" "}
              <strong>{returnWindow} days</strong> of delivery for a refund or exchange.
            </li>
            <li>
              <strong>Defective or incorrect items:</strong> If you received a defective
              or wrong part, you have <strong>{defectiveWindow} days</strong> from
              delivery to request a return.
            </li>
          </ul>

          <h2>Conditions for Return</h2>
          <ul>
            <li>Items must be in their original, unused condition with all packaging intact.</li>
            <li>Parts that have been installed, modified, or show signs of use cannot be returned.</li>
            <li>
              <strong>Electrical parts</strong> (sensors, modules, control units) are eligible
              for <strong>exchange or store credit only</strong> &mdash; no cash refunds.
            </li>
          </ul>

          <h2>Restocking Fee</h2>
          <p>
            A <strong>{restockingFee}%</strong> restocking fee applies to returns where
            the item is not defective or incorrectly shipped (e.g., change of mind, ordered
            wrong part). This fee is deducted from your refund amount.
          </p>

          <h2>Shipping Costs</h2>
          <ul>
            <li>
              <strong>Defective or wrong item:</strong> We cover the return shipping cost.
              A prepaid shipping label or arranged pickup will be provided.
            </li>
            <li>
              <strong>Change of mind or wrong order:</strong> The customer is responsible
              for return shipping costs.
            </li>
          </ul>

          <h2>How to Request a Return</h2>
          <ol>
            <li>
              Log in to your account and go to{" "}
              <strong>My Orders</strong>.
            </li>
            <li>
              Find the order containing the item you wish to return and open the order details.
            </li>
            <li>
              Click <strong>&ldquo;Request Return&rdquo;</strong> and select the item(s),
              quantity, and reason for the return.
            </li>
            <li>
              Submit your request. Our team will review it and respond within 1&ndash;2
              business days.
            </li>
            <li>
              Once approved, you&apos;ll receive instructions on how to ship the item back
              (or arrange a pickup if applicable).
            </li>
            <li>
              After we receive and inspect the returned item, your refund or exchange will
              be processed.
            </li>
          </ol>

          <h2>Refund Processing</h2>
          <p>
            Refunds are issued to the original payment method within 5&ndash;7 business days
            after the returned item has been received and inspected. You&apos;ll receive an
            email confirmation when the refund is processed.
          </p>

          <h2>Questions?</h2>
          <p>
            If you have any questions about our return policy or need help with a return,
            please contact us at{" "}
            <a href="mailto:info@316-automotive.com">info@316-automotive.com</a>.
          </p>
        </article>
      )}
    </div>
  );
}
