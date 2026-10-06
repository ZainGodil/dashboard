'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PAYERS } from '@/lib/collections/manual-payments'

interface KnownStudent {
  name: string
  email: string
}

const INPUT = 'w-full text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400'
const LABEL = 'block text-[10px] uppercase tracking-[0.7px] text-slate-400 font-semibold mb-1'

function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date())
}

export default function RecordPaymentForm({ students }: { students: KnownStudent[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [form, setForm] = useState({ student_name: '', student_email: '', payer: 'WFD', amount: '', paid_on: today(), note: '' })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = e.target.value
    setForm((f) => {
      const next = { ...f, [k]: v }
      // Picking a known student by name fills in their email so the payment joins their row
      if (k === 'student_name' && !f.student_email) {
        const match = students.find((s) => s.name.toLowerCase() === v.trim().toLowerCase() && s.email)
        if (match) next.student_email = match.email
      }
      return next
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved('')
    try {
      const res = await fetch('/api/collections/manual-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not save the payment')
      setSaved(`Recorded $${Number(form.amount).toLocaleString()} from ${form.payer} for ${form.student_name.trim()}`)
      setForm((f) => ({ ...f, student_name: '', student_email: '', amount: '', note: '' }))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the payment')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => setOpen(true)}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          Record payment
        </button>
        {saved && <span className="text-[11px] text-emerald-600">{saved}</span>}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="lg:col-span-2">
          <label className={LABEL} htmlFor="rp-name">Student</label>
          <input id="rp-name" list="rp-students" required value={form.student_name} onChange={set('student_name')} className={INPUT} placeholder="Start typing a name" />
          <datalist id="rp-students">
            {students.map((s) => <option key={s.email || s.name} value={s.name}>{s.email}</option>)}
          </datalist>
        </div>
        <div className="lg:col-span-2">
          <label className={LABEL} htmlFor="rp-email">Email (links to their Stripe row)</label>
          <input id="rp-email" type="email" value={form.student_email} onChange={set('student_email')} className={INPUT} placeholder="Optional" />
        </div>
        <div>
          <label className={LABEL} htmlFor="rp-payer">Paid by</label>
          <select id="rp-payer" value={form.payer} onChange={set('payer')} className={INPUT}>
            {PAYERS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="rp-amount">Amount ($)</label>
          <input id="rp-amount" type="number" min="0.01" step="0.01" required value={form.amount} onChange={set('amount')} className={INPUT} />
        </div>
        <div>
          <label className={LABEL} htmlFor="rp-date">Date received</label>
          <input id="rp-date" type="date" required max={today()} value={form.paid_on} onChange={set('paid_on')} className={INPUT} />
        </div>
        <div className="lg:col-span-5">
          <label className={LABEL} htmlFor="rp-note">Note</label>
          <input id="rp-note" maxLength={500} value={form.note} onChange={set('note')} className={INPUT} placeholder="Optional, e.g. check number or reference" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
          {saving ? 'Saving…' : 'Save payment'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError('') }} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
          Close
        </button>
        {error && <span className="text-[11px] text-red-600">{error}</span>}
        {saved && <span className="text-[11px] text-emerald-600">{saved}</span>}
      </div>
    </form>
  )
}
