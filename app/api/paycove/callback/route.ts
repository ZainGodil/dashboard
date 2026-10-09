import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { exchangeCode, redirectUri } from '@/lib/paycove/client'

const STATE_COOKIE = 'paycove_oauth_state'

// GET /api/paycove/callback — Paycove sends the user back here after they approve access
export async function GET(req: NextRequest) {
  const back = new URL('/dashboard/collections', req.nextUrl.origin)
  const done = (result: string) => {
    back.searchParams.set('paycove', result)
    const res = NextResponse.redirect(back)
    res.cookies.delete({ name: STATE_COOKIE, path: '/api/paycove' })
    return res
  }

  const { data: { user } } = await createClient().auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.nextUrl.origin))

  const params = req.nextUrl.searchParams
  if (params.get('error')) return done('denied')

  const code = params.get('code')
  const state = params.get('state')
  const expected = req.cookies.get(STATE_COOKIE)?.value
  // Only accept a code from the approval this browser started (blocks forged callbacks)
  if (!code || !state || !expected || state !== expected) return done('invalid')

  try {
    const token = await exchangeCode(code, redirectUri(req.nextUrl.origin))
    const { error } = await createAdminClient().from('integration_tokens').upsert({
      provider: 'paycove',
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
      connected_by: user.email ?? user.id,
      connected_at: new Date().toISOString(),
    })
    if (error) throw new Error(error.message)
    return done('connected')
  } catch (err) {
    console.error('[paycove callback]', err instanceof Error ? err.message : err)
    return done('failed')
  }
}
