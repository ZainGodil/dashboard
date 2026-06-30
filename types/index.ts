export type University = 'UTA' | 'WFI' | 'Hofstra' | 'NEIU' | 'SCU' | 'UTSA'
export type Course = 'Digital Marketing' | 'UI/UX Design' | 'Generative AI Data Analyst' | 'Project Management' | 'General'
export type Segment = 'B2C' | 'WFD'
export type SalesSegment = 'B2HE' | 'B2G'
export type Platform = 'google' | 'meta'
export type SyncSource = 'hubspot' | 'google_ads' | 'meta'
export type Period = 'mtd' | 'last_month' | '90d' | 'ytd'

export type LeadStatus =
  | 'Non Viable'
  | 'Unqualified'
  | 'Email/Text'
  | 'Connected'
  | 'Bad Timing'
  | 'On Hold'
  | 'Open Deal'
  | 'Career Consultation Booked'
  | 'Interview No Show'
  | 'In Progress'
  | 'Booked Decision Appointment'
  | 'Student'
  | 'Signed Promissory Note / Closed Won'

export type FunnelGroup = 'INTAKE' | 'CONTACT' | 'APPOINTMENTS' | 'DECISION' | 'OUTCOME'

export interface Contact {
  id: string
  hubspot_id: string
  first_name: string
  last_name: string
  create_date: string
  course: Course | null
  original_source: string | null
  viable: boolean
  lead_status: LeadStatus | null
  qualified: 'Q' | 'UQ' | 'NA' | null
  university: University | null
  advisor: string | null
  segment: Segment | null
  sales_segment: SalesSegment | null
  enrolled: boolean
  synced_at: string
}

export interface AdSpend {
  id: string
  date: string
  platform: Platform
  university: University | null
  course: Course | null
  segment: Segment | null
  spend: number
  impressions: number
  clicks: number
  campaign_name: string
  synced_at: string
}

export interface CacMetrics {
  id: string
  month: string
  course: Course | null
  university: University | null
  segment: Segment | null
  source: string | null
  leads: number
  enrollments: number
  cvr: number
  spend: number
  cpl: number
  cac: number
  computed_at: string
}

export interface SyncLog {
  id: string
  source: SyncSource
  started_at: string
  completed_at: string | null
  records_synced: number
  status: 'success' | 'error'
  error_message: string | null
}
