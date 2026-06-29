import type { Course, University, Segment } from '@/types'

const COURSE_TOKENS: Record<string, Course> = {
  'ui/ux': 'UI/UX Design',
  'uiux': 'UI/UX Design',
  'ui ux': 'UI/UX Design',
  'digital marketing': 'Digital Marketing',
  'digmkt': 'Digital Marketing',
  'dig mkt': 'Digital Marketing',
  'generative ai': 'Generative AI Data Analyst',
  'gen ai': 'Generative AI Data Analyst',
  'gen-ai': 'Generative AI Data Analyst',
  'gai': 'Generative AI Data Analyst',
  'data analyst': 'Generative AI Data Analyst',
}

const UNIVERSITY_TOKENS: Record<string, University> = {
  'uta': 'UTA',
  'wfi': 'WFI',
  'hofstra': 'Hofstra',
  'neiu': 'NEIU',
  'scu': 'SCU',
  'utsa': 'UTSA',
}

const SEGMENT_TOKENS: Record<string, Segment> = {
  'b2c': 'B2C',
  'b2he': 'B2C',
  'wfd': 'WFD',
  'b2g': 'WFD',
  'wioa': 'WFD',
}

// Campaign type indicators — not course/university/segment but useful for classification
const TYPE_KEYWORDS = ['performance max', 'pmax', 'p-max', 'search', 'display', 'video', 'shopping', 'remarketing', 'retargeting', 'brand']

export interface ParsedCampaign {
  course: Course | null
  university: University | null
  segment: Segment | null
  isWioa: boolean
  type: string | null
  isPMax: boolean
}

export function parseCampaignName(name: string): ParsedCampaign {
  const nameLower = name.toLowerCase()
  const isPMax = TYPE_KEYWORDS.slice(0, 3).some((kw) => nameLower.includes(kw))

  const brackets = Array.from(name.matchAll(/\[([^\]]+)\]/g), (m) => m[1].trim())

  let course: Course | null = null
  let university: University | null = null
  let segment: Segment | null = null
  let isWioa = false
  const typeTokens: string[] = []

  for (const token of brackets) {
    const lower = token.toLowerCase()

    if (COURSE_TOKENS[lower]) {
      course = COURSE_TOKENS[lower]
      continue
    }

    if (UNIVERSITY_TOKENS[lower]) {
      university = UNIVERSITY_TOKENS[lower]
      continue
    }

    if (SEGMENT_TOKENS[lower]) {
      segment = SEGMENT_TOKENS[lower]
      if (lower === 'wioa') isWioa = true
      continue
    }

    // remaining bracket tokens are campaign type descriptors
    typeTokens.push(token)
  }

  // Fallback: scan non-bracket text for course/university hints
  if (!course || !university) {
    const nameClean = name.replace(/\[[^\]]*\]/g, '').toLowerCase()
    if (!course) {
      for (const [key, val] of Object.entries(COURSE_TOKENS)) {
        if (nameClean.includes(key)) { course = val; break }
      }
    }
    if (!university) {
      for (const [key, val] of Object.entries(UNIVERSITY_TOKENS)) {
        if (nameClean.includes(key)) { university = val; break }
      }
    }
  }

  return {
    course,
    university,
    segment,
    isWioa,
    isPMax,
    type: typeTokens.length ? typeTokens.join(' | ') : null,
  }
}
