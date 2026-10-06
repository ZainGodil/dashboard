import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// DELETE /api/collections/exception-actions/:id — reopen a handled flag (the note is kept, marked reopened)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data: { user } } = await createClient().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await createAdminClient()
    .from('exception_actions')
    .update({ reopened_at: new Date().toISOString(), reopened_by: user.email ?? user.id })
    .eq('id', params.id)
    .is('reopened_at', null)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
