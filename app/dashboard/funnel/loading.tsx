function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />
}

export default function FunnelLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Pulse className="h-5 w-24" />
        <Pulse className="h-3 w-52" />
      </div>

      {/* 4 summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Pulse key={i} className="h-24" />
        ))}
      </div>

      {/* 3 breakdown cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Pulse key={i} className="h-44" />
        ))}
      </div>

      {/* Funnel matrix */}
      <Pulse className="h-80" />

      {/* By source tabs */}
      <Pulse className="h-64" />
    </div>
  )
}
