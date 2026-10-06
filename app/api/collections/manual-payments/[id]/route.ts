import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// DELETE /api/collections/manual-payments/:id — remove a mistaken entry (kept, marked deleted)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await createAdminClient()
    .from('manual_payments')
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.email ?? user.id })
    .eq('id', params.id)
    .is('deleted_at', null)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
