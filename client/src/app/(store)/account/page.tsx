"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
import { Loader2, User, MapPin, Lock, CheckCircle2, AlertCircle, Package, RotateCcw, ChevronRight } from "lucide-react";
import Link from "next/link";

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

export default function AccountPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();

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

      <Tabs defaultValue="profile">
        <TabsList className="w-full">
          <TabsTrigger value="profile" className="flex-1 gap-1.5">
            <User className="h-4 w-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="address" className="flex-1 gap-1.5">
            <MapPin className="h-4 w-4" /> Address
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

        <TabsContent value="password">
          <div className="border rounded-xl bg-card p-6 mt-4">
            <PasswordTab />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
