function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />
}

export default function CacReportLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Pulse className="h-5 w-28" />
          <Pulse className="h-3 w-44" />
        </div>
        <Pulse className="h-9 w-64 rounded-lg" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Pulse key={i} className="h-24" />
        ))}
      </div>

      {/* SBU table */}
      <Pulse className="h-72" />

      {/* 6 charts in 3 rows of 2 */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Pulse className="h-56" />
          <Pulse className="h-56" />
        </div>
      ))}
    </div>
  )
}
