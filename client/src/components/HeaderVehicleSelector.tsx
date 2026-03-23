"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { ChevronDown, Warehouse, Hash, X, Car, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useVehicleSelection, hasVehicleSelected, vehicleLabel } from "@/hooks/useVehicleSelection";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

interface SavedVehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  nickname: string | null;
  isDefault: boolean;
}

export function HeaderVehicleSelector() {
  const { isAuthenticated } = useAuth();
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [selectedMake, setSelectedMake] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [open, setOpen] = useState(false);
  const [vinMode, setVinMode] = useState(false);
  const [vinInput, setVinInput] = useState("");
  const [vinDecoding, setVinDecoding] = useState(false);
  const [vinError, setVinError] = useState("");
  const router = useRouter();

  const vehicleStore = useVehicleSelection();
  const hasVehicle = hasVehicleSelected(vehicleStore);
  const label = vehicleLabel(vehicleStore);

  // Fetch saved vehicles for logged-in users
  const { data: savedVehicles = [] } = useQuery<SavedVehicle[]>({
    queryKey: ["saved-vehicles"],
    queryFn: () => api("/api/store/vehicles"),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    api<string[]>("/api/store/catalog/makes").then(setMakes).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedMake) {
      api<string[]>(`/api/store/catalog/models?make=${encodeURIComponent(selectedMake)}`).then(setModels).catch(() => {});
      setSelectedModel("");
    }
  }, [selectedMake]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i);

  const handleFindParts = () => {
    if (selectedMake && selectedModel && selectedYear) {
      vehicleStore.setVehicle(selectedMake, selectedModel, parseInt(selectedYear));
      router.push(`/search?make=${encodeURIComponent(selectedMake)}&model=${encodeURIComponent(selectedModel)}&year=${selectedYear}`);
      setOpen(false);
    }
  };

  const handleSelectSaved = (v: SavedVehicle) => {
    vehicleStore.setVehicle(v.make, v.model, v.year);
    router.push(`/search?make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}&year=${v.year}`);
    setOpen(false);
  };

  const handleDecodeVin = async () => {
    const vin = vinInput.trim().toUpperCase();
    if (!vin || vin.length !== 17) {
      setVinError("Enter a 17-character VIN");
      return;
    }
    setVinError("");
    setVinDecoding(true);
    try {
      const decoded = await api<{ make: string; model: string; year: string }>(`/api/store/catalog/decode-vin/${encodeURIComponent(vin)}`);
      if (decoded?.make && decoded?.year) {
        vehicleStore.setVehicle(decoded.make, decoded.model || decoded.make, parseInt(decoded.year));
        router.push(
          `/search?make=${encodeURIComponent(decoded.make)}&model=${encodeURIComponent(decoded.model || decoded.make)}&year=${encodeURIComponent(decoded.year)}`
        );
        setOpen(false);
      } else {
        setVinError("Could not decode VIN");
      }
    } catch (err) {
      setVinError(err instanceof Error ? err.message : "Failed to decode VIN");
    } finally {
      setVinDecoding(false);
    }
  };

  const handleClearVehicle = (e: React.MouseEvent) => {
    e.stopPropagation();
    vehicleStore.clearVehicle();
    setSelectedMake("");
    setSelectedModel("");
    setSelectedYear("");
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[rgb(49,67,80)]"
        title="Shop by vehicle"
      >
        <Warehouse className="h-4 w-4 text-primary" />
        <div className="hidden lg:flex flex-col items-start leading-tight">
          <span className="text-[11px] text-[rgb(49,67,80)] font-normal">
            {savedVehicles.length > 0 ? "My Garage" : "Add Vehicle"}
          </span>
          <span className="text-[13px] font-semibold text-[rgb(49,67,80)] max-w-[140px] truncate">
            {hasVehicle ? label : savedVehicles.length > 0 ? `${savedVehicles.length} vehicle${savedVehicles.length > 1 ? "s" : ""}` : "My Garage"}
          </span>
        </div>
        {hasVehicle ? (
          <X className="h-3.5 w-3.5 text-slate-400 hover:text-foreground" onClick={handleClearVehicle} />
        ) : (
          <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-card border rounded-lg shadow-xl overflow-hidden">
            {/* Saved vehicles section */}
            {savedVehicles.length > 0 && (
              <div className="p-3 border-b">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Saved Vehicles</p>
                <div className="space-y-1">
                  {savedVehicles.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => handleSelectSaved(v)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left transition-colors ${
                        hasVehicle && vehicleStore.make === v.make && vehicleStore.model === v.model && vehicleStore.year === v.year
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-accent"
                      }`}
                    >
                      <Car className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {v.year} {v.make} {v.model}
                        {v.nickname && <span className="text-muted-foreground"> — {v.nickname}</span>}
                      </span>
                    </button>
                  ))}
                </div>
                <Link
                  href="/account?tab=garage"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-1.5 mt-2 px-3 py-1.5 text-xs text-primary hover:underline font-medium"
                >
                  <Plus className="h-3 w-3" />
                  Manage Garage
                </Link>
              </div>
            )}

            {/* Manual vehicle selection */}
            <div className="p-4">
              <p className="text-sm font-semibold mb-3">
                {savedVehicles.length > 0 ? "Or search manually" : "Find parts for your vehicle"}
              </p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => { setVinMode(!vinMode); setVinError(""); setVinInput(""); }}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                >
                  <Hash className="h-3 w-3" />
                  {vinMode ? "Use make/model/year" : "Decode from VIN"}
                </button>

                {vinMode ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Enter 17-character VIN"
                      maxLength={17}
                      value={vinInput}
                      onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                      className="w-full border rounded-md px-3 py-2.5 text-sm font-mono uppercase bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {vinError && <p className="text-xs text-destructive">{vinError}</p>}
                    <button
                      type="button"
                      onClick={handleDecodeVin}
                      disabled={vinDecoding || vinInput.trim().length !== 17}
                      className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
                    >
                      {vinDecoding ? "Decoding..." : "Decode & Find Parts"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <select
                      className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      value={selectedMake}
                      onChange={(e) => setSelectedMake(e.target.value)}
                    >
                      <option value="">Select Make</option>
                      {makes.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select
                      className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={!selectedMake}
                    >
                      <option value="">Select Model</option>
                      {models.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select
                      className="w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                    >
                      <option value="">Select Year</option>
                      {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button
                      onClick={handleFindParts}
                      disabled={!selectedMake || !selectedModel || !selectedYear}
                      className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
                    >
                      Find Parts
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
