import { metaFetch } from './client'
import { parseCampaignName } from '@/lib/google-ads/parser'
import type { University, Course, Segment } from '@/types'

interface MetaInsight {
  campaign_name: string
  spend: string
  impressions: string
  clicks: string
  date_start: string
}

interface InsightsResponse {
  data: MetaInsight[]
  paging?: { cursors?: { after?: string }; next?: string }
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

export async function fetchMetaCampaignPerformance(
  since: string,
  until: string
): Promise<CampaignRow[]> {
  const accountId = process.env.META_AD_ACCOUNT_ID!
  const all: MetaInsight[] = []
  let after: string | undefined

  do {
    const params: Record<string, string> = {
      fields: 'campaign_name,spend,impressions,clicks,date_start',
      time_range: JSON.stringify({ since, until }),
      level: 'campaign',
      time_increment: '1',
      limit: '500',
    }
    if (after) params.after = after

    const data = await metaFetch<InsightsResponse>(`/${accountId}/insights`, params)
    all.push(...data.data)
    after = data.paging?.cursors?.after
    if (!data.paging?.next) after = undefined
  } while (after)

  return all.map((row) => {
    const parsed = parseCampaignName(row.campaign_name)
    return {
      date: row.date_start,
      campaign_name: row.campaign_name,
      university: parsed.university,
      course: parsed.course,
      segment: parsed.segment,
      is_wioa: parsed.isWioa,
      spend: parseFloat(row.spend || '0'),
      impressions: parseInt(row.impressions || '0', 10),
      clicks: parseInt(row.clicks || '0', 10),
    }
  })
}
