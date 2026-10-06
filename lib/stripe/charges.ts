const STRIPE_API = 'https://api.stripe.com/v1'
const PAGE_LIMIT = 100
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

interface StripeCustomer {
  id: string
  email?: string | null
  name?: string | null
  deleted?: boolean
}

export interface StripeCharge {
  id: string
  amount: number
  amount_refunded: number
  currency: string
  status: 'succeeded' | 'pending' | 'failed'
  created: number
  description: string | null
  payment_intent: string | null
  customer: string | StripeCustomer | null
  billing_details?: { email?: string | null; name?: string | null } | null
  receipt_email?: string | null
  failure_code: string | null
  failure_message: string | null
  outcome?: { seller_message?: string | null } | null
  payment_method_details?: { type?: string } | null
}

export interface PaymentRecord {
  id: string
  payment_intent: string | null
  customer_id: string | null
  customer_email: string | null
  customer_name: string | null
  amount: number
  amount_refunded: number
  currency: string
  status: 'succeeded' | 'pending' | 'failed'
  payment_method: string | null
  failure_code: string | null
  failure_message: string | null
  description: string | null
  created_at: string
  month: string
}

// 'Jan-26' in America/Chicago, matching contacts.month from the HubSpot sync
export function chicagoMonth(unixSeconds: number): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: 'numeric' })
    .formatToParts(new Date(unixSeconds * 1000))
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  return `${MONTH_SHORT[month - 1]}-${String(year).slice(2)}`
}

function clean(v: string | null | undefined): string | null {
  const t = v?.trim()
  return t ? t : null
}

export function toPaymentRecord(c: StripeCharge): PaymentRecord {
  const customer = c.customer && typeof c.customer === 'object' && !c.customer.deleted ? c.customer : null
  const customerId = typeof c.customer === 'string' ? c.customer : c.customer?.id ?? null
  const email = clean(customer?.email) ?? clean(c.billing_details?.email) ?? clean(c.receipt_email)

  return {
    id: c.id,
    payment_intent: c.payment_intent,
    customer_id: customerId,
    customer_email: email ? email.toLowerCase() : null,
    customer_name: clean(customer?.name) ?? clean(c.billing_details?.name),
    amount: c.amount / 100,
    amount_refunded: c.amount_refunded / 100,
    currency: c.currency,
    status: c.status,
    payment_method: c.payment_method_details?.type ?? null,
    failure_code: c.failure_code,
    failure_message: clean(c.failure_message) ?? (c.status === 'failed' ? clean(c.outcome?.seller_message) : null),
    description: clean(c.description),
    created_at: new Date(c.created * 1000).toISOString(),
    month: chicagoMonth(c.created),
  }
}

async function stripeGet<T>(path: string, params: URLSearchParams): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')

  const res = await fetch(`${STRIPE_API}${path}?${params}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message = body?.error?.message ?? res.statusText
    throw new Error(`Stripe ${res.status}: ${message}`)
  }
  return res.json() as Promise<T>
}

// Every charge created at or after `since`, newest first, with the customer expanded for email and name
export async function fetchChargesSince(since: Date): Promise<StripeCharge[]> {
  const charges: StripeCharge[] = []
  let startingAfter: string | undefined

  while (true) {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT), 'created[gte]': String(Math.floor(since.getTime() / 1000)) })
    params.append('expand[]', 'data.customer')
    if (startingAfter) params.set('starting_after', startingAfter)

    const page = await stripeGet<{ data: StripeCharge[]; has_more: boolean }>('/charges', params)
    charges.push(...page.data)
    if (!page.has_more || page.data.length === 0) break
    startingAfter = page.data[page.data.length - 1].id
  }

  return charges
}
