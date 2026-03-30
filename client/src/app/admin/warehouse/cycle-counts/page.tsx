"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface WarehouseLocation {
  id: string;
  name: string;
  isActive: boolean;
}

interface CycleCount {
  id: string;
  locationId: string;
  locationName: string | null;
  status: string;
  startedBy: string | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string | null;
  itemCount: number;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  pending: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  in_progress: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  completed: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
};

export default function CycleCountsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState("");

  const { data: locations = [] } = useQuery<WarehouseLocation[]>({
    queryKey: ["warehouse-locations"],
    queryFn: () => api<WarehouseLocation[]>("/api/store/admin/warehouse/locations"),
  });

  const { data: cycleCounts = [], isLoading } = useQuery<CycleCount[]>({
    queryKey: ["warehouse-cycle-counts"],
    queryFn: () => api<CycleCount[]>("/api/store/admin/warehouse/cycle-counts"),
  });

  useEffect(() => {
    if (!dialogOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDialogOpen(false); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [dialogOpen]);

  const createMutation = useMutation({
    mutationFn: () =>
      api("/api/store/admin/warehouse/cycle-counts", {
        method: "POST",
        body: JSON.stringify({ locationId: selectedLocationId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-cycle-counts"] });
      toast({ title: "Cycle count created" });
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const activeLocations = locations.filter((l) => l.isActive);

  return (
    <div className="space-y-6">
      <Link href="/admin/warehouse" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Warehouse
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cycle Counts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Verify physical stock against system records</p>
        </div>
        <button
          onClick={() => { setSelectedLocationId(activeLocations[0]?.id || ""); setDialogOpen(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Cycle Count
        </button>
      </div>

      <div className="border rounded-md bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium text-muted-foreground">ID</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Location</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Items</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
              ) : cycleCounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <ClipboardCheck className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-muted-foreground">No cycle counts yet</p>
                  </td>
                </tr>
              ) : cycleCounts.map((cc) => {
                const cfg = statusConfig[cc.status] || statusConfig.pending;
                return (
                  <tr key={cc.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <Link href={`/admin/warehouse/cycle-counts/${cc.id}`} className="text-primary hover:underline font-mono text-xs">
                        {cc.id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="p-3 font-medium">{cc.locationName || "Unknown"}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cc.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-3 text-right">{cc.itemCount}</td>
                    <td className="p-3 text-muted-foreground">
                      {cc.createdAt ? format(new Date(cc.createdAt), "MMM d, yyyy") : "\u2014"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDialogOpen(false)}>
          <div role="dialog" aria-modal="true" className="bg-card border rounded-md p-6 w-full max-w-sm shadow-lg space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">New Cycle Count</h3>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Location</label>
              <select
                className="w-full mt-1 border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
              >
                {activeLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1.5">All bin assignments in this location will be included.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDialogOpen(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-accent transition-colors">Cancel</button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!selectedLocationId || createMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
