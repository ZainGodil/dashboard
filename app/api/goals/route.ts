import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function requireSession() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await requireSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .order('period_type', { ascending: false })
    .order('period', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await requireSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    period_type: string
    period: string
    spend_target: number | null
    leads_target: number | null
    enrollments_target: number | null
  }

  const { period_type, period, spend_target, leads_target, enrollments_target } = body

  if (!period_type || !period) {
    return NextResponse.json({ error: 'period_type and period are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('goals')
    .upsert(
      { period_type, period, spend_target, leads_target, enrollments_target, updated_at: new Date().toISOString() },
      { onConflict: 'period_type,period' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
