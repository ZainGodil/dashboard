const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const ADS_BASE = 'https://googleads.googleapis.com/v24'

let cachedToken: string | null = null
let tokenExpiresAt = 0

function base64url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken

  const keyJson = process.env.GOOGLE_ADS_SERVICE_ACCOUNT_KEY
  if (!keyJson) throw new Error('GOOGLE_ADS_SERVICE_ACCOUNT_KEY is not set')

  const sa = JSON.parse(keyJson) as { client_email: string; private_key: string }
  const now = Math.floor(Date.now() / 1000)

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/adwords',
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }))

  const { createSign } = await import('crypto')
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${payload}`)
  const sig = signer.sign(sa.private_key, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${payload}.${sig}`,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google service account token exchange failed: ${res.status} ${text}`)
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
