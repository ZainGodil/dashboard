const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const ADS_BASE = 'https://googleads.googleapis.com/v20'

let cachedToken: string | null = null
let tokenExpiresAt = 0

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google OAuth token refresh failed: ${res.status} ${text}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  cachedToken = data.access_token
  tokenExpiresAt = Date.now() + data.expires_in * 1000
  return cachedToken
}

export async function googleAdsFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken()
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
  }
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId

  const url = path.startsWith('http') ? path : `${ADS_BASE}/customers/${customerId}${path}`
  const res = await fetch(url, { ...init, headers })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Ads API error ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}
