import { Skeleton } from "@/components/ui/skeleton";

export function PartCardSkeleton() {
  return (
    <div className="border rounded-md overflow-hidden bg-card">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="p-3.5 space-y-2.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-20" />
        <div className="flex justify-between items-center pt-1">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-14 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function PartGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <PartCardSkeleton key={i} />
      ))}
    </div>
  );
}
