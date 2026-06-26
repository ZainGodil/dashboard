import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    campaign_name: string
    platform: string
    course: string | null
    university: string | null
  }
  const { campaign_name, platform, course, university } = body
  if (!campaign_name || !platform) {
    return NextResponse.json({ error: 'campaign_name and platform are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('campaign_overrides')
    .upsert(
      { campaign_name, platform, course: course || null, university: university || null, updated_at: new Date().toISOString() },
      { onConflict: 'campaign_name,platform' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
