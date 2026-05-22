const BASE = 'https://api.hubapi.com'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function hubspotFetch<T>(path: string, options: RequestInit = {}, retries = 4): Promise<T> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) throw new Error('HUBSPOT_ACCESS_TOKEN is not set')

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    signal: AbortSignal.timeout(25000),
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (res.status === 429 && retries > 0) {
    const retryAfter = res.headers.get('Retry-After')
    const delay = Math.min(retryAfter ? parseInt(retryAfter, 10) * 1000 : 1500, 3000)
    await sleep(delay)
    return hubspotFetch<T>(path, options, retries - 1)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HubSpot API error ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}
