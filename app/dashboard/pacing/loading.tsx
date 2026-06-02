function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />
}

export default function PacingLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header with progress bars */}
      <Pulse className="h-28" />

      {/* 4 RAG cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Pulse key={i} className="h-32" />
        ))}
      </div>

      {/* Daily chart + pacing table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Pulse className="h-64" />
        <Pulse className="h-64" />
      </div>

      {/* YTD trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Pulse className="h-52" />
        <Pulse className="h-52" />
      </div>
    </div>
  )
}
