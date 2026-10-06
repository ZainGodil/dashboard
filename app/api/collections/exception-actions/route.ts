import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { chicagoToday, parseActionInput } from '@/lib/collections/exception-actions'

// POST /api/collections/exception-actions — mark a flag as handled, with a note and optional follow-up date
export async function POST(req: NextRequest) {
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = parseActionInput(await req.json().catch(() => null), chicagoToday())
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { data, error } = await createAdminClient()
    .from('exception_actions')
    .insert({ ...parsed, created_by: user.email ?? user.id })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
