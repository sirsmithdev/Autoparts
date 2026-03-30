"use client";
import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, User, MapPin, Lock, CheckCircle2, AlertCircle, Package, RotateCcw, ChevronRight, Car, Plus, Trash2, Star } from "lucide-react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useVehicleSelection } from "@/hooks/useVehicleSelection";

const JAMAICA_PARISHES = [
  "Kingston", "St. Andrew", "St. Thomas", "Portland", "St. Mary",
  "St. Ann", "Trelawny", "St. James", "Hanover", "Westmoreland",
  "St. Elizabeth", "Manchester", "Clarendon", "St. Catherine",
];

function ProfileTab() {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await api("/api/store/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ firstName, lastName, phone: phone || null }),
      });
      setSuccess("Profile updated successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <div>
        <label className="text-sm font-medium block mb-1.5">Email</label>
        <input
          type="email"
          disabled
          className="w-full border rounded-lg px-3 py-2.5 text-sm bg-muted text-muted-foreground cursor-not-allowed"
          value={user?.email || ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1.5">First Name</label>
          <input
            type="text"
            required
            className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">Last Name</label>
          <input
            type="text"
            required
            className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1.5">Phone</label>
        <input
          type="tel"
          className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="876-555-1234"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
      >
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Save Profile"}
      </button>
    </form>
  );
}

function AddressTab() {
  const [address, setAddress] = useState("");
  const [parish, setParish] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api<{ address?: string; parish?: string }>("/api/store/auth/me")
      .then(data => {
        setAddress(data.address || "");
        setParish(data.parish || "");
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await api("/api/store/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ address: address || null, parish: parish || null }),
      });
      setSuccess("Address updated successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update address");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <div>
        <label className="text-sm font-medium block mb-1.5">Address</label>
        <textarea
          className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          rows={3}
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="Enter your full street address"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1.5">Parish</label>
        <select
          className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          value={parish}
          onChange={e => setParish(e.target.value)}
        >
          <option value="">Select parish</option>
          {JAMAICA_PARISHES.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
      >
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Save Address"}
      </button>
    </form>
  );
}

function PasswordTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSaving(true);
    try {
      await api("/api/store/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: currentPassword || undefined, newPassword }),
      });
      setSuccess("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <div>
        <label className="text-sm font-medium block mb-1.5">
          Current Password <span className="text-muted-foreground font-normal">(leave blank if setting for first time)</span>
        </label>
        <input
          type="password"
          className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
          placeholder="Enter current password"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1.5">New Password</label>
        <input
          type="password"
          required
          minLength={8}
          className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1.5">Confirm New Password</label>
        <input
          type="password"
          required
          minLength={8}
          className="w-full border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder="Re-enter new password"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
      >
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : "Update Password"}
      </button>
    </form>
  );
}

interface SavedVehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  nickname: string | null;
  isDefault: boolean;
}

function GarageTab() {
  const queryClient = useQueryClient();
  const vehicleStore = useVehicleSelection();
  const [adding, setAdding] = useState(false);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [nickname, setNickname] = useState("");
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);

  const { data: vehicles = [], isLoading } = useQuery<SavedVehicle[]>({
    queryKey: ["saved-vehicles"],
    queryFn: () => api("/api/store/vehicles"),
  });

  useEffect(() => {
    api<string[]>("/api/store/catalog/makes").then(setMakes).catch(() => {});
  }, []);

  useEffect(() => {
    if (make) {
      api<string[]>(`/api/store/catalog/models?make=${encodeURIComponent(make)}`).then(setModels).catch(() => {});
      setModel("");
    }
  }, [make]);

  const addMutation = useMutation({
    mutationFn: (body: { make: string; model: string; year: number; nickname?: string }) =>
      api("/api/store/vehicles", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-vehicles"] });
      setAdding(false);
      setMake("");
      setModel("");
      setYear("");
      setNickname("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/store/vehicles/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-vehicles"] }),
  });

  const defaultMutation = useMutation({
    mutationFn: (id: string) => api(`/api/store/vehicles/${id}/default`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-vehicles"] }),
  });

  const handleSelectVehicle = (v: SavedVehicle) => {
    vehicleStore.setVehicle(v.make, v.model, v.year);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {vehicles.length === 0 && !adding && (
        <div className="text-center py-8 space-y-3">
          <Car className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">No saved vehicles yet. Add your first vehicle to quickly find compatible parts.</p>
        </div>
      )}

      {/* Vehicle list */}
      {vehicles.map((v) => (
        <div
          key={v.id}
          className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
            v.isDefault ? "border-primary/30 bg-primary/5" : "bg-card hover:border-muted-foreground/30"
          }`}
        >
          <div className="flex items-center gap-3">
            <Car className={`h-5 w-5 shrink-0 ${v.isDefault ? "text-primary" : "text-muted-foreground"}`} />
            <div>
              <p className="font-medium text-sm">
                {v.year} {v.make} {v.model}
                {v.isDefault && <span className="ml-2 text-xs text-primary font-semibold">(Default)</span>}
              </p>
              {v.nickname && <p className="text-xs text-muted-foreground">{v.nickname}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleSelectVehicle(v)}
              className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-md hover:bg-primary/10 transition-colors"
            >
              Shop Parts
            </button>
            {!v.isDefault && (
              <button
                onClick={() => defaultMutation.mutate(v.id)}
                className="p-1.5 text-muted-foreground hover:text-primary rounded transition-colors"
                title="Set as default"
              >
                <Star className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => {
                if (window.confirm(`Remove ${v.year} ${v.make} ${v.model}?`)) {
                  deleteMutation.mutate(v.id);
                }
              }}
              className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors"
              title="Remove vehicle"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

      {/* Add vehicle form */}
      {adding ? (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-3 gap-3">
            <select
              className="border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={make}
              onChange={(e) => setMake(e.target.value)}
            >
              <option value="">Make</option>
              {makes.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              className="border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={!make}
            >
              <option value="">Model</option>
              {models.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              className="border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              <option value="">Year</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <input
            type="text"
            placeholder="Nickname (optional, e.g. 'My Corolla')"
            className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!make || !model || !year) return;
                addMutation.mutate({ make, model, year: parseInt(year), nickname: nickname || undefined });
              }}
              disabled={!make || !model || !year || addMutation.isPending}
              className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {addMutation.isPending ? "Saving..." : "Save Vehicle"}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Vehicle
        </button>
      )}
    </div>
  );
}

function AccountPageInner() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "profile";

  useEffect(() => { if (!authLoading && !isAuthenticated) router.replace("/login?redirect=/account"); }, [authLoading, isAuthenticated, router]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Account" }]} />

      <div>
        <h1 className="text-2xl font-bold">My Account</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your profile, address, and password
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/orders"
          className="flex items-center justify-between p-4 border rounded-lg bg-card hover:shadow-md hover:border-primary/20 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Package className="h-4.5 w-4.5 text-primary" />
            </div>
            <span className="text-sm font-semibold">My Orders</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link
          href="/returns"
          className="flex items-center justify-between p-4 border rounded-lg bg-card hover:shadow-md hover:border-primary/20 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <RotateCcw className="h-4.5 w-4.5 text-primary" />
            </div>
            <span className="text-sm font-semibold">My Returns</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList className="w-full">
          <TabsTrigger value="profile" className="flex-1 gap-1.5">
            <User className="h-4 w-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="address" className="flex-1 gap-1.5">
            <MapPin className="h-4 w-4" /> Address
          </TabsTrigger>
          <TabsTrigger value="garage" className="flex-1 gap-1.5">
            <Car className="h-4 w-4" /> My Garage
          </TabsTrigger>
          <TabsTrigger value="password" className="flex-1 gap-1.5">
            <Lock className="h-4 w-4" /> Password
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="border rounded-xl bg-card p-6 mt-4">
            <ProfileTab />
          </div>
        </TabsContent>

        <TabsContent value="address">
          <div className="border rounded-xl bg-card p-6 mt-4">
            <AddressTab />
          </div>
        </TabsContent>

        <TabsContent value="garage">
          <div className="border rounded-xl bg-card p-6 mt-4">
            <GarageTab />
          </div>
        </TabsContent>

        <TabsContent value="password">
          <div className="border rounded-xl bg-card p-6 mt-4">
            <PasswordTab />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" /></div>}>
      <AccountPageInner />
    </Suspense>
  );
}
