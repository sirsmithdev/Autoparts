"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Loader2, SearchX } from "lucide-react";
import Link from "next/link";

interface LookupResult {
  id: string;
}

export default function PartLookupPage() {
  const { partNumber } = useParams<{ partNumber: string }>();
  const router = useRouter();
  const [notFound, setNotFound] = useState(false);
  const [searchValue, setSearchValue] = useState(partNumber ? decodeURIComponent(partNumber) : "");

  const decodedPartNumber = partNumber ? decodeURIComponent(partNumber) : "";

  useEffect(() => {
    if (!decodedPartNumber) return;

    let cancelled = false;

    async function lookup() {
      try {
        const result = await api<LookupResult>(
          `/api/store/catalog/lookup/${encodeURIComponent(decodedPartNumber)}`
        );
        if (!cancelled && result?.id) {
          router.replace(`/parts/${result.id}`);
        } else if (!cancelled) {
          setNotFound(true);
        }
      } catch {
        if (!cancelled) setNotFound(true);
      }
    }

    lookup();
    return () => { cancelled = true; };
  }, [decodedPartNumber, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchValue.trim();
    if (trimmed && trimmed !== decodedPartNumber) {
      setNotFound(false);
      router.push(`/parts/lookup/${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Part Lookup" }]} />

      {!notFound ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Looking up part <span className="font-mono font-medium text-foreground">{decodedPartNumber}</span>...
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center py-16 space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <SearchX className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-xl font-bold">Part Not Found</h1>
            <p className="text-sm text-muted-foreground">
              No product matched part number{" "}
              <span className="font-mono font-medium text-foreground">{decodedPartNumber}</span>
            </p>
          </div>

          <form onSubmit={handleSearch} className="w-full max-w-md flex gap-2">
            <input
              type="text"
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              placeholder="Search another part number..."
              className="flex-1 px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Search
            </button>
          </form>

          <Link href="/search" className="text-primary hover:underline text-sm">
            Browse All Parts
          </Link>
        </div>
      )}
    </div>
  );
}
