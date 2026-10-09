import type { ExceptionRow } from './stripe-view'

export interface ExceptionAction {
  id: string
  student_key: string
  flag_kind: 'failed' | 'quiet' | 'overdue'
  flag_since: string
  note: string
  follow_up_on: string | null // YYYY-MM-DD
  created_by: string
  created_at: string
}

export type OpenException = ExceptionRow & { followUpDue: ExceptionAction | null }
export type HandledException = ExceptionRow & { action: ExceptionAction }

const sameFlag = (e: ExceptionRow, a: ExceptionAction) =>
  a.student_key === e.key && a.flag_kind === e.kind && Date.parse(a.flag_since) === Date.parse(e.since)

// Splits the queue into open and handled flags. `actions` are the not-reopened actions;
// `today` is YYYY-MM-DD in America/Chicago. A handled flag comes back when its follow-up
// date arrives; a newer event (another failed charge, a later payment) is a different flag.
export function applyActions(exceptions: ExceptionRow[], actions: ExceptionAction[], today: string) {
  const open: OpenException[] = []
  const handled: HandledException[] = []

  for (const e of exceptions) {
    const action = actions
      .filter((a) => sameFlag(e, a))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]

    if (!action) open.push({ ...e, followUpDue: null })
    else if (action.follow_up_on && action.follow_up_on <= today) open.push({ ...e, followUpDue: action })
    else handled.push({ ...e, action })
  }

  // Follow-ups that came due go first, then the rest in their usual order
  open.sort((a, b) => Number(!!b.followUpDue) - Number(!!a.followUpDue))
  handled.sort((a, b) => Date.parse(b.action.created_at) - Date.parse(a.action.created_at))
  return { open, handled }
}

export function chicagoToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(now)
}

export interface ActionInput {
  student_key: string
  flag_kind: 'failed' | 'quiet' | 'overdue'
  flag_since: string
  note: string
  follow_up_on: string | null
}

export function parseActionInput(body: unknown, today: string): ActionInput | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const key = typeof b.student_key === 'string' ? b.student_key.trim() : ''
  const kind = b.flag_kind
  const since = typeof b.flag_since === 'string' ? b.flag_since : ''
  const note = typeof b.note === 'string' ? b.note.trim() : ''
  const followUp = typeof b.follow_up_on === 'string' ? b.follow_up_on.trim() : ''

  if (!key || key.length > 320) return { error: 'Missing student.' }
  if (kind !== 'failed' && kind !== 'quiet' && kind !== 'overdue') return { error: 'Unknown flag.' }
  if (!since || Number.isNaN(Date.parse(since))) return { error: 'Missing flag date.' }
  if (!note) return { error: 'Add a note saying what was done.' }
  if (note.length > 1000) return { error: 'Note is too long (1,000 characters max).' }
  if (followUp) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(followUp) || Number.isNaN(Date.parse(`${followUp}T00:00:00Z`))) return { error: 'Follow-up date is not a valid date.' }
    if (followUp <= today) return { error: 'Follow-up date must be after today.' }
  }

  return { student_key: key, flag_kind: kind, flag_since: new Date(since).toISOString(), note, follow_up_on: followUp || null }
}
