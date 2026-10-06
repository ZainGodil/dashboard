import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { STUDENT_STATUSES, type StudentStatus } from '@/lib/collections/stripe-view'

// PUT /api/collections/status { student_key, status } — status null clears it
export async function PUT(req: NextRequest) {
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { student_key?: unknown; status?: unknown }
  const key = typeof body.student_key === 'string' ? body.student_key.trim() : ''
  if (!key || key.length > 320) return NextResponse.json({ error: 'student_key is required' }, { status: 400 })

  const supabase = createAdminClient()

  if (body.status === null || body.status === '') {
    const { error } = await supabase.from('student_status').delete().eq('student_key', key)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (!STUDENT_STATUSES.includes(body.status as StudentStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { error } = await supabase.from('student_status').upsert({
    student_key: key,
    status: body.status,
    updated_by: user.email ?? user.id,
    updated_at: new Date().toISOString(),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
