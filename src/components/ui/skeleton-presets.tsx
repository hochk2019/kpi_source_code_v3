import { cn } from "@/lib/utils";

// Simple skeleton base
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-ds-surface-muted",
        className
      )}
    />
  );
}

// ===== Table Skeletons =====

export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === 0 ? "w-8" : i === columns - 1 ? "w-24" : "flex-1"
          )}
        />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-md border border-ds-border-subtle">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-ds-border-subtle bg-ds-surface-muted px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className={cn("h-4", i === 0 ? "w-8" : "flex-1")} />
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y divide-ds-border-subtle">
        {Array.from({ length: rows }).map((_, i) => (
          <TableRowSkeleton key={i} columns={columns} />
        ))}
      </div>
    </div>
  );
}

// ===== Card Skeletons =====

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-ds-border-subtle bg-ds-surface-card p-4 space-y-3">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

// ===== Form Skeletons =====

export function FormFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <FormFieldSkeleton key={i} />
      ))}
    </div>
  );
}

// ===== Page Section Skeletons =====

export function PageHeaderSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-ds-border-subtle px-4 py-3">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-5 w-48" />
      <div className="flex-1" />
      <Skeleton className="h-8 w-24" />
    </div>
  );
}

export function StatsRowSkeleton({ stats = 4 }: { stats?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: stats }).map((_, i) => (
        <div key={i} className="rounded-lg border border-ds-border-subtle bg-ds-surface-card p-4 space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

// ===== Dashboard Skeletons =====

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-4">
      <PageHeaderSkeleton />
      <StatsRowSkeleton stats={4} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CardSkeleton />
        </div>
        <div>
          <CardSkeleton />
        </div>
      </div>
      <TableSkeleton rows={5} columns={5} />
    </div>
  );
}

// ===== List Skeletons =====

export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="divide-y divide-ds-border-subtle rounded-md border border-ds-border-subtle">
      {Array.from({ length: items }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  );
}
