function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />
}

export default function CollectionsLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Pulse key={i} className="h-24" />
        ))}
      </div>
      <Pulse className="h-72" />
      <Pulse className="h-96" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Pulse className="h-64" />
        <Pulse className="h-64" />
      </div>
    </div>
  )
}
