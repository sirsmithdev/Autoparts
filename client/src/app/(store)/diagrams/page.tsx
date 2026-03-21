"use client";

import Script from "next/script";
import { BookOpen } from "lucide-react";

const TWS_KEY = process.env.NEXT_PUBLIC_TWS_KEY || "";

export default function OemDiagramsPage() {
  if (!TWS_KEY) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white rounded-lg border p-8 text-center">
          <BookOpen className="h-10 w-10 mx-auto text-gray-400 mb-4" />
          <h1 className="text-xl font-semibold mb-2">OEM Parts Catalog</h1>
          <p className="text-gray-500">
            The OEM parts catalog is not configured yet. Please contact support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          OEM Parts Diagrams
        </h1>
        <p className="text-gray-500 mt-1">
          Search OEM parts by vehicle make, model, or VIN. Browse exploded diagrams to find exact part numbers.
        </p>
      </div>
      <div className="min-h-[600px] bg-white rounded-lg border p-4">
        <div id="parts-catalog" data-key={TWS_KEY} />
        <Script
          src="https://gui.parts-catalogs.com/v3/parts-catalogs.js"
          strategy="afterInteractive"
        />
      </div>
    </div>
  );
}
