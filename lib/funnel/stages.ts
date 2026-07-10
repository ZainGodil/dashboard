export interface FunnelContactRow {
  lead_status: string | null
  viable: boolean
}

export interface FunnelDealRow {
  stage_label: string | null
}

export interface StageCounts {
  total: number
  nonViable: number
  unqualified: number
  viable: number
  contacted: number
  appointments: number
  noShows: number
  appAttended: number
  inProgress: number
  bookedDecision: number
  invoice: number
  conversion: number
}

export interface StagePercents {
  viable: number | null
  contacted: number | null
  appointments: number | null
  noShows: number | null
  appAttended: number | null
  inProgress: number | null
  bookedDecision: number | null
  invoice: number | null
  conversion: number | null
}

export interface FunnelStageDef {
  key: keyof StageCounts
  label: string
  group: 'INTAKE' | 'CONTACT' | 'APPOINTMENTS' | 'OUTCOME'
  highlight?: 'blue' | 'green'
  subtract?: boolean
  percentKey?: keyof StagePercents
}

// HubSpot returns lead_status inconsistently: some values are ALL_CAPS_WITH_UNDERSCORES
// (internal enum names for default/system statuses), others are human-readable Title Case
// (custom statuses). Normalize to uppercase with underscores replaced by spaces so both
// forms compare equal, regardless of which casing/format HubSpot happens to return.
export function normalizeStatus(raw: string | null): string {
  return (raw ?? '').trim().toUpperCase().replace(/_/g, ' ')
}

// Static Lead Status -> Qualified lookup, replicating the Excel's XLOOKUP table
// (sheet "hubspot-crm-exports-cac-view-ne", columns X:Z).
const UNQUALIFIED_STATUSES = new Set(['NOT INTERESTED', 'UNQUALIFIED', 'WRONG NUMBER'])

export function isUnqualified(leadStatus: string | null): boolean {
  return UNQUALIFIED_STATUSES.has(normalizeStatus(leadStatus))
}

// Matches "By AA analysis - (Old Version)"'s Contacted row: SUM(D7:D11,D14:D18)
const CONTACTED_STATUSES = new Set([
  'ON HOLD', 'STUDENT', 'BOOKED DECISION APPOINTMENT', 'INTERVIEW NO SHOW',
  'IN PROGRESS', 'SELF-PACED', 'CAREER CONSULTATION BOOKED', 'EMAIL/TEXT',
  'CONNECTED', 'BAD TIMING', 'OPEN DEAL',
])

// Matches the Appointments row: SUM(D9:D11)
const APPOINTMENT_STATUSES = new Set(['BOOKED DECISION APPOINTMENT', 'INTERVIEW NO SHOW', 'IN PROGRESS'])

// Real HubSpot "closed won / enrolled" stage_label variants confirmed against production
// deals table (the Excel source-of-truth's literal "Student" label does not occur in the
// live data). See task-10 report for the distribution query that confirmed this.
const CONVERSION_STAGE_LABELS = new Set([
  'Signed Promissory Note / Closed Won',
  'CLOSED WON ENROLLMENT',
  'Promissory Note Signed / Closed Won Enrollment',
  'Signed Promissory note - Closed Won',
])

export function computeStageCounts(contacts: FunnelContactRow[], deals: FunnelDealRow[]): StageCounts {
  const total = contacts.length
  const nonViable = contacts.filter((c) => !c.viable).length
  const unqualified = contacts.filter((c) => c.viable && isUnqualified(c.lead_status)).length
  const viable = total - nonViable - unqualified
  const contacted = contacts.filter((c) => CONTACTED_STATUSES.has(normalizeStatus(c.lead_status))).length
  const appointments = contacts.filter((c) => APPOINTMENT_STATUSES.has(normalizeStatus(c.lead_status))).length
  const noShows = contacts.filter((c) => normalizeStatus(c.lead_status) === 'INTERVIEW NO SHOW').length
  const appAttended = Math.max(0, appointments - noShows)
  const inProgress = contacts.filter((c) => normalizeStatus(c.lead_status) === 'IN PROGRESS').length
  const bookedDecision = contacts.filter((c) => normalizeStatus(c.lead_status) === 'BOOKED DECISION APPOINTMENT').length
  const invoice = deals.filter((d) => d.stage_label === 'Invoice Sent' || CONVERSION_STAGE_LABELS.has(d.stage_label ?? '')).length
  const conversion = deals.filter((d) => CONVERSION_STAGE_LABELS.has(d.stage_label ?? '')).length

  return { total, nonViable, unqualified, viable, contacted, appointments, noShows, appAttended, inProgress, bookedDecision, invoice, conversion }
}

function safeDiv(num: number, den: number): number | null {
  return den > 0 ? num / den : null
}

// Denominators replicate the exact per-row Excel formula, not a uniform "previous row" rule:
// Viable/Invoice/Conversion are % of Total or Viable; the rest step through the funnel.
export function computeStagePercents(counts: StageCounts): StagePercents {
  return {
    viable: safeDiv(counts.viable, counts.total),
    contacted: safeDiv(counts.contacted, counts.viable),
    appointments: safeDiv(counts.appointments, counts.contacted),
    noShows: safeDiv(counts.noShows, counts.appointments),
    appAttended: safeDiv(counts.appAttended, counts.appointments),
    inProgress: safeDiv(counts.inProgress, counts.appAttended),
    bookedDecision: safeDiv(counts.bookedDecision, counts.appAttended),
    invoice: safeDiv(counts.invoice, counts.viable),
    conversion: safeDiv(counts.conversion, counts.viable),
  }
}

const STAGE_KEYS: (keyof StageCounts)[] = [
  'total', 'nonViable', 'unqualified', 'viable', 'contacted', 'appointments',
  'noShows', 'appAttended', 'inProgress', 'bookedDecision', 'invoice', 'conversion',
]

export function sumStageCounts(rows: StageCounts[]): StageCounts {
  const sum = {} as StageCounts
  for (const key of STAGE_KEYS) {
    sum[key] = rows.reduce((s, r) => s + r[key], 0)
  }
  return sum
}

export const FUNNEL_STAGES: FunnelStageDef[] = [
  { key: 'total', label: 'Total Leads', group: 'INTAKE' },
  { key: 'nonViable', label: 'Non Viable', group: 'INTAKE', subtract: true },
  { key: 'unqualified', label: 'Unqualified', group: 'INTAKE', subtract: true },
  { key: 'viable', label: 'Viable Leads', group: 'INTAKE', highlight: 'blue', percentKey: 'viable' },
  { key: 'contacted', label: 'Contacted', group: 'CONTACT', percentKey: 'contacted' },
  { key: 'appointments', label: 'Appointments', group: 'APPOINTMENTS', percentKey: 'appointments' },
  { key: 'noShows', label: 'No Shows', group: 'APPOINTMENTS', subtract: true, percentKey: 'noShows' },
  { key: 'appAttended', label: 'App Attended', group: 'APPOINTMENTS', percentKey: 'appAttended' },
  { key: 'inProgress', label: 'In Progress', group: 'APPOINTMENTS', percentKey: 'inProgress' },
  { key: 'bookedDecision', label: 'Booked Decision', group: 'APPOINTMENTS', percentKey: 'bookedDecision' },
  { key: 'invoice', label: 'Invoice', group: 'OUTCOME', percentKey: 'invoice' },
  { key: 'conversion', label: 'Conversion', group: 'OUTCOME', highlight: 'green', percentKey: 'conversion' },
]
