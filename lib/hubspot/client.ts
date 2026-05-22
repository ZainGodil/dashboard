const BASE = 'https://api.hubapi.com'

export async function hubspotFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) throw new Error('HUBSPOT_ACCESS_TOKEN is not set')

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HubSpot API error ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}
