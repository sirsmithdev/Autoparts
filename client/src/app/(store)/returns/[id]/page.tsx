"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { formatPrice } from "@/lib/utils";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { OrderTimeline } from "@/components/OrderTimeline";
import { Skeleton } from "@/components/ui/skeleton";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import { format } from "date-fns";
import { ArrowLeft, RotateCcw, AlertTriangle, ExternalLink } from "lucide-react";

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  requested: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  approved: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  shipped_back: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  received: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  refunded: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  rejected: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  exchanged: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  closed: { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500" },
};

const RETURN_STEPS = [
  { key: "requested", label: "Requested" },
  { key: "approved", label: "Approved" },
  { key: "shipped_back", label: "Shipped Back" },
  { key: "received", label: "Received" },
  { key: "refunded", label: "Refunded" },
];

function getTimelineStepIndex(status: string): number {
  // For statuses that map directly to the steps
  const idx = RETURN_STEPS.findIndex(s => s.key === status);
  if (idx >= 0) return idx;
  // exchanged and closed are terminal states after received
  if (status === "exchanged" || status === "closed") return RETURN_STEPS.length - 1;
  // rejected stops at step 0
  if (status === "rejected") return 0;
  return 0;
}

interface ReturnItem {
  id: string;
  partName: string;
  partNumber: string;
  quantity: number;
  reason: string;
}

interface ReturnDetail {
  id: string;
  returnNumber: string;
  status: string;
  reason: string;
  reasonDetails?: string;
  resolutionType?: string;
  refundAmount?: string;
  restockingFee?: string;
  shippingResponsibility?: string;
  rejectionReason?: string;
  requestedAt: string;
  approvedAt?: string;
  shippedAt?: string;
  receivedAt?: string;
  refundedAt?: string;
  orderId: string;
  orderNumber?: string;
  items: ReturnItem[];
}

export default function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login?redirect=/returns");
  }, [authLoading, isAuthenticated, router]);

  const { data: returnData, isLoading, error } = useQuery<ReturnDetail>({
    queryKey: ["my-return", id],
    queryFn: () => api(`/api/store/returns/${id}`),
    enabled: isAuthenticated && !!id,
  });

  if (authLoading || !isAuthenticated || isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    const isNotOwned = error.message?.includes("403") || error.message?.includes("forbidden");
    if (isNotOwned) {
      router.replace("/returns");
      return null;
    }
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center space-y-3">
        <RotateCcw className="h-12 w-12 text-muted-foreground/30 mx-auto" />
        <p className="text-lg font-medium">Return not found</p>
        <Link href="/returns" className="text-primary hover:underline text-sm">View all returns</Link>
      </div>
    );
  }

  if (!returnData) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center space-y-3">
        <RotateCcw className="h-12 w-12 text-muted-foreground/30 mx-auto" />
        <p className="text-lg font-medium">Return not found</p>
        <Link href="/returns" className="text-primary hover:underline text-sm">View all returns</Link>
      </div>
    );
  }

  const cfg = statusConfig[returnData.status] || { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500" };
  const isRejected = returnData.status === "rejected";
  const stepIndex = getTimelineStepIndex(returnData.status);

  const timelineSteps = RETURN_STEPS.map(s => ({
    label: s.label,
    timestamp:
      s.key === "requested" && returnData.requestedAt
        ? format(new Date(returnData.requestedAt), "MMM d, h:mm a")
        : s.key === "approved" && returnData.approvedAt
          ? format(new Date(returnData.approvedAt), "MMM d, h:mm a")
          : s.key === "shipped_back" && returnData.shippedAt
            ? format(new Date(returnData.shippedAt), "MMM d, h:mm a")
            : s.key === "received" && returnData.receivedAt
              ? format(new Date(returnData.receivedAt), "MMM d, h:mm a")
              : s.key === "refunded" && returnData.refundedAt
                ? format(new Date(returnData.refundedAt), "MMM d, h:mm a")
                : null,
  }));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Returns", href: "/returns" }, { label: returnData.returnNumber }]} />

      <Link href="/returns" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Returns
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{returnData.returnNumber}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Requested {format(new Date(returnData.requestedAt), "MMMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${cfg.bg} ${cfg.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {returnData.status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Rejection Alert */}
      {isRejected && (
        <div className="flex items-start gap-3 p-4 border border-red-200 rounded-lg bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Return Rejected</p>
            {returnData.rejectionReason && (
              <p className="text-sm text-red-700 mt-1">{returnData.rejectionReason}</p>
            )}
          </div>
        </div>
      )}

      {/* Status Timeline */}
      {!isRejected && (
        <div className="border rounded-xl bg-card p-6">
          <OrderTimeline
            steps={timelineSteps}
            currentStepIndex={stepIndex}
            orientation="vertical"
          />
        </div>
      )}

      {/* Return Items */}
      <div className="border rounded-xl overflow-hidden bg-card">
        <div className="px-5 py-3 bg-muted/50 border-b">
          <h2 className="font-semibold text-sm">Return Items ({returnData.items.length})</h2>
        </div>
        <div className="divide-y">
          {returnData.items.map(item => (
            <div key={item.id} className="flex items-center justify-between p-4 gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium line-clamp-1">{item.partName}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.partNumber}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium">Qty: {item.quantity}</p>
                <p className="text-xs text-muted-foreground capitalize">{item.reason.replace(/_/g, " ")}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Details Card */}
      <div className="border rounded-xl bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm">Return Details</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Reason</dt>
            <dd className="font-medium capitalize mt-0.5">{returnData.reason.replace(/_/g, " ")}</dd>
          </div>
          {returnData.reasonDetails && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Details</dt>
              <dd className="font-medium mt-0.5">{returnData.reasonDetails}</dd>
            </div>
          )}
          {returnData.resolutionType && (
            <div>
              <dt className="text-muted-foreground">Resolution Type</dt>
              <dd className="font-medium capitalize mt-0.5">{returnData.resolutionType.replace(/_/g, " ")}</dd>
            </div>
          )}
          {returnData.refundAmount && (
            <div>
              <dt className="text-muted-foreground">Refund Amount</dt>
              <dd className="font-medium mt-0.5">{formatPrice(returnData.refundAmount)}</dd>
            </div>
          )}
          {returnData.restockingFee && parseFloat(returnData.restockingFee) > 0 && (
            <div>
              <dt className="text-muted-foreground">Restocking Fee</dt>
              <dd className="font-medium mt-0.5">{formatPrice(returnData.restockingFee)}</dd>
            </div>
          )}
          {returnData.shippingResponsibility && (
            <div>
              <dt className="text-muted-foreground">Shipping Responsibility</dt>
              <dd className="font-medium capitalize mt-0.5">{returnData.shippingResponsibility.replace(/_/g, " ")}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Original Order Link */}
      <div className="flex">
        <Link
          href={`/orders/${returnData.orderId}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          View Original Order
        </Link>
      </div>
    </div>
  );
}
