import { googleAdsFetch } from './client'
import { parseCampaignName } from './parser'
import type { University, Course, Segment } from '@/types'

interface GaqlRow {
  campaign: { name: string }
  metrics: { costMicros: string; impressions: string; clicks: string }
  segments: { date: string }
}

interface SearchResponse {
  results?: GaqlRow[]
  nextPageToken?: string
}

interface CampaignRow {
  date: string
  campaign_name: string
  university: University | null
  course: Course | null
  segment: Segment | null
  is_wioa: boolean
  spend: number
  impressions: number
  clicks: number
}

export async function fetchCampaignPerformance(
  sinceDays: number = 30
): Promise<CampaignRow[]> {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - sinceDays)
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  const query = `
    SELECT
      campaign.name,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      segments.date
    FROM campaign
    WHERE segments.date BETWEEN '${fmt(start)}' AND '${fmt(end)}'
      AND campaign.status != 'REMOVED'
    ORDER BY segments.date DESC
  `.trim()

  const all: GaqlRow[] = []
  let pageToken: string | undefined

  do {
    const body: Record<string, unknown> = { query }
    if (pageToken) body.pageToken = pageToken

    const data = await googleAdsFetch<SearchResponse>('/googleAds:search', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    all.push(...(data.results ?? []))
    pageToken = data.nextPageToken
  } while (pageToken)

  return all.map((row) => {
    const parsed = parseCampaignName(row.campaign.name)
    return {
      date: row.segments.date,
      campaign_name: row.campaign.name,
      university: parsed.university,
      course: parsed.course,
      segment: parsed.segment,
      is_wioa: parsed.isWioa,
      spend: Number(row.metrics.costMicros) / 1_000_000,
      impressions: Number(row.metrics.impressions),
      clicks: Number(row.metrics.clicks),
    }
  })
}
