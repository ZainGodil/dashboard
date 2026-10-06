'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ReopenFlagButton({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function reopen() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/collections/exception-actions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not reopen')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reopen')
      setBusy(false)
    }
  }

  return (
    <span className="flex items-center justify-end gap-2">
      {error && <span className="text-[10px] text-red-600">{error}</span>}
      <button onClick={reopen} disabled={busy} className="text-[10px] font-semibold text-slate-400 hover:text-blue-600 disabled:opacity-60">
        {busy ? 'Reopening…' : 'Reopen'}
      </button>
    </span>
  )
}
