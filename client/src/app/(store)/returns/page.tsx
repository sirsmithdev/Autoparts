"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { format } from "date-fns";
import { RotateCcw, ChevronRight } from "lucide-react";

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  requested: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  approved: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  rejected: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  shipped_back: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  received: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
  refunded: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  exchanged: { bg: "bg-cyan-50", text: "text-cyan-700", dot: "bg-cyan-500" },
  closed: { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500" },
};

export default function ReturnsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!authLoading && !isAuthenticated) router.replace("/login?redirect=/returns"); }, [authLoading, isAuthenticated, router]);

  const { data: returns = [], isLoading } = useQuery<Array<{ id: string; returnNumber: string; status: string; reason: string; requestedAt: string; orderId: string }>>({
    queryKey: ["my-returns"],
    queryFn: () => api("/api/store/returns"),
    enabled: isAuthenticated,
  });

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "My Returns" }]} />

      <h1 className="text-2xl font-bold">My Returns</h1>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="border rounded-lg p-5">
              <div className="flex justify-between">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-20" />
              </div>
              <Skeleton className="h-4 w-48 mt-3" />
            </div>
          ))}
        </div>
      ) : returns.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <RotateCcw className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <p className="text-lg font-medium">No returns</p>
          <p className="text-sm text-muted-foreground">You haven&apos;t requested any returns yet.</p>
          <Link href="/orders" className="text-primary hover:underline text-sm">View your orders</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {returns.map(ret => {
            const cfg = statusConfig[ret.status] || { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500" };
            return (
              <div key={ret.id} className="group border rounded-lg p-5 bg-card hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-sm">{ret.returnNumber}</span>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {ret.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <Link href={`/orders/${ret.orderId}`} className="flex items-center gap-1 text-sm text-primary hover:underline">
                    View Order <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="flex items-center gap-4 mt-2.5 text-sm text-muted-foreground">
                  <span className="capitalize">{ret.reason.replace(/_/g, " ")}</span>
                  <span>{format(new Date(ret.requestedAt), "MMM d, yyyy")}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
