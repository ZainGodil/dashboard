import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (!session && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (session && req.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard/cac-report', req.url))
  }

  if (session && req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard/cac-report', req.url))
  }

  return res
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*'],
}
