"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  MapPin, Plus, Pencil, Trash2, Loader2,
  AlertTriangle, Package, ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

/* ---------- Types ---------- */

interface StoreSettings {
  id: number;
  taxRate: string;
  taxName: string;
  currency: string;
  currencySymbol: string;
  returnWindowDays: number;
  defectiveReturnWindowDays: number;
  restockingFeePercent: string;
  electricalPartsReturnPolicy: string | null;
  maxQuantityPerItem: number;
  maxItemsPerOrder: number;
  cartExpirationDays: number;
  updatedAt: string;
}

interface DeliveryZone {
  id: string;
  name: string;
  parishes: string[];
  deliveryFee: string;
  oversizedSurcharge: string;
  estimatedDays: number;
  isActive: boolean;
  sortOrder: number;
}

interface DeliveryZoneForm {
  name: string;
  parishes: string;
  deliveryFee: string;
  isActive: boolean;
}

const emptyZoneForm: DeliveryZoneForm = {
  name: "",
  parishes: "",
  deliveryFee: "0",
  isActive: true,
};

/* ---------- Component ---------- */

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  /* ---- Store Settings ---- */

  const { data: settings, isLoading: settingsLoading } = useQuery<StoreSettings>({
    queryKey: ["admin-store-settings"],
    queryFn: () => api<StoreSettings>("/api/store/admin/settings"),
  });

  const { register, handleSubmit } = useForm<Partial<StoreSettings>>({
    values: settings || undefined,
  });

  const policyMutation = useMutation({
    mutationFn: (data: Partial<StoreSettings>) =>
      api("/api/store/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-store-settings"] });
      toast({ title: "Settings saved successfully" });
    },
  });

  /* ---- Delivery Zones ---- */

  const { data: zones, isLoading: zonesLoading } = useQuery<DeliveryZone[]>({
    queryKey: ["admin-delivery-zones"],
    queryFn: () => api<DeliveryZone[]>("/api/store/admin/delivery-zones"),
  });

  const [zoneDialog, setZoneDialog] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [zoneForm, setZoneForm] = useState<DeliveryZoneForm>(emptyZoneForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Close dialogs on Escape
  const closeDialogs = useCallback(() => { setZoneDialog(false); setDeleteConfirm(null); }, []);
  useEffect(() => {
    if (!zoneDialog && !deleteConfirm) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeDialogs(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [zoneDialog, deleteConfirm, closeDialogs]);

  const openNewZone = () => {
    setEditingZone(null);
    setZoneForm(emptyZoneForm);
    setZoneDialog(true);
  };

  const openEditZone = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setZoneForm({
      name: zone.name,
      parishes: zone.parishes.join(", "),
      deliveryFee: zone.deliveryFee,
      isActive: zone.isActive,
    });
    setZoneDialog(true);
  };

  const zoneSaveMutation = useMutation({
    mutationFn: (data: { id?: string; form: DeliveryZoneForm }) => {
      const body = {
        name: data.form.name,
        parishes: data.form.parishes.split(",").map((p) => p.trim()).filter(Boolean),
        deliveryFee: data.form.deliveryFee,
        isActive: data.form.isActive,
      };
      if (data.id) {
        return api(`/api/store/admin/delivery-zones/${data.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }
      return api("/api/store/admin/delivery-zones", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-delivery-zones"] });
      setZoneDialog(false);
    },
  });

  const zoneDeleteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/store/admin/delivery-zones/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-delivery-zones"] });
      setDeleteConfirm(null);
    },
  });

  const zoneToggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api(`/api/store/admin/delivery-zones/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-delivery-zones"] });
    },
  });

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Store Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure your online parts store</p>
      </div>

      {/* ---- Return Policy & Order Limits ---- */}
      <form onSubmit={handleSubmit((data) => policyMutation.mutate(data))} className="space-y-6">
        <div className="border rounded-md bg-card">
          <div className="p-5 border-b">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              <div>
                <h2 className="font-semibold">Return Policy</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Configure return windows and fees</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4 max-w-2xl">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium block">Standard Return Window (days)</label>
                <input
                  type="number"
                  {...register("returnWindowDays", { valueAsNumber: true })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium block">Defective Return Window (days)</label>
                <input
                  type="number"
                  {...register("defectiveReturnWindowDays", { valueAsNumber: true })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium block">Restocking Fee (%)</label>
              <input
                type="number"
                step="0.01"
                {...register("restockingFeePercent")}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">Applied to non-defective returns. Defective/wrong parts are 0%.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium block">Electrical Parts Return Policy</label>
              <textarea
                {...register("electricalPartsReturnPolicy")}
                placeholder="e.g., Electrical parts: exchange or store credit only, no cash refund"
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          </div>
        </div>

        <div className="border rounded-md bg-card">
          <div className="p-5 border-b">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <h2 className="font-semibold">Cart & Order Limits</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Prevent abuse and manage capacity</p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4 max-w-2xl">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium block">Max Qty Per Item</label>
                <input
                  type="number"
                  {...register("maxQuantityPerItem", { valueAsNumber: true })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium block">Max Items Per Order</label>
                <input
                  type="number"
                  {...register("maxItemsPerOrder", { valueAsNumber: true })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium block">Cart Expiry (days)</label>
                <input
                  type="number"
                  {...register("cartExpirationDays", { valueAsNumber: true })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border rounded-md bg-card">
          <div className="p-5 border-b">
            <h2 className="font-semibold">Currency</h2>
          </div>
          <div className="p-5 max-w-2xl">
            <div className="space-y-1.5">
              <label className="text-sm font-medium block">Store Currency</label>
              <input
                {...register("currency")}
                maxLength={3}
                className="w-24 border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">ISO 4217 code (JMD, USD, etc.)</p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={policyMutation.isPending}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
        >
          {policyMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Policy & Limits
        </button>
      </form>

      {/* ---- Delivery Zones ---- */}
      <div className="border rounded-md bg-card">
        <div className="p-5 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="font-semibold">Delivery Zones</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Configure delivery areas, fees, and free delivery thresholds</p>
            </div>
          </div>
          <button
            onClick={openNewZone}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Zone
          </button>
        </div>
        <div className="overflow-x-auto">
          {zonesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-3 font-medium text-muted-foreground">Zone Name</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Parishes</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Delivery Fee</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Active</th>
                  <th className="w-20 p-3"></th>
                </tr>
              </thead>
              <tbody>
                {(!zones || zones.length === 0) ? (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No delivery zones configured</td></tr>
                ) : zones.map((zone) => (
                  <tr key={zone.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium">{zone.name}</td>
                    <td className="p-3">
                      <div className="flex gap-1 flex-wrap">
                        {zone.parishes.map((p) => (
                          <span key={p} className="text-xs bg-muted px-2 py-0.5 rounded-full">{p}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-right font-medium">{formatPrice(zone.deliveryFee)}</td>
                    <td className="p-3 text-center">
                      <button
                        role="switch"
                        aria-checked={zone.isActive}
                        onClick={() => zoneToggleMutation.mutate({ id: zone.id, isActive: !zone.isActive })}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          zone.isActive ? "bg-primary" : "bg-gray-300"
                        }`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          zone.isActive ? "translate-x-[1.125rem]" : "translate-x-[0.125rem]"
                        }`} />
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => openEditZone(zone)}
                          className="p-1.5 hover:bg-accent rounded transition-colors"
                          title="Edit zone"
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(zone.id)}
                          className="p-1.5 hover:bg-red-50 rounded transition-colors"
                          title="Delete zone"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ---- Zone Create/Edit Dialog ---- */}
      {zoneDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setZoneDialog(false)} />
          <div role="dialog" aria-modal="true" className="relative bg-card border rounded-md shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editingZone ? "Edit Delivery Zone" : "Add Delivery Zone"}
            </h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium block">Zone Name</label>
                <input
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Kingston Metro"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium block">Parishes</label>
                <input
                  value={zoneForm.parishes}
                  onChange={(e) => setZoneForm((f) => ({ ...f, parishes: e.target.value }))}
                  placeholder="Kingston, St. Andrew, St. Catherine"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground">Comma-separated list of parishes</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium block">Delivery Fee ($)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={zoneForm.deliveryFee}
                  onChange={(e) => setZoneForm((f) => ({ ...f, deliveryFee: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={zoneForm.isActive}
                  onClick={() => setZoneForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    zoneForm.isActive ? "bg-primary" : "bg-gray-300"
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    zoneForm.isActive ? "translate-x-[1.125rem]" : "translate-x-[0.125rem]"
                  }`} />
                </button>
                <label className="text-sm font-medium">Active</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setZoneDialog(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => zoneSaveMutation.mutate({ id: editingZone?.id, form: zoneForm })}
                disabled={!zoneForm.name || !zoneForm.parishes || zoneSaveMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {zoneSaveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingZone ? "Update Zone" : "Create Zone"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Delete Confirmation Dialog ---- */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div role="dialog" aria-modal="true" className="relative bg-card border rounded-md shadow-lg w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold">Delete Delivery Zone</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this delivery zone? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteConfirm && zoneDeleteMutation.mutate(deleteConfirm)}
                disabled={zoneDeleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {zoneDeleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
