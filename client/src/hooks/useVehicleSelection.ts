import { create } from "zustand";
import { persist } from "zustand/middleware";

interface VehicleSelectionState {
  make: string;
  model: string;
  year: number | null;
  setVehicle: (make: string, model: string, year: number) => void;
  clearVehicle: () => void;
}

export const useVehicleSelection = create<VehicleSelectionState>()(
  persist(
    (set) => ({
      make: "",
      model: "",
      year: null,
      setVehicle: (make, model, year) => set({ make, model, year }),
      clearVehicle: () => set({ make: "", model: "", year: null }),
    }),
    { name: "parts-store-vehicle" },
  ),
);

export function hasVehicleSelected(state: VehicleSelectionState): boolean {
  return !!(state.make && state.model && state.year);
}

export function vehicleLabel(state: VehicleSelectionState): string {
  if (!state.make || !state.model || !state.year) return "";
  return `${state.year} ${state.make} ${state.model}`;
}
