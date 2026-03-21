"use client";

import Link from "next/link";
import { X } from "lucide-react";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Header */}
      <header className="bg-[hsl(222,47%,11%)] text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <span className="text-xs font-bold text-white">316</span>
          </div>
          <span className="text-sm font-bold tracking-tight">316 POS</span>
        </div>
        <Link
          href="/admin"
          className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
          title="Close POS"
        >
          <X className="h-5 w-5" />
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
