import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

const statusConfig = {
  in_stock: { label: "In Stock", icon: CheckCircle2, className: "bg-green-50 text-green-700 border-green-200" },
  low_stock: { label: "Low Stock", icon: AlertTriangle, className: "bg-amber-50 text-amber-700 border-amber-200" },
  out_of_stock: { label: "Out of Stock", icon: XCircle, className: "bg-red-50 text-red-700 border-red-200" },
};

export function StockBadge({ status }: { status: string }) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.out_of_stock;
  const Icon = config.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border", config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
