import type { Course, University, Segment, SalesSegment } from '@/types'

const UNIVERSITY_MAP: Record<string, University> = {
  'university of texas at arlington': 'UTA',
  'uta': 'UTA',
  'workforce institute': 'WFI',
  'wfi': 'WFI',
  'hofstra': 'Hofstra',
  'hofstra university': 'Hofstra',
  'northeastern illinois': 'NEIU',
  'northeastern illinois university': 'NEIU',
  'scu': 'SCU',
  'santa clara university': 'SCU',
}

export function mapUniversity(raw: string | null | undefined): University | null {
  if (!raw) return null
  return UNIVERSITY_MAP[raw.toLowerCase().trim()] ?? null
}

export function mapCourse(program: string | null | undefined): Course {
  if (!program) return 'General'
  const p = program.toLowerCase()
  if (p.includes('ui/ux') || p === 'ui/ux') return 'UI/UX Design'
  if (p.includes('digital marketing')) return 'Digital Marketing'
  if (p.includes('generative ai') || p.includes('data analyst')) return 'Generative AI Data Analyst'
  return 'General'
}

export function mapSegment(b2he: string | null | undefined): { segment: Segment; salesSegment: SalesSegment } {
  if (b2he === 'true') return { segment: 'B2C', salesSegment: 'B2HE' }
  return { segment: 'WFD', salesSegment: 'B2G' }
}

export function isEnrolled(leadStatus: string | null | undefined): boolean {
  if (!leadStatus) return false
  return leadStatus === 'Student' || leadStatus === 'Signed Promissory Note / Closed Won'
}

export function isViable(leadStatus: string | null | undefined): boolean {
  if (!leadStatus) return true
  const nonViable = ['UNQUALIFIED', 'Non Viable', 'Dropped', 'Not Interested']
  return !nonViable.includes(leadStatus)
}

export function mapSource(raw: string | null | undefined): string {
  if (!raw) return 'Unknown'
  const map: Record<string, string> = {
    PAID_SEARCH: 'Paid Search',
    PAID_SOCIAL: 'Paid Social',
    ORGANIC_SEARCH: 'Organic Search',
    DIRECT_TRAFFIC: 'Direct',
    REFERRALS: 'Referrals',
    EMAIL_MARKETING: 'Email',
    SOCIAL_MEDIA: 'Social',
    OTHER_CAMPAIGNS: 'Other',
    OFFLINE: 'Offline',
  }
  return map[raw] ?? raw
}

export function formatMonth(date: string | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  return `${d.toLocaleString('en-US', { month: 'short' })}-${String(d.getFullYear()).slice(2)}`
}
