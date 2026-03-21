"use client";
import { VehicleSelector } from "@/components/VehicleSelector";
import { useRouter } from "next/navigation";
import { useVehicleSelection } from "@/hooks/useVehicleSelection";

export function HomeClient() {
  const router = useRouter();
  const { setVehicle } = useVehicleSelection();

  return (
    <div className="max-w-xl">
      <VehicleSelector
        variant="hero"
        onSelect={(make, model, year) => {
          setVehicle(make, model, year);
          router.push(`/search?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${year}`);
        }}
      />
    </div>
  );
}
