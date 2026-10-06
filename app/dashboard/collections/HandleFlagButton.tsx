'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  studentKey: string
  studentName: string
  kind: 'failed' | 'quiet'
  since: string
}

function tomorrow(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(d)
}

export default function HandleFlagButton({ studentKey, studentName, kind, since }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/collections/exception-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_key: studentKey, flag_kind: kind, flag_since: since, note, follow_up_on: followUp }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save')
      setOpen(false)
      setNote('')
      setFollowUp('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[10px] font-semibold px-2 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 whitespace-nowrap">
        Handle
      </button>
    )
  }

  return (
    <form onSubmit={save} className="space-y-1.5 min-w-[260px]">
      <textarea
        autoFocus
        required
        maxLength={1000}
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={`What was done for ${studentName}?`}
        aria-label="Note"
        className="w-full text-[11px] border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:border-blue-400"
      />
      <div className="flex items-center gap-1.5">
        <label className="text-[10px] text-slate-400 whitespace-nowrap" htmlFor={`fu-${studentKey}-${kind}`}>Follow up on</label>
        <input
          id={`fu-${studentKey}-${kind}`}
          type="date"
          min={tomorrow()}
          value={followUp}
          onChange={(e) => setFollowUp(e.target.value)}
          className="text-[11px] border border-slate-200 rounded-md px-1.5 py-0.5"
        />
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={saving} className="text-[10px] font-semibold px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
          {saving ? 'Saving…' : 'Mark handled'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError('') }} className="text-[10px] font-semibold text-slate-500 hover:text-slate-700">
          Cancel
        </button>
        {error && <span className="text-[10px] text-red-600">{error}</span>}
      </div>
    </form>
  )
}
