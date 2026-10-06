import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { parseManualPayment } from '@/lib/collections/manual-payments'

async function requireSession() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// POST /api/collections/manual-payments — record a payment that didn't go through Stripe
export async function POST(req: NextRequest) {
  const user = await requireSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = parseManualPayment(await req.json().catch(() => null), new Date())
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('manual_payments')
    .insert({ ...parsed, created_by: user.email ?? user.id })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
