import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authorizeUrl, paycoveConfig, redirectUri } from '@/lib/paycove/client'

const STATE_COOKIE = 'paycove_oauth_state'

// GET /api/paycove/connect — sends a signed-in user to Paycove to approve read access
export async function GET(req: NextRequest) {
  const back = new URL('/dashboard/collections', req.nextUrl.origin)

  const { data: { user } } = await createClient().auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.nextUrl.origin))

  const cfg = paycoveConfig()
  if (!cfg) {
    back.searchParams.set('paycove', 'not-configured')
    return NextResponse.redirect(back)
  }

  const state = crypto.randomUUID()
  const res = NextResponse.redirect(authorizeUrl(cfg.clientId, redirectUri(req.nextUrl.origin), state))
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/paycove', maxAge: 600 })
  return res
}
