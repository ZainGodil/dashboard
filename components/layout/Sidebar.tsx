'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  {
    href: '/dashboard/cac-report',
    label: 'CAC Report',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="3" width="14" height="10" rx="1.5"/>
        <path d="M5 3v10M10 3v10M1 7h14"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/funnel',
    label: 'Funnel',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 3h12l-4.5 6v4l-3-1.5V9L2 3z"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/pacing',
    label: 'Pacing',
    badge: 'LIVE',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="6"/>
        <path d="M8 5v3l2 2"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/sales-kpis',
    label: 'Sales KPIs',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="5.5" cy="4.5" r="2"/>
        <path d="M1 12c0-2.5 2-3.5 4.5-3.5S10 9.5 10 12"/>
        <circle cx="11.5" cy="9" r="2"/>
        <path d="M9.5 12.5c0-1 .9-1.5 2-1.5s2 .5 2 1.5"/>
      </svg>
    ),
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-56 flex flex-col bg-slate-800 shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-display text-[11px] font-extrabold text-white tracking-tight">
            WI
          </div>
          <div>
            <div className="font-display text-[13px] font-bold text-slate-100 leading-tight">Workforce</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest">Analytics</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3">
        <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Reports</div>
        {NAV.map(({ href, label, icon, badge }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium mb-0.5 transition-all border ${
                active
                  ? 'bg-blue-500/15 text-blue-400 border-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700 border-transparent'
              }`}
            >
              <span className={active ? 'opacity-100' : 'opacity-60'}>{icon}</span>
              {label}
              {badge && (
                <span className="ml-auto text-[9px] font-mono bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-700">
        <button
          onClick={handleSignOut}
          className="w-full text-left px-3 py-2 rounded-lg text-[12px] text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
