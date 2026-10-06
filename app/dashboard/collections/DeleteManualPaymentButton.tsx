'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteManualPaymentButton({ id, label }: { id: string; label: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function remove() {
    if (!window.confirm(`Remove ${label}? It will no longer count in the report.`)) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/collections/manual-payments/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not remove')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove')
      setBusy(false)
    }
  }

  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-[10px] text-red-600">{error}</span>}
      <button onClick={remove} disabled={busy} className="text-[10px] font-semibold text-slate-400 hover:text-red-600 disabled:opacity-60">
        {busy ? 'Removing…' : 'Remove'}
      </button>
    </span>
  )
}
