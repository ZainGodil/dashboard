const META_API_BASE = 'https://graph.facebook.com/v19.0'

export async function metaFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) throw new Error('META_ACCESS_TOKEN not configured')

  const qs = new URLSearchParams({ access_token: token, ...params })
  const url = `${META_API_BASE}${path}?${qs}`
  const res = await fetch(url)

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Meta API error ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

export function isMetaConfigured(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID)
}
