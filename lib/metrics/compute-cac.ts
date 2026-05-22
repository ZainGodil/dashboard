import { createServiceClient } from '@/lib/supabase/server'

export async function recomputeCacMetrics(months: string[]): Promise<void> {
  if (!months.length) return
  const supabase = createServiceClient()

  for (const month of months) {
    // Aggregate contacts for this month
    const { data: contacts } = await supabase
      .from('contacts')
      .select('course, university, segment, original_source, viable, enrolled')
      .eq('month', month)

    if (!contacts?.length) continue

    // Build aggregation map keyed by (course, university, segment, source)
    type Key = string
    const agg = new Map<Key, { leads: number; enrollments: number }>()

    for (const c of contacts) {
      const key: Key = [c.course ?? '', c.university ?? '', c.segment ?? '', c.original_source ?? ''].join('|')
      const existing = agg.get(key) ?? { leads: 0, enrollments: 0 }
      agg.set(key, {
        leads: existing.leads + (c.viable ? 1 : 0),
        enrollments: existing.enrollments + (c.enrolled ? 1 : 0),
      })
    }

    // Fetch ad spend for this month
    const [year, mon] = parseMonth(month)
    const startDate = `${year}-${String(mon).padStart(2, '0')}-01`
    const endDate = `${year}-${String(mon).padStart(2, '0')}-${daysInMonth(year, mon)}`

    const { data: spendRows } = await supabase
      .from('ad_spend')
      .select('course, university, segment, spend')
      .gte('date', startDate)
      .lte('date', endDate)

    const spendMap = new Map<Key, number>()
    for (const row of spendRows ?? []) {
      const key: Key = [row.course ?? '', row.university ?? '', row.segment ?? '', ''].join('|')
      spendMap.set(key, (spendMap.get(key) ?? 0) + Number(row.spend))
    }

    // Upsert cac_metrics rows
    const rows = []
    for (const [key, { leads, enrollments }] of agg) {
      const [course, university, segment, source] = key.split('|')
      const spendKey: Key = [course, university, segment, ''].join('|')
      const spend = spendMap.get(spendKey) ?? 0
      const cvr = leads > 0 ? enrollments / leads : 0
      const cpl = leads > 0 ? spend / leads : 0
      const cac = enrollments > 0 ? spend / enrollments : 0

      rows.push({
        month,
        course: course || null,
        university: university || null,
        segment: segment || null,
        source: source || null,
        leads,
        enrollments,
        cvr,
        spend,
        cpl,
        cac,
        computed_at: new Date().toISOString(),
      })
    }

    if (rows.length) {
      await supabase.from('cac_metrics').upsert(rows, {
        onConflict: 'month,course,university,segment,source',
      })
    }
  }
}

export async function recomputeRollingMetrics(): Promise<void> {
  const supabase = createServiceClient()
  const today = new Date()
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const startDate = ninetyDaysAgo.toISOString().split('T')[0]
  const endDate = today.toISOString().split('T')[0]

  const { data: contacts } = await supabase
    .from('contacts')
    .select('course, university, segment, original_source, viable, enrolled')
    .gte('create_date', startDate)
    .lte('create_date', endDate)

  const { data: spendRows } = await supabase
    .from('ad_spend')
    .select('course, university, segment, spend')
    .gte('date', startDate)
    .lte('date', endDate)

  type Key = string
  const agg = new Map<Key, { leads: number; enrollments: number }>()
  const spendMap = new Map<Key, number>()

  for (const c of contacts ?? []) {
    const key: Key = [c.course ?? '', c.university ?? '', c.segment ?? '', c.original_source ?? ''].join('|')
    const existing = agg.get(key) ?? { leads: 0, enrollments: 0 }
    agg.set(key, {
      leads: existing.leads + (c.viable ? 1 : 0),
      enrollments: existing.enrollments + (c.enrolled ? 1 : 0),
    })
  }

  for (const row of spendRows ?? []) {
    const key: Key = [row.course ?? '', row.university ?? '', row.segment ?? '', ''].join('|')
    spendMap.set(key, (spendMap.get(key) ?? 0) + Number(row.spend))
  }

  const rows = []
  for (const [key, { leads: leads90d, enrollments: enrollments90d }] of agg) {
    const [course, university, segment, source] = key.split('|')
    const spendKey: Key = [course, university, segment, ''].join('|')
    const spend90d = spendMap.get(spendKey) ?? 0

    rows.push({
      as_of_date: endDate,
      course: course || null,
      university: university || null,
      segment: segment || null,
      source: source || null,
      leads_90d: leads90d,
      enrollments_90d: enrollments90d,
      spend_90d: spend90d,
      cvr_90d: leads90d > 0 ? enrollments90d / leads90d : 0,
      cpl_90d: leads90d > 0 ? spend90d / leads90d : 0,
      cac_90d: enrollments90d > 0 ? spend90d / enrollments90d : 0,
    })
  }

  if (rows.length) {
    await supabase.from('rolling_metrics').upsert(rows, {
      onConflict: 'as_of_date,course,university,segment,source',
    })
  }
}

function parseMonth(month: string): [number, number] {
  const months: Record<string, number> = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
  }
  const [mon, yr] = month.split('-')
  return [2000 + Number(yr), months[mon] ?? 1]
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}
