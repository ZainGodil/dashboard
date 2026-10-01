import { hubspotFetch } from './client'

const ENROLLED_STAGES = new Set([
  // B2C Interview pipeline — "Signed Promissory Note / Closed Won"
  '124944662',
  // Hidden Talent B2C pipeline — "Signed Promissory Note / Closed Won"
  '1335758964',
])

interface Deal {
  id: string
  properties: { dealstage: string | null; closedate: string | null; amount?: string | null; payment_frequency?: string | null }
  associations?: { contacts?: { results: { id: string }[] } }
}

interface DealsResponse {
  results: Deal[]
  paging?: { next?: { after: string } }
}

// Fetches total deal revenue for deals closed in the current calendar month
// using HubSpot search API to avoid paginating all deals.
export async function fetchMtdBookingRevenue(): Promise<number> {
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonthStart = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`

  let total = 0
  let after: string | undefined

  do {
    const body: Record<string, unknown> = {
      filterGroups: Array.from(ENROLLED_STAGES).map((stageId) => ({
        filters: [
          { propertyName: 'dealstage', operator: 'EQ', value: stageId },
          { propertyName: 'closedate', operator: 'GTE', value: monthStart },
          { propertyName: 'closedate', operator: 'LT', value: nextMonthStart },
        ],
      })),
      properties: ['dealstage', 'closedate', 'amount'],
      limit: 100,
    }
    if (after) body.after = after

    const data = await hubspotFetch<DealsResponse>('/crm/v3/objects/deals/search', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    for (const deal of data.results) {
      total += Number(deal.properties.amount ?? 0)
    }

    after = data.paging?.next?.after
  } while (after)

  return total
}

export interface EnrolledDealData {
  closedate: string | null
  amount: number
  payment_frequency: string | null
}

// Returns Map<contactId, { closedate, amount, payment_frequency }>
export async function fetchEnrolledContactIds(): Promise<Map<string, EnrolledDealData>> {
  return buildEnrolledMap(await fetchAllRawDeals())
}

// Builds Map<contactId, enrolled deal data> from deals in the order given — the
// first enrolled-stage deal seen for a contact wins (deals list API returns id order).
export function buildEnrolledMap(deals: FullDeal[]): Map<string, EnrolledDealData> {
  const contactDeals = new Map<string, EnrolledDealData>()
  for (const deal of deals) {
    if (!ENROLLED_STAGES.has(deal.properties.dealstage ?? '')) continue
    const closedate = deal.properties.closedate ?? null
    const amount = Number(deal.properties.amount ?? 0)
    const payment_frequency = deal.properties.payment_frequency ?? null
    const contacts = deal.associations?.contacts?.results ?? []
    for (const c of contacts) {
      if (!contactDeals.has(c.id)) contactDeals.set(c.id, { closedate, amount, payment_frequency })
    }
  }
  return contactDeals
}

interface PipelineStage {
  id: string
  label: string
}

interface Pipeline {
  id: string
  stages: PipelineStage[]
}

interface PipelinesResponse {
  results: Pipeline[]
}

// Key = `${pipelineId}:${stageId}` — stage IDs are only unique within a pipeline.
export async function fetchDealStageLabelMap(): Promise<Map<string, string>> {
  const data = await hubspotFetch<PipelinesResponse>('/crm/v3/pipelines/deals')
  const map = new Map<string, string>()
  for (const pipeline of data.results) {
    for (const stage of pipeline.stages) {
      map.set(`${pipeline.id}:${stage.id}`, stage.label)
    }
  }
  return map
}

export interface DealFetchRecord {
  hubspot_deal_id: string
  contact_hubspot_id: string | null
  advisor: string | null
  stage_label: string | null
  amount: number | null
  payment_frequency: string | null
  close_date_raw: string | null
}

export interface FullDeal {
  id: string
  properties: {
    dealstage: string | null
    pipeline: string | null
    closedate: string | null
    amount: string | null
    payment_frequency: string | null
    hubspot_owner_id: string | null
  }
  associations?: { contacts?: { results: { id: string }[] } }
}

interface FullDealsResponse {
  results: FullDeal[]
  paging?: { next?: { after: string } }
}

// Fetches every deal (not filtered to any specific stage) so the `deals` table can
// track full stage history for the funnel's Invoice/Conversion metrics.
export async function fetchAllDeals(
  ownerMap: Map<string, string>,
  stageLabelMap: Map<string, string>
): Promise<DealFetchRecord[]> {
  const deals = await fetchAllRawDeals()
  return deals.map((d) => toDealRecord(d, ownerMap, stageLabelMap))
}

export const DEAL_PROPERTIES = ['dealstage', 'pipeline', 'closedate', 'amount', 'payment_frequency', 'hubspot_owner_id']

// Pages through every deal once, with contact associations. Both the enrollment map
// and the `deals` table rows are derived from this single pass.
export async function fetchAllRawDeals(): Promise<FullDeal[]> {
  const deals: FullDeal[] = []
  let after: string | undefined

  do {
    const params = new URLSearchParams({
      limit: '100',
      properties: DEAL_PROPERTIES.join(','),
      associations: 'contacts',
      ...(after ? { after } : {}),
    })

    const data = await hubspotFetch<FullDealsResponse>(`/crm/v3/objects/deals?${params}`)
    deals.push(...data.results)

    after = data.paging?.next?.after
  } while (after)

  return deals
}

export function toDealRecord(
  deal: FullDeal,
  ownerMap: Map<string, string>,
  stageLabelMap: Map<string, string>
): DealFetchRecord {
  const contacts = deal.associations?.contacts?.results ?? []
  const stageKey = `${deal.properties.pipeline ?? ''}:${deal.properties.dealstage ?? ''}`
  return {
    hubspot_deal_id: deal.id,
    contact_hubspot_id: contacts[0]?.id ?? null,
    advisor: deal.properties.hubspot_owner_id ? (ownerMap.get(deal.properties.hubspot_owner_id) ?? null) : null,
    stage_label: stageLabelMap.get(stageKey) ?? null,
    amount: deal.properties.amount ? Number(deal.properties.amount) : null,
    payment_frequency: deal.properties.payment_frequency ?? null,
    close_date_raw: deal.properties.closedate ?? null,
  }
}
