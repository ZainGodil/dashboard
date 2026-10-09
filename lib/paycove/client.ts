// Paycove API (https://docs.paycove.io). OAuth 2.0 authorization-code flow; tokens are long-lived.
// This module only ever READS from Paycove: GET requests, plus the one-off token exchange.

const PAYCOVE = 'https://paycove.io'
const DEALS_PER_PAGE = 50 // Paycove's maximum
const CONTACTS_PER_PAGE = 100 // Paycove's maximum
const MAX_PAGES = 200 // safety stop

export function paycoveConfig() {
  const clientId = process.env.PAYCOVE_CLIENT_ID
  const clientSecret = process.env.PAYCOVE_CLIENT_SECRET
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

// Must match the redirect URL registered on the Paycove API client exactly
export function redirectUri(origin: string): string {
  return process.env.PAYCOVE_REDIRECT_URI ?? `${origin}/api/paycove/callback`
}

export function authorizeUrl(clientId: string, redirect: string, state: string): string {
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: '', state })
  return `${PAYCOVE}/oauth/authorize?${params}`
}

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
}

export async function exchangeCode(code: string, redirect: string): Promise<TokenResponse> {
  const cfg = paycoveConfig()
  if (!cfg) throw new Error('PAYCOVE_CLIENT_ID and PAYCOVE_CLIENT_SECRET are not set')
  const form = new FormData()
  form.set('grant_type', 'authorization_code')
  form.set('client_id', cfg.clientId)
  form.set('client_secret', cfg.clientSecret)
  form.set('redirect_uri', redirect)
  form.set('code', code)
  const res = await fetch(`${PAYCOVE}/oauth/token`, { method: 'POST', body: form, headers: { Accept: 'application/json' }, cache: 'no-store' })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.access_token) throw new Error(`Paycove token exchange failed (${res.status}): ${body.message ?? body.error_description ?? body.error ?? res.statusText}`)
  return body as TokenResponse
}

async function paycoveGet<T>(token: string, path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${PAYCOVE}${path}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`Paycove ${res.status} on ${path}: ${body.message ?? res.statusText}`)
  }
  return res.json() as Promise<T>
}

interface Page<T> {
  data: T[]
  current_page?: number
  last_page?: number
  next_page_url?: string | null
}

async function fetchAllPages<T>(token: string, path: string, params: Record<string, string>): Promise<T[]> {
  const all: T[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await paycoveGet<Page<T>>(token, path, { ...params, page: String(page) })
    all.push(...(res.data ?? []))
    const done = !res.data?.length || (res.last_page !== undefined ? page >= res.last_page : !res.next_page_url)
    if (done) return all
  }
  throw new Error(`Paycove ${path}: more than ${MAX_PAGES} pages`)
}

export interface PaycoveScheduledPayment {
  id: number
  deal_id: number
  number: number | null
  description: string | null
  due: string | null
  paid_at_date?: string | null
  paid_at?: string | null
  is_paid: number | boolean
  value: number | string
  payable?: number | boolean
}

export interface PaycoveDeal {
  id: number
  name: string | null
  deal_type: string | null
  status: string | null
  total_amount: number | string | null
  total_amount_paid: number | string | null
  remaining_balance: number | string | null
  payments_paid: number | null
  payments_unpaid: number | null
  payments_scheduled: number | null
  days_overdue: number | null
  crm_deal_id: string | null
  crm_contact_id: string | null
  created_at: string | null
  payments?: PaycoveScheduledPayment[]
}

export interface PaycoveContact {
  crm_contact_id: string | null
  name: string | null
  email: string | null
}

export function fetchDeals(token: string): Promise<PaycoveDeal[]> {
  return fetchAllPages<PaycoveDeal>(token, '/api/v1/deals', { limit: String(DEALS_PER_PAGE), include_payments: 'true' })
}

export function fetchContacts(token: string): Promise<PaycoveContact[]> {
  return fetchAllPages<PaycoveContact>(token, '/api/v1/contacts', { limit: String(CONTACTS_PER_PAGE) })
}

// ── Mapping (pure) ───────────────────────────────────────────────────────────

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// '2026-08-15', '2026-08-15T00:00:00.000000Z' or '2026-08-15 16:40:38' → '2026-08-15'; '08.23.21' (MM.DD.YY) → '2021-08-23'
export function toIsoDate(v: string | null | undefined): string | null {
  if (!v) return null
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dotted = /^(\d{2})\.(\d{2})\.(\d{2})$/.exec(v.trim())
  if (dotted) return `20${dotted[3]}-${dotted[1]}-${dotted[2]}`
  return null
}

// '2026-06-17 23:36:06' (UTC) or an ISO string → ISO timestamp; anything unreadable → null
function toTimestamp(v: string | null | undefined): string | null {
  if (!v) return null
  const d = new Date(v.includes('T') ? v : `${v.replace(' ', 'T')}Z`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function toDealRows(deals: PaycoveDeal[], contacts: PaycoveContact[], syncedAt: string) {
  const byCrmId = new Map<string, PaycoveContact>(
    contacts.filter((c) => c.crm_contact_id).map((c): [string, PaycoveContact] => [String(c.crm_contact_id), c])
  )
  const invoices = deals.filter((d) => (d.deal_type ?? 'invoice') === 'invoice')

  const dealRows = invoices.map((d) => {
    const contact = d.crm_contact_id ? byCrmId.get(String(d.crm_contact_id)) : undefined
    const email = contact?.email?.trim().toLowerCase() || null
    return {
      id: d.id,
      name: d.name,
      status: d.status,
      student_name: contact?.name?.trim() || null,
      student_email: email,
      total_amount: num(d.total_amount),
      total_amount_paid: num(d.total_amount_paid),
      remaining_balance: num(d.remaining_balance),
      payments_paid: d.payments_paid,
      payments_unpaid: d.payments_unpaid,
      payments_scheduled: d.payments_scheduled,
      days_overdue: d.days_overdue,
      crm_deal_id: d.crm_deal_id,
      crm_contact_id: d.crm_contact_id,
      created_in_paycove: toTimestamp(d.created_at),
      synced_at: syncedAt,
    }
  })

  const paymentRows = invoices.flatMap((d) =>
    (d.payments ?? []).map((p) => ({
      id: p.id,
      deal_id: d.id,
      number: p.number,
      description: p.description,
      due_on: toIsoDate(p.due),
      amount: num(p.value) ?? 0,
      is_paid: Boolean(Number(p.is_paid)),
      paid_on: toIsoDate(p.paid_at_date ?? p.paid_at),
      payable: p.payable === undefined ? true : Boolean(Number(p.payable)),
      synced_at: syncedAt,
    }))
  )

  return { dealRows, paymentRows }
}
