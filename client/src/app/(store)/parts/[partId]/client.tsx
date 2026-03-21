"use client";
import { StockBadge } from "@/components/StockBadge";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { formatPrice } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useGuestCart } from "@/hooks/useCart";
import { useVehicleSelection, hasVehicleSelected } from "@/hooks/useVehicleSelection";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  ShoppingCart, Package, RefreshCw, CheckCircle2, Loader2,
  Minus, Plus, Car, Info, ChevronDown, ChevronUp, AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface PartDetail {
  part: { id: string; name: string; partNumber: string; salePrice: string; description?: string | null; longDescription?: string | null; manufacturer?: string | null; category?: string | null; imageUrl?: string | null; stockStatus: string; condition?: string; isOversized?: boolean };
  partNumbers: Array<{ id: string; partNumber: string; numberType: string; brand?: string | null; isPrimary: boolean }>;
  compatibility: Array<{ id: string; make: string; model: string; yearStart: number; yearEnd: number; trim?: string | null; engineType?: string | null; source?: string }>;
  images: Array<{ id: string; imageUrl: string; altText?: string | null; isPrimary: boolean }>;
}

export function PartDetailClient({ detail }: { detail: PartDetail }) {
  const { part, partNumbers, compatibility, images } = detail;
  const partNumbersSafe = Array.isArray(partNumbers) ? partNumbers : [];
  const compatibilitySafe = Array.isArray(compatibility) ? compatibility : [];
  const imagesSafe = Array.isArray(images) ? images : [];
  const { isAuthenticated } = useAuth();
  const vehicle = useVehicleSelection();
  const hasVehicle = hasVehicleSelected(vehicle);

  const oemNumbers = partNumbersSafe.filter((pn) => pn.numberType === "oem");
  const aftermarketNumbers = partNumbersSafe.filter((pn) => pn.numberType === "aftermarket");
  const otherOemNumbers = partNumbersSafe.filter((pn) => pn.numberType === "interchange");
  const addGuestItem = useGuestCart((s) => s.addGuestItem);
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [activeTab, setActiveTab] = useState<"description" | "compatibility">("description");
  const [showAllCompat, setShowAllCompat] = useState(false);

  const allImages = imagesSafe.length > 0 ? imagesSafe : part.imageUrl ? [{ id: "main", imageUrl: part.imageUrl, altText: part.name, isPrimary: true }] : [];

  // Check if selected vehicle fits this part
  const vehicleFits = hasVehicle && compatibilitySafe.some(vc =>
    vc.make.toLowerCase() === vehicle.make.toLowerCase() &&
    vc.model.toLowerCase() === vehicle.model.toLowerCase() &&
    vehicle.year !== null && vehicle.year >= vc.yearStart && vehicle.year <= vc.yearEnd
  );

  const [addingToCart, setAddingToCart] = useState(false);
  const [addError, setAddError] = useState("");

  const handleAddToCart = async () => {
    if (part.stockStatus === "out_of_stock" || addingToCart) return;
    setAddError("");
    try {
      setAddingToCart(true);
      if (isAuthenticated) {
        await api("/api/store/cart/items", { method: "POST", body: JSON.stringify({ partId: part.id, quantity }) });
        queryClient.invalidateQueries({ queryKey: ["server-cart"] });
      } else {
        addGuestItem({ partId: part.id, quantity, name: part.name, partNumber: part.partNumber, salePrice: part.salePrice, imageUrl: part.imageUrl });
      }
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add to cart");
    } finally {
      setAddingToCart(false);
    }
  };

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Search", href: "/search" },
    ...(part.category ? [{ label: part.category, href: `/search?category=${encodeURIComponent(part.category)}` }] : []),
    { label: part.name },
  ];

  const displayedCompat = showAllCompat ? compatibilitySafe : compatibilitySafe.slice(0, 8);
  const hasTabContent = {
    description: !!(part.description || part.longDescription),
    compatibility: compatibilitySafe.length > 0 || aftermarketNumbers.length > 0 || otherOemNumbers.length > 0,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <Breadcrumbs items={breadcrumbs} />

      {/* Fitment Banner */}
      {hasVehicle && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${
          vehicleFits
            ? "bg-green-50 text-green-800 border border-green-200"
            : "bg-amber-50 text-amber-800 border border-amber-200"
        }`}>
          <Car className="h-4 w-4 shrink-0" />
          {vehicleFits
            ? `This part fits your ${vehicle.year} ${vehicle.make} ${vehicle.model}`
            : `Fitment not confirmed for your ${vehicle.year} ${vehicle.make} ${vehicle.model}`
          }
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Images */}
        <div className="space-y-3">
          <div className="aspect-square bg-muted rounded-xl overflow-hidden flex items-center justify-center border">
            {allImages[activeImage] ? (
              <img
                src={allImages[activeImage].imageUrl}
                alt={allImages[activeImage].altText || part.name}
                className="object-contain w-full h-full p-4"
              />
            ) : (
              <div className="text-muted-foreground/20">
                <Package className="h-24 w-24" />
              </div>
            )}
          </div>
          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {allImages.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(i)}
                  className={`w-16 h-16 border-2 rounded-lg shrink-0 overflow-hidden transition-colors ${
                    i === activeImage ? "border-primary" : "border-transparent hover:border-muted-foreground/30"
                  }`}
                >
                  <img src={img.imageUrl} alt={img.altText || ""} className="object-cover w-full h-full" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-5">
          {part.manufacturer && (
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">{part.manufacturer}</p>
          )}
          {part.category && (
            <Link href={`/search?category=${encodeURIComponent(part.category)}`} className="text-xs text-muted-foreground hover:text-primary transition-colors">
              {part.category}
            </Link>
          )}
          <h1 className="text-2xl lg:text-3xl font-bold leading-tight">{part.name}</h1>

          {/* Part Numbers */}
          <div className="space-y-1">
            <p className="text-sm font-mono text-muted-foreground">
              {part.partNumber} <span className="text-muted-foreground/50">(primary)</span>
            </p>
            {oemNumbers.length > 0 && (
              <p className="text-sm">
                <span className="font-medium">OEM:</span>{" "}
                <span className="font-mono text-muted-foreground">
                  {oemNumbers.map((pn) => `${pn.partNumber}${pn.brand ? ` (${pn.brand})` : ""}`).join(", ")}
                </span>
              </p>
            )}
          </div>

          {/* Price + Stock */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-3xl font-bold">{formatPrice(part.salePrice)}</span>
            <StockBadge status={part.stockStatus} />
            {part.condition && part.condition !== "new" && (
              <span className="text-xs font-medium border px-2.5 py-1 rounded-full capitalize bg-amber-50 text-amber-700 border-amber-200">
                {part.condition}
              </span>
            )}
          </div>

          {/* Add to Cart */}
          {part.stockStatus !== "out_of_stock" && (
            <div className="flex items-center gap-3">
              <div className="flex items-center border rounded-lg">
                <button
                  className="p-2.5 hover:bg-accent transition-colors disabled:opacity-30"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="px-4 py-2 border-x font-medium tabular-nums min-w-[3rem] text-center">{quantity}</span>
                <button className="p-2.5 hover:bg-accent transition-colors" onClick={() => setQuantity(q => q + 1)} aria-label="Increase quantity">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                disabled={addingToCart}
                className={`flex-1 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
                  added
                    ? "bg-green-600 text-white"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {addingToCart ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Adding...</>
                ) : added ? (
                  <><CheckCircle2 className="h-4 w-4" /> Added to Cart</>
                ) : (
                  <><ShoppingCart className="h-4 w-4" /> Add to Cart</>
                )}
              </button>
            </div>
          )}

          {addError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {addError}
            </div>
          )}

          {part.isOversized && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Oversized item — additional delivery surcharge may apply
            </div>
          )}

          {part.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{part.description}</p>
          )}
        </div>
      </div>

      {/* Tabbed Content */}
      {(hasTabContent.description || hasTabContent.compatibility) && (
        <div className="border rounded-xl overflow-hidden bg-card">
          <div className="flex border-b overflow-x-auto">
            {hasTabContent.description && (
              <button
                onClick={() => setActiveTab("description")}
                className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  activeTab === "description" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Description
              </button>
            )}
            {hasTabContent.compatibility && (
              <button
                onClick={() => setActiveTab("compatibility")}
                className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  activeTab === "compatibility" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Compatibility
                {compatibilitySafe.length > 0 && (
                  <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{compatibilitySafe.length}</span>
                )}
              </button>
            )}
          </div>

          <div className="p-6">
            {/* Description Tab */}
            {activeTab === "description" && (
              <div className="space-y-4">
                {part.longDescription && (
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: part.longDescription }} />
                )}
                {!part.longDescription && part.description && (
                  <p className="text-muted-foreground">{part.description}</p>
                )}

                {/* Cross-reference numbers */}
                {partNumbersSafe.filter((pn) => !["oem", "aftermarket", "interchange"].includes(pn.numberType)).length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Cross-Reference Numbers</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr><th className="text-left p-3 font-medium">Number</th><th className="text-left p-3 font-medium">Type</th><th className="text-left p-3 font-medium">Brand</th></tr>
                        </thead>
                        <tbody>
                          {partNumbersSafe.filter((pn) => !["oem", "aftermarket", "interchange"].includes(pn.numberType)).map(pn => (
                            <tr key={pn.id} className="border-t">
                              <td className="p-3 font-mono text-sm">{pn.partNumber} {pn.isPrimary && <span className="text-xs text-primary">(primary)</span>}</td>
                              <td className="p-3 capitalize text-muted-foreground">{pn.numberType}</td>
                              <td className="p-3 text-muted-foreground">{pn.brand || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Compatibility Tab */}
            {activeTab === "compatibility" && (
              <div className="space-y-6">
                {aftermarketNumbers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                      <Package className="h-4 w-4" /> Aftermarket equivalents
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {aftermarketNumbers.map((pn) => (
                        <span key={pn.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg text-sm font-mono">
                          {pn.partNumber}
                          {pn.brand && <span className="text-muted-foreground text-xs">({pn.brand})</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {otherOemNumbers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" /> Fits as OEM (other manufacturers)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {otherOemNumbers.map((pn) => (
                        <span key={pn.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-mono">
                          {pn.partNumber}
                          {pn.brand && <span className="text-muted-foreground text-xs">({pn.brand})</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {compatibilitySafe.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                      <Car className="h-4 w-4" /> Vehicle Compatibility
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3 font-medium">Make</th>
                            <th className="text-left p-3 font-medium">Model</th>
                            <th className="text-left p-3 font-medium">Years</th>
                            <th className="text-left p-3 font-medium hidden sm:table-cell">Trim</th>
                            <th className="text-left p-3 font-medium hidden sm:table-cell">Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedCompat.map(vc => (
                            <tr key={vc.id} className="border-t">
                              <td className="p-3 font-medium">{vc.make}</td>
                              <td className="p-3">{vc.model}</td>
                              <td className="p-3 tabular-nums">{vc.yearStart}{vc.yearEnd !== vc.yearStart ? `–${vc.yearEnd}` : ""}</td>
                              <td className="p-3 text-muted-foreground hidden sm:table-cell">{vc.trim || "All"}</td>
                              <td className="p-3 hidden sm:table-cell">
                                <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full capitalize">{vc.source || "verified"}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {compatibilitySafe.length > 8 && (
                      <button
                        onClick={() => setShowAllCompat(!showAllCompat)}
                        className="mt-2 text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {showAllCompat ? <><ChevronUp className="h-3.5 w-3.5" /> Show fewer</> : <><ChevronDown className="h-3.5 w-3.5" /> Show all {compatibilitySafe.length} vehicles</>}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
