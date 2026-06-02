function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />
}

export default function SalesKpisLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Pulse className="h-5 w-24" />
          <Pulse className="h-3 w-48" />
        </div>
        <Pulse className="h-9 w-52 rounded-lg" />
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Pulse key={i} className="h-24" />
        ))}
      </div>

      {/* Advisor table */}
      <Pulse className="h-72" />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Pulse className="h-52" />
        <Pulse className="h-52" />
      </div>
    </div>
  )
}
