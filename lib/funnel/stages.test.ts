import { describe, it, expect } from 'vitest'
import {
  isUnqualified,
  computeStageCounts,
  computeStagePercents,
  sumStageCounts,
  type FunnelContactRow,
  type FunnelDealRow,
} from './stages'

describe('isUnqualified', () => {
  it('flags the three UQ statuses', () => {
    expect(isUnqualified('Not Interested')).toBe(true)
    expect(isUnqualified('Unqualified')).toBe(true)
    expect(isUnqualified('Wrong Number')).toBe(true)
  })

  it('does not flag other statuses', () => {
    expect(isUnqualified('Connected')).toBe(false)
    expect(isUnqualified(null)).toBe(false)
  })
})

// Mirrors the real Kevin Shafer / Jun-26 block from
// "06. Funnel Report - June 2026.xlsx" sheet "By AA analysis - (Old Version)"
// (cached formula values), reconstructed status-by-status so every derived
// count (total=152, contacted=39, appointments=12, ...) matches the Excel exactly.
function buildKevinShaferJune26(): { contacts: FunnelContactRow[]; deals: FunnelDealRow[] } {
  const contacts: FunnelContactRow[] = []
  const push = (leadStatus: string, count: number, viable = true) => {
    for (let i = 0; i < count; i++) contacts.push({ lead_status: leadStatus, viable })
  }
  push('Unqualified', 12) // viable=true, but isUnqualified() excludes it from Viable
  push('Attempted to Contact', 7, false) // the 7 Non Viable contacts
  push('On Hold', 4)
  push('Booked Decision Appointment', 1)
  push('Interview No Show', 7)
  push('In Progress', 4)
  // Career Consultation Booked/Email-Text/Connected/Bad Timing/Open Deal are
  // collapsed into one CONTACTED-eligible bucket to hit Contacted=39 exactly
  // (39 - On Hold(4) - Booked Decision(1) - No Show(7) - In Progress(4) = 23).
  push('Career Consultation Booked', 23)
  // Padding: statuses excluded from every stage bucket (not unqualified, not
  // contacted), used only to bring Total Leads up to 152.
  push('Attempted to Contact', 94)

  const deals: FunnelDealRow[] = [
    { stage_label: 'Invoice Sent' },
    { stage_label: 'Invoice Sent' },
    { stage_label: 'Signed Promissory Note / Closed Won' },
  ]

  return { contacts, deals }
}

describe('computeStageCounts', () => {
  it('matches the Kevin Shafer / Jun-26 Excel block', () => {
    const { contacts, deals } = buildKevinShaferJune26()
    const counts = computeStageCounts(contacts, deals)

    expect(counts.total).toBe(152)
    expect(counts.nonViable).toBe(7)
    expect(counts.unqualified).toBe(12)
    expect(counts.viable).toBe(133)
    expect(counts.contacted).toBe(39)
    expect(counts.appointments).toBe(12) // Booked Decision(1) + No Show(7) + In Progress(4)
    expect(counts.noShows).toBe(7)
    expect(counts.appAttended).toBe(5)
    expect(counts.inProgress).toBe(4)
    expect(counts.bookedDecision).toBe(1)
    expect(counts.invoice).toBe(3)
    expect(counts.conversion).toBe(1)
  })

  it('recognizes all 4 real HubSpot closed-won stage_label variants as Conversion', () => {
    const deals: FunnelDealRow[] = [
      { stage_label: 'Signed Promissory Note / Closed Won' },
      { stage_label: 'CLOSED WON ENROLLMENT' },
      { stage_label: 'Promissory Note Signed / Closed Won Enrollment' },
      { stage_label: 'Signed Promissory note - Closed Won' },
      { stage_label: 'Discovery' },
    ]
    const counts = computeStageCounts([], deals)

    expect(counts.conversion).toBe(4)
    expect(counts.invoice).toBe(4)
  })
})

describe('computeStagePercents', () => {
  it('computes the per-row ratios matching the Excel formulas exactly', () => {
    const { contacts, deals } = buildKevinShaferJune26()
    const counts = computeStageCounts(contacts, deals)
    const pct = computeStagePercents(counts)

    expect(pct.viable).toBeCloseTo(133 / 152, 5) // 0.875
    expect(pct.contacted).toBeCloseTo(39 / 133, 5) // 0.29323...
    expect(pct.appointments).toBeCloseTo(12 / 39, 5) // 0.30769...
    expect(pct.noShows).toBeCloseTo(7 / 12, 5) // 0.58333...
    expect(pct.appAttended).toBeCloseTo(5 / 12, 5) // 0.41667...
    expect(pct.inProgress).toBeCloseTo(0.8, 5)
    expect(pct.bookedDecision).toBeCloseTo(0.2, 5)
    expect(pct.invoice).toBeCloseTo(3 / 133, 5) // 0.02256...
    expect(pct.conversion).toBeCloseTo(1 / 133, 5) // 0.00752...
  })

  it('returns null instead of dividing by zero', () => {
    const counts = computeStageCounts([], [])
    const pct = computeStagePercents(counts)
    expect(pct.viable).toBeNull()
    expect(pct.contacted).toBeNull()
  })
})

describe('sumStageCounts', () => {
  it('sums every field across rows', () => {
    const a = computeStageCounts([{ lead_status: 'Connected', viable: true }], [])
    const b = computeStageCounts([{ lead_status: 'Connected', viable: true }], [])
    const sum = sumStageCounts([a, b])
    expect(sum.total).toBe(2)
    expect(sum.contacted).toBe(2)
  })
})

describe('normalization handles real HubSpot lead_status casing variants', () => {
  it('matches ALL_CAPS internal names', () => {
    expect(isUnqualified('UNQUALIFIED')).toBe(true)
    const counts = computeStageCounts([
      { lead_status: 'IN_PROGRESS', viable: true },
      { lead_status: 'CONNECTED', viable: true },
      { lead_status: 'OPEN_DEAL', viable: true },
      { lead_status: 'BAD_TIMING', viable: true },
    ], [])
    expect(counts.inProgress).toBe(1)
    expect(counts.appointments).toBe(1) // IN_PROGRESS is the only APPOINTMENT_STATUSES member here
    expect(counts.contacted).toBe(4) // all 4 are CONTACTED_STATUSES members
  })

  it('matches mixed-case variants like "On hold" and "Wrong number"', () => {
    expect(isUnqualified('Wrong number')).toBe(true)
    const counts = computeStageCounts([{ lead_status: 'On hold', viable: true }], [])
    expect(counts.contacted).toBe(1)
  })
})
