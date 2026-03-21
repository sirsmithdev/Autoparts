"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { ChevronDown, Car, Hash, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useVehicleSelection, hasVehicleSelected, vehicleLabel } from "@/hooks/useVehicleSelection";

export function HeaderVehicleSelector() {
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
        className="flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors bg-white/10 hover:bg-white/15 text-gray-200 hover:text-white"
        title="Shop by vehicle"
      >
        <Car className="h-4 w-4" />
        <span className="hidden lg:inline max-w-[160px] truncate">
          {hasVehicle ? label : "Select Vehicle"}
        </span>
        {hasVehicle ? (
          <X className="h-3.5 w-3.5 text-gray-400 hover:text-white" onClick={handleClearVehicle} />
        ) : (
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 p-5 bg-card border rounded-lg shadow-xl">
            <p className="text-sm font-semibold mb-3">Find parts for your vehicle</p>
            <div className="space-y-3">
              {/* Mode toggle */}
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
        </>
      )}
    </div>
  );
}
