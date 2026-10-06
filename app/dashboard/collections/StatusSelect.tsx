'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { STUDENT_STATUSES, type StudentStatus } from '@/lib/collections/stripe-view'

const TONE: Record<StudentStatus, string> = {
  Active: 'text-blue-700',
  Graduated: 'text-emerald-700',
  Dropped: 'text-red-600',
  Blocked: 'text-slate-600',
  'On Hold': 'text-amber-700',
}

export default function StatusSelect({ studentKey, status }: { studentKey: string; status: StudentStatus | null }) {
  const router = useRouter()
  const [value, setValue] = useState<string>(status ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function change(next: string) {
    const previous = value
    setValue(next)
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/collections/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_key: studentKey, status: next || null }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed')
      router.refresh()
    } catch (err) {
      setValue(previous)
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <select
      value={value}
      onChange={(e) => change(e.target.value)}
      disabled={saving}
      title={error || 'Student status'}
      aria-label="Student status"
      className={`text-[11px] bg-transparent border rounded px-1 py-0.5 cursor-pointer disabled:opacity-60 ${
        error ? 'border-red-300' : 'border-transparent hover:border-slate-200'
      } ${value ? TONE[value as StudentStatus] : 'text-slate-400'}`}
    >
      <option value="">Not set</option>
      {STUDENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  )
}
