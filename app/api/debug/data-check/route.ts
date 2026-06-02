import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('s')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: contacts, error: contactsErr } = await supabase
    .from('contacts')
    .select('viable, enrolled, month')
    .limit(5)

  const { data: cac, error: cacErr } = await supabase
    .from('cac_metrics')
    .select('month, leads, enrollments')
    .limit(5)

  const { count, error: countErr } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })

  return NextResponse.json({
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    contacts_sample: contacts,
    contacts_error: contactsErr?.message ?? null,
    contacts_total: count,
    count_error: countErr?.message ?? null,
    cac_sample: cac,
    cac_error: cacErr?.message ?? null,
  })
}
