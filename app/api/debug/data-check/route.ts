import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('s')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Total contacts
  const { count: contactsTotal } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })

  // Jun-26 contacts: total, viable count
  const { data: jun26Contacts } = await supabase
    .from('contacts')
    .select('viable, enrolled, month')
    .eq('month', 'Jun-26')
    .limit(200)

  const jun26Total = jun26Contacts?.length ?? 0
  const jun26Viable = jun26Contacts?.filter(c => c.viable).length ?? 0
  const jun26Enrolled = jun26Contacts?.filter(c => c.enrolled).length ?? 0

  // Sample of months in contacts (to check month column is populated)
  const { data: monthSample } = await supabase
    .from('contacts')
    .select('month')
    .not('month', 'is', null)
    .limit(5)

  const { count: nullMonthCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .is('month', null)

  // cac_metrics: all distinct months
  const { data: cacMonths } = await supabase
    .from('cac_metrics')
    .select('month, leads, enrollments')
    .order('month')

  const cacByMonth: Record<string, { leads: number; enrollments: number }> = {}
  for (const row of cacMonths ?? []) {
    const m = row.month ?? 'null'
    if (!cacByMonth[m]) cacByMonth[m] = { leads: 0, enrollments: 0 }
    cacByMonth[m].leads += row.leads
    cacByMonth[m].enrollments += row.enrollments
  }

  return NextResponse.json({
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    contacts_total: contactsTotal,
    contacts_null_month: nullMonthCount,
    contacts_month_sample: monthSample?.map(r => r.month),
    jun26: { total: jun26Total, viable: jun26Viable, enrolled: jun26Enrolled },
    cac_by_month: cacByMonth,
  })
}
