'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface SyncInfo {
  hubspot?: string
  ads?: string
}

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

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function Sidebar({ syncInfo }: { syncInfo?: SyncInfo }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [syncState, setSyncState] = useState<Record<'ads' | 'hubspot', 'idle' | 'loading' | 'success' | 'error'>>({
    ads: 'idle',
    hubspot: 'idle',
  })
  const syncTimers = useRef<Record<'ads' | 'hubspot', ReturnType<typeof setTimeout> | null>>({
    ads: null,
    hubspot: null,
  })

  useEffect(() => {
    const timers = syncTimers.current
    return () => {
      if (timers.ads) clearTimeout(timers.ads)
      if (timers.hubspot) clearTimeout(timers.hubspot)
    }
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function handleSync(source: 'ads' | 'hubspot') {
    if (syncState[source] === 'loading') return
    setSyncState((prev) => ({ ...prev, [source]: 'loading' }))
    try {
      const res = await fetch('/api/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      })
      if (!res.ok) throw new Error('Sync failed')
      setSyncState((prev) => ({ ...prev, [source]: 'success' }))
      router.refresh()
      if (syncTimers.current[source]) clearTimeout(syncTimers.current[source]!)
      syncTimers.current[source] = setTimeout(() => {
        setSyncState((prev) => ({ ...prev, [source]: 'idle' }))
        syncTimers.current[source] = null
      }, 2500)
    } catch {
      setSyncState((prev) => ({ ...prev, [source]: 'error' }))
      if (syncTimers.current[source]) clearTimeout(syncTimers.current[source]!)
      syncTimers.current[source] = setTimeout(() => {
        setSyncState((prev) => ({ ...prev, [source]: 'idle' }))
        syncTimers.current[source] = null
      }, 3000)
    }
  }

  const navContent = (
    <>
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-display text-[11px] font-extrabold text-white tracking-tight">
            WI
          </div>
          <div>
            <div className="font-display text-[13px] font-bold text-slate-100 leading-tight">Workforce</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest">Analytics</div>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-200"
          aria-label="Close menu"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l12 12M13 1L1 13"/>
          </svg>
        </button>
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
              onClick={() => setMobileOpen(false)}
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
      <div className="px-3 py-4 border-t border-slate-700 space-y-3">
        {/* Sync rows */}
        {[
          { key: 'hubspot' as const, label: 'HubSpot', dot: 'bg-emerald-500', ts: syncInfo?.hubspot },
          { key: 'ads' as const,     label: 'Ads',     dot: 'bg-blue-500',    ts: syncInfo?.ads },
        ].map(({ key, label, dot, ts }) => {
          const state = syncState[key]
          return (
            <div key={key} className="px-3">
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
                <span className="text-[10px] text-slate-500">{label}</span>
                <span className="ml-auto flex items-center gap-1.5">
                  {ts && state === 'idle' && (
                    <span className="text-[10px] text-slate-400">{relativeTime(ts)}</span>
                  )}
                  {state === 'success' && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M2 6l3 3 5-5"/>
                      </svg>
                      synced
                    </span>
                  )}
                  {state === 'error' && (
                    <span className="text-[10px] text-red-400">failed</span>
                  )}
                  <button
                    onClick={() => handleSync(key)}
                    disabled={state === 'loading'}
                    title={key === 'hubspot' ? 'May take a few minutes' : undefined}
                    className={[
                      'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                      state === 'loading'
                        ? 'text-slate-500 cursor-not-allowed'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700',
                    ].join(' ')}
                  >
                    {state === 'loading' ? (
                      <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.8 0 3.4.87 4.4 2.2"/>
                        <path d="M13.5 2.5v2.5H11"/>
                      </svg>
                    )}
                    {state === 'loading' ? 'Syncing…' : 'Sync'}
                  </button>
                </span>
              </div>
            </div>
          )
        })}

        <button
          onClick={handleSignOut}
          className="w-full text-left px-3 py-2 rounded-lg text-[12px] text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
        >
          Sign out
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        className="md:hidden fixed top-3 left-3 z-50 w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center text-slate-300 hover:text-white shadow-lg"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4h12M2 8h12M2 12h12"/>
        </svg>
      </button>

      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'flex flex-col bg-slate-800 shrink-0 h-full',
          'md:relative md:w-56 md:translate-x-0',
          'fixed inset-y-0 left-0 z-50 w-64',
          'transition-transform duration-200 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        {navContent}
      </aside>
    </>
  )
}
