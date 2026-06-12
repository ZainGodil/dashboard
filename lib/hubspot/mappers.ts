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

export function mapCourse(courseValidation: string | null | undefined): Course {
  if (!courseValidation) return 'General'
  const COURSE_MAP: Record<string, Course> = {
    'Generative AI Data Analyst': 'Generative AI Data Analyst',
    'Digital Marketing': 'Digital Marketing',
    'UX/UI': 'UI/UX Design',
    'AI for Software Engineers': 'General',
  }
  return COURSE_MAP[courseValidation] ?? 'General'
}

// WFD contacts are identified by a WIOA form submission (hs_analytics_source_data_2 contains "wioa").
// All other contacts owned by the advisor list are B2C/B2HE.
export function mapSegment(sourceData2: string | null | undefined): { segment: Segment; salesSegment: SalesSegment } {
  if (sourceData2 && sourceData2.toLowerCase().includes('wioa')) {
    return { segment: 'WFD', salesSegment: 'B2G' }
  }
  return { segment: 'B2C', salesSegment: 'B2HE' }
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
    ORGANIC_SOCIAL: 'Organic Social',
    DIRECT_TRAFFIC: 'Direct Traffic',
    REFERRALS: 'Referrals',
    EMAIL_MARKETING: 'Email Marketing',
    SOCIAL_MEDIA: 'Organic Social',
    OTHER_CAMPAIGNS: 'Other Campaigns',
    OFFLINE: 'Offline Sources',
    OFFLINE_SOURCES: 'Offline Sources',
    AFFILIATE: 'Affiliate Learner',
    OTHER: 'Other Campaigns',
  }
  return map[raw] ?? raw
}

export function mapViable(viableFlag: string | null | undefined): boolean {
  if (!viableFlag) return true
  return viableFlag.toLowerCase() === 'viable'
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function formatMonth(date: string | null | undefined): string {
  if (!date) return ''
  // date is already a Chicago-timezone YYYY-MM-DD string — parse directly, no UTC assumption
  const [yr4, mon] = date.split('-').map(Number)
  return `${MONTH_SHORT[mon - 1]}-${String(yr4).slice(2)}`
}
