export default function VehicleDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-pulse rounded bg-muted" />
          <div className="h-7 w-48 animate-pulse rounded-lg bg-muted" />
          <div className="h-6 w-16 animate-pulse rounded-[6px] bg-muted" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 animate-pulse rounded-[10px] bg-muted" />
          <div className="h-9 w-32 animate-pulse rounded-[10px] bg-muted" />
        </div>
      </div>

      {/* 3-column layout */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr_320px]">
        {/* Photo column */}
        <div className="space-y-3">
          <div className="aspect-square animate-pulse rounded-xl bg-muted" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="size-[52px] animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>

        {/* Info column */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>

        {/* Financial column */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Expenses skeleton */}
      <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="h-5 w-20 animate-pulse rounded bg-muted mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="flex gap-4 mb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
