export default function VehiclesLoading() {
  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white p-5 shadow-[var(--shadow-card)]">
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-8 w-16 animate-pulse rounded-lg bg-muted" />
          </div>
        ))}
      </div>

      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between rounded-2xl bg-white px-5 py-3 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <div className="h-[40px] w-[280px] animate-pulse rounded-[10px] bg-muted" />
          <div className="h-[40px] w-[140px] animate-pulse rounded-[10px] bg-muted" />
          <div className="h-[40px] w-[160px] animate-pulse rounded-[10px] bg-muted" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-[36px] w-[72px] animate-pulse rounded-[10px] bg-muted" />
          <div className="h-[40px] w-[110px] animate-pulse rounded-[10px] bg-muted" />
        </div>
      </div>

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl bg-white border border-border shadow-[var(--shadow-card)]">
            {/* Image placeholder */}
            <div className="h-[180px] animate-pulse bg-muted" />
            {/* Body */}
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-6 w-16 animate-pulse rounded-[6px] bg-muted" />
              </div>
              <div className="h-3 w-40 animate-pulse rounded bg-muted" />
              <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
                <div>
                  <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                  <div className="mt-1 h-4 w-20 animate-pulse rounded bg-muted" />
                </div>
                <div>
                  <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                  <div className="mt-1 h-4 w-20 animate-pulse rounded bg-muted" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
