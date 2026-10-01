import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  // Fetch latest successful sync timestamps, plus a HubSpot failure newer than the
  // last success so the sidebar doesn't silently show a stale time (best-effort)
  let syncInfo: { hubspot?: string; ads?: string; hubspotError?: { at: string; message: string } } = {}
  try {
    const svc = createAdminClient()
    const [{ data }, { data: latestHubspot }] = await Promise.all([
      svc
        .from('sync_log')
        .select('source, completed_at')
        .eq('status', 'success')
        .in('source', ['hubspot', 'google_ads'])
        .order('completed_at', { ascending: false })
        .limit(10),
      svc
        .from('sync_log')
        .select('status, completed_at, error_message')
        .eq('source', 'hubspot')
        .order('completed_at', { ascending: false })
        .limit(1),
    ])

    if (data) {
      syncInfo = {
        hubspot:  data.find((r) => r.source === 'hubspot')?.completed_at   ?? undefined,
        ads:      data.find((r) => r.source === 'google_ads')?.completed_at ?? undefined,
      }
    }
    const last = latestHubspot?.[0]
    if (last?.status === 'error' && last.completed_at) {
      syncInfo.hubspotError = { at: last.completed_at, message: last.error_message ?? 'Sync failed' }
    }
  } catch {
    // Non-fatal — sidebar renders without sync status
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <Sidebar syncInfo={syncInfo} />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
