"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin } from "lucide-react";

interface AddressResult {
  address: string;
  parish: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  value?: string;
  onChange: (result: AddressResult) => void;
  onRawChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  onRawChange,
  placeholder = "Start typing an address...",
  className = "",
  disabled = false,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fallback, setFallback] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const handlePlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    if (!place?.geometry?.location) return;

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const address = place.formatted_address || "";

    let parish = "";
    for (const component of place.address_components || []) {
      if (
        component.types.includes("administrative_area_level_1") ||
        component.types.includes("administrative_area_level_2")
      ) {
        parish = component.long_name.replace(" Parish", "");
        break;
      }
    }

    onChange({ address, parish, lat, lng });
  }, [onChange]);

  useEffect(() => {
    if (!apiKey || !inputRef.current) {
      setFallback(true);
      return;
    }

    // Check if Google Maps is already loaded
    if (typeof google !== "undefined" && google.maps?.places) {
      initAutocomplete();
      return;
    }

    // Load Google Maps JS API via script tag
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener("load", initAutocomplete);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = initAutocomplete;
    script.onerror = () => setFallback(true);
    document.head.appendChild(script);

    function initAutocomplete() {
      if (!inputRef.current || typeof google === "undefined") {
        setFallback(true);
        return;
      }

      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: "jm" },
        fields: ["formatted_address", "geometry", "address_components"],
        types: ["address"],
      });

      autocomplete.addListener("place_changed", handlePlaceChanged);
      autocompleteRef.current = autocomplete;
      setLoaded(true);
    }

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [apiKey, handlePlaceChanged]);

  const baseClass =
    "w-full border rounded-md px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring";

  if (fallback) {
    return (
      <textarea
        rows={2}
        value={value}
        onChange={(e) => onRawChange?.(e.target.value)}
        placeholder="Full street address"
        className={`${baseClass} ${className}`}
        disabled={disabled}
      />
    );
  }

  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        defaultValue={value}
        placeholder={loaded ? placeholder : "Loading address lookup..."}
        className={`${baseClass} pl-9 ${className}`}
        disabled={disabled || (!loaded && !fallback)}
        onChange={(e) => onRawChange?.(e.target.value)}
      />
    </div>
  );
}
