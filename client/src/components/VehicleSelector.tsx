"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Hash, Car, Search } from "lucide-react";

interface VehicleSelectorProps {
  onSelect: (make: string, model: string, year: number) => void;
  className?: string;
  variant?: "default" | "hero";
}

export function VehicleSelector({ onSelect, className, variant = "default" }: VehicleSelectorProps) {
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [selectedMake, setSelectedMake] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [vinMode, setVinMode] = useState(false);
  const [vinInput, setVinInput] = useState("");
  const [vinDecoding, setVinDecoding] = useState(false);
  const [vinError, setVinError] = useState("");

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
  const years = Array.from({ length: 40 }, (_, i) => currentYear - i);

  const handleSearch = () => {
    if (selectedMake && selectedModel && selectedYear) {
      onSelect(selectedMake, selectedModel, parseInt(selectedYear));
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
        onSelect(decoded.make, decoded.model || decoded.make, parseInt(decoded.year));
      } else {
        setVinError("Could not decode VIN");
      }
    } catch (err) {
      setVinError(err instanceof Error ? err.message : "Failed to decode VIN");
    } finally {
      setVinDecoding(false);
    }
  };

  const isHero = variant === "hero";
  const selectClass = isHero
    ? "w-full border border-white/20 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
    : "w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className={className || ""}>
      {/* Mode tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => { setVinMode(false); setVinError(""); }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            !vinMode
              ? "bg-primary text-primary-foreground"
              : isHero ? "bg-white/20 text-white hover:bg-white/30" : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          <Car className="h-4 w-4" />
          By Vehicle
        </button>
        <button
          type="button"
          onClick={() => { setVinMode(true); setVinError(""); }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            vinMode
              ? "bg-primary text-primary-foreground"
              : isHero ? "bg-white/20 text-white hover:bg-white/30" : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          <Hash className="h-4 w-4" />
          By VIN
        </button>
      </div>

      {vinMode ? (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Enter 17-character VIN"
              maxLength={17}
              value={vinInput}
              onChange={(e) => setVinInput(e.target.value.toUpperCase())}
              className={`${selectClass} font-mono uppercase`}
            />
            {vinError && <p className="text-xs text-destructive mt-1.5">{vinError}</p>}
          </div>
          <button
            onClick={handleDecodeVin}
            disabled={vinDecoding || vinInput.trim().length !== 17}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center gap-2 justify-center"
          >
            <Search className="h-4 w-4" />
            {vinDecoding ? "Decoding..." : "Find Parts"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 min-w-0">
            <select className={selectClass} value={selectedMake} onChange={e => setSelectedMake(e.target.value)}>
              <option value="">Select Make</option>
              {makes.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-0">
            <select className={selectClass} value={selectedModel} onChange={e => setSelectedModel(e.target.value)} disabled={!selectedMake}>
              <option value="">Select Model</option>
              {models.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="w-full sm:w-28">
            <select className={selectClass} value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
              <option value="">Year</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button
            onClick={handleSearch}
            disabled={!selectedMake || !selectedModel || !selectedYear}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center gap-2 justify-center"
          >
            <Search className="h-4 w-4" />
            Find Parts
          </button>
        </div>
      )}
    </div>
  );
}
