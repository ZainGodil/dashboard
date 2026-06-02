import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  // Fetch latest successful sync timestamps (best-effort)
  let syncInfo: { hubspot?: string; ads?: string } = {}
  try {
    const svc = createServiceClient()
    const { data } = await svc
      .from('sync_log')
      .select('source, completed_at')
      .eq('status', 'success')
      .in('source', ['hubspot', 'google_ads'])
      .order('completed_at', { ascending: false })
      .limit(10)

    if (data) {
      syncInfo = {
        hubspot:  data.find((r) => r.source === 'hubspot')?.completed_at   ?? undefined,
        ads:      data.find((r) => r.source === 'google_ads')?.completed_at ?? undefined,
      }
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
