"use client";
import { VehicleSelector } from "@/components/VehicleSelector";
import { useRouter } from "next/navigation";
import { useVehicleSelection } from "@/hooks/useVehicleSelection";

export function HomeClient({ variant }: { variant?: "inline" }) {
  const router = useRouter();
  const { setVehicle } = useVehicleSelection();

  return (
    <div className={variant === "inline" ? "" : "max-w-xl"}>
      <VehicleSelector
        variant={variant === "inline" ? "hero" : "hero"}
        onSelect={(make, model, year) => {
          setVehicle(make, model, year);
          router.push(`/search?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${year}`);
        }}
      />
    </div>
  );
}
