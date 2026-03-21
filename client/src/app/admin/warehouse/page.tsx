"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  MapPin, Grid3X3, BarChart3, Plus, Pencil, Power, Loader2,
  ChevronDown, Package, ArrowRightLeft, ChevronRight,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

/* ---------- Types ---------- */

interface WarehouseLocation {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface WarehouseBin {
  id: string;
  binCode: string;
  locationId: string;
  locationName: string;
  description: string | null;
  isActive: boolean;
}

interface BinContent {
  productId: string;
  productName: string;
  partNumber: string;
  quantity: number;
}

interface OverviewStats {
  totalLocations: number;
  totalBins: number;
  totalProductsWithBins: number;
}

/* ---------- Helpers ---------- */

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
      active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-500" : "bg-gray-400"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

/* ---------- Location Dialog ---------- */

function LocationDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: WarehouseLocation | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setName(editing?.name || "");
      setDescription(editing?.description || "");
    }
  }, [open, editing]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return api(`/api/store/admin/warehouse/locations/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, description }),
        });
      }
      return api("/api/store/admin/warehouse/locations", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-locations"] });
      toast({ title: editing ? "Location updated" : "Location created" });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="bg-card border rounded-md p-6 w-full max-w-sm shadow-lg space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold">{editing ? "Edit Location" : "Add Location"}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Name</label>
            <input
              placeholder="e.g. Main Warehouse"
              className="w-full mt-1 border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Description</label>
            <input
              placeholder="Optional description"
              className="w-full mt-1 border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-accent transition-colors">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || mutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? "Saving..." : editing ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Bin Dialog ---------- */

function BinDialog({
  open,
  onClose,
  locations,
}: {
  open: boolean;
  onClose: () => void;
  locations: WarehouseLocation[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [locationId, setLocationId] = useState("");
  const [binCode, setBinCode] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setLocationId(locations[0]?.id || "");
      setBinCode("");
      setDescription("");
    }
  }, [open, locations]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const mutation = useMutation({
    mutationFn: async () => {
      return api("/api/store/admin/warehouse/bins", {
        method: "POST",
        body: JSON.stringify({ locationId, binCode, description }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-bins"] });
      toast({ title: "Bin created" });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="bg-card border rounded-md p-6 w-full max-w-sm shadow-lg space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold">Add Bin</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Location</label>
            <select
              className="w-full mt-1 border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              {locations.filter(l => l.isActive).map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Bin Code</label>
            <input
              placeholder="e.g. A-01-01"
              className="w-full mt-1 border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={binCode}
              onChange={(e) => setBinCode(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Description</label>
            <input
              placeholder="Optional description"
              className="w-full mt-1 border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-accent transition-colors">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!binCode.trim() || !locationId || mutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Locations Tab ---------- */

function LocationsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseLocation | null>(null);

  const { data: locations = [], isLoading } = useQuery<WarehouseLocation[]>({
    queryKey: ["warehouse-locations"],
    queryFn: () => api<WarehouseLocation[]>("/api/store/admin/warehouse/locations"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/store/admin/warehouse/locations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-locations"] });
      toast({ title: "Location deactivated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage warehouse storage locations</p>
        <button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Location
        </button>
      </div>

      <div className="border rounded-md bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Description</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="w-32 p-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
              ) : locations.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">No locations yet</td></tr>
              ) : locations.map((loc) => (
                <tr key={loc.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium">{loc.name}</td>
                  <td className="p-3 text-muted-foreground">{loc.description || "\u2014"}</td>
                  <td className="p-3"><StatusDot active={loc.isActive} /></td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => { setEditing(loc); setDialogOpen(true); }}
                        className="p-1.5 hover:bg-accent rounded transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </button>
                      {loc.isActive && (
                        <button
                          onClick={() => deactivateMutation.mutate(loc.id)}
                          disabled={deactivateMutation.isPending}
                          className="p-1.5 hover:bg-accent rounded transition-colors"
                          title="Deactivate"
                        >
                          <Power className="h-4 w-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <LocationDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editing={editing} />
    </div>
  );
}

/* ---------- Bins Tab ---------- */

function BinsTab() {
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [expandedBin, setExpandedBin] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: locations = [] } = useQuery<WarehouseLocation[]>({
    queryKey: ["warehouse-locations"],
    queryFn: () => api<WarehouseLocation[]>("/api/store/admin/warehouse/locations"),
  });

  const { data: bins = [], isLoading } = useQuery<WarehouseBin[]>({
    queryKey: ["warehouse-bins", locationFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (locationFilter !== "all") params.set("locationId", locationFilter);
      return api<WarehouseBin[]>(`/api/store/admin/warehouse/bins?${params}`);
    },
  });

  const { data: binContents, isLoading: contentsLoading } = useQuery<BinContent[]>({
    queryKey: ["warehouse-bin-contents", expandedBin],
    queryFn: () => api<BinContent[]>(`/api/store/admin/warehouse/bins/${expandedBin}/contents`),
    enabled: !!expandedBin,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">Manage storage bins</p>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Locations</option>
            {locations.filter(l => l.isActive).map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Bin
        </button>
      </div>

      <div className="border rounded-md bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="w-8 p-3"></th>
                <th className="text-left p-3 font-medium text-muted-foreground">Bin Code</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Location</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Description</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
              ) : bins.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No bins found</td></tr>
              ) : bins.map((bin) => (
                <>
                  <tr
                    key={bin.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setExpandedBin(expandedBin === bin.id ? null : bin.id)}
                  >
                    <td className="p-3">
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expandedBin === bin.id ? "rotate-90" : ""}`} />
                    </td>
                    <td className="p-3 font-mono text-xs font-semibold">{bin.binCode}</td>
                    <td className="p-3">{bin.locationName}</td>
                    <td className="p-3 text-muted-foreground">{bin.description || "\u2014"}</td>
                    <td className="p-3"><StatusDot active={bin.isActive} /></td>
                  </tr>
                  {expandedBin === bin.id && (
                    <tr key={`${bin.id}-contents`}>
                      <td colSpan={5} className="bg-muted/20 px-6 py-4">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Bin Contents</p>
                        {contentsLoading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading contents...
                          </div>
                        ) : !binContents || binContents.length === 0 ? (
                          <p className="text-sm text-muted-foreground">This bin is empty</p>
                        ) : (
                          <div className="space-y-1.5">
                            {binContents.map((item) => (
                              <div key={item.productId} className="flex items-center justify-between text-sm bg-card border rounded-lg px-3 py-2">
                                <div>
                                  <span className="font-medium">{item.productName}</span>
                                  <span className="text-muted-foreground ml-2 font-mono text-xs">{item.partNumber}</span>
                                </div>
                                <span className="font-semibold">{item.quantity}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <BinDialog open={dialogOpen} onClose={() => setDialogOpen(false)} locations={locations} />
    </div>
  );
}

/* ---------- Overview Tab ---------- */

function OverviewTab() {
  const { data: locations = [] } = useQuery<WarehouseLocation[]>({
    queryKey: ["warehouse-locations"],
    queryFn: () => api<WarehouseLocation[]>("/api/store/admin/warehouse/locations"),
  });

  const { data: bins = [] } = useQuery<WarehouseBin[]>({
    queryKey: ["warehouse-bins", "all"],
    queryFn: () => api<WarehouseBin[]>("/api/store/admin/warehouse/bins"),
  });

  const { data: stats } = useQuery<OverviewStats>({
    queryKey: ["warehouse-overview"],
    queryFn: () => api<OverviewStats>("/api/store/admin/warehouse/overview"),
  });

  const totalLocations = stats?.totalLocations ?? locations.length;
  const totalBins = stats?.totalBins ?? bins.length;
  const totalProducts = stats?.totalProductsWithBins ?? 0;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Warehouse summary and quick actions</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border rounded-md bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <MapPin className="h-4 w-4" />
            <span className="text-xs font-medium">Total Locations</span>
          </div>
          <p className="text-2xl font-bold">{totalLocations}</p>
        </div>
        <div className="border rounded-md bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Grid3X3 className="h-4 w-4" />
            <span className="text-xs font-medium">Total Bins</span>
          </div>
          <p className="text-2xl font-bold">{totalBins}</p>
        </div>
        <div className="border rounded-md bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Package className="h-4 w-4" />
            <span className="text-xs font-medium">Products with Bins</span>
          </div>
          <p className="text-2xl font-bold">{totalProducts}</p>
        </div>
      </div>

      <div className="border rounded-md bg-card p-5 space-y-3">
        <h3 className="font-semibold text-sm">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/warehouse/receive"
            className="inline-flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
          >
            <Package className="h-4 w-4 text-primary" /> Receive Stock
          </Link>
          <Link
            href="/admin/warehouse/movements"
            className="inline-flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
          >
            <ArrowRightLeft className="h-4 w-4 text-primary" /> Stock Movements
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------- Main Page ---------- */

export default function WarehouseDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Warehouse</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage locations, bins, and inventory storage</p>
      </div>

      <Tabs defaultValue="locations">
        <TabsList>
          <TabsTrigger value="locations" className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Locations
          </TabsTrigger>
          <TabsTrigger value="bins" className="gap-1.5">
            <Grid3X3 className="h-3.5 w-3.5" /> Bins
          </TabsTrigger>
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="locations">
          <LocationsTab />
        </TabsContent>
        <TabsContent value="bins">
          <BinsTab />
        </TabsContent>
        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
