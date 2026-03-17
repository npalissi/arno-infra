export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div>
        <div className="h-7 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded-md bg-muted" />
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white p-5 shadow-[var(--shadow-card)]">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-8 w-20 animate-pulse rounded-lg bg-muted" />
          </div>
        ))}
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white p-5 shadow-[var(--shadow-card)]">
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-8 w-24 animate-pulse rounded-lg bg-muted" />
          </div>
        ))}
      </div>

      {/* Alerts skeleton */}
      <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="h-5 w-24 animate-pulse rounded bg-muted mb-5" />
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>

      {/* Activity skeleton */}
      <div className="rounded-2xl bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="h-5 w-36 animate-pulse rounded bg-muted mb-5" />
        <div className="space-y-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`flex items-start gap-3 py-3.5 ${i < 4 ? 'border-b border-border' : ''}`}>
              <div className="mt-1.5 size-2.5 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-3 w-48 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
