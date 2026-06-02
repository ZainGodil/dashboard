import { hubspotFetch } from './client'

export interface GoalRecord {
  id: string
  name: string
  target: number
  type: string
  startDate: string
  endDate: string
}

interface GoalsResponse {
  results: Array<{
    id: string
    properties: Record<string, string | null>
  }>
  paging?: { next?: { after: string } }
}

export async function fetchGoals(): Promise<GoalRecord[]> {
  const all: GoalRecord[] = []
  let after: string | undefined

  do {
    const params = new URLSearchParams({
      limit: '100',
      properties: 'hs_goal_name,hs_target_amount,hs_goal_type,hs_start_datetime,hs_end_datetime',
    })
    if (after) params.set('after', after)

    const data = await hubspotFetch<GoalsResponse>(`/crm/v3/goals/records?${params}`)

    for (const r of data.results ?? []) {
      all.push({
        id: r.id,
        name: r.properties.hs_goal_name ?? '',
        target: Number(r.properties.hs_target_amount ?? 0),
        type: r.properties.hs_goal_type ?? '',
        startDate: r.properties.hs_start_datetime ?? '',
        endDate: r.properties.hs_end_datetime ?? '',
      })
    }

    after = data.paging?.next?.after
  } while (after)

  return all
}

export function goalsForMonth(goals: GoalRecord[], year: number, month: number): GoalRecord[] {
  return goals.filter((g) => {
    if (!g.startDate) return false
    const d = new Date(g.startDate)
    return d.getFullYear() === year && d.getMonth() + 1 === month
  })
}
