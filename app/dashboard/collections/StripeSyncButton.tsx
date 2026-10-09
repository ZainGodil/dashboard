'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type State = 'idle' | 'syncing' | 'done' | 'error'

export default function StripeSyncButton({ source = 'stripe', label = 'Sync Stripe', unit = 'payments' }: { source?: 'stripe' | 'paycove'; label?: string; unit?: string }) {
  const router = useRouter()
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState('')

  async function sync() {
    setState('syncing')
    setMessage('')
    try {
      const res = await fetch('/api/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      setState('done')
      setMessage(`${data.synced ?? 0} ${unit}`)
      router.refresh()
    } catch (err) {
      setState('error')
      setMessage(err instanceof Error ? err.message : 'Sync failed')
    }
  }

  return (
    <div className="flex items-center gap-2">
      {message && (
        <span className={`text-[11px] max-w-[260px] truncate ${state === 'error' ? 'text-red-600' : 'text-emerald-600'}`} title={message}>
          {message}
        </span>
      )}
      <button
        onClick={sync}
        disabled={state === 'syncing'}
        className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {state === 'syncing' ? 'Syncing…' : label}
      </button>
    </div>
  )
}
