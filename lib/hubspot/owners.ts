import { hubspotFetch } from './client'

interface HubSpotOwner {
  id: string
  firstName: string
  lastName: string
  email: string
}

interface OwnersResponse {
  results: HubSpotOwner[]
}

export async function fetchOwnerMap(): Promise<Map<string, string>> {
  const data = await hubspotFetch<OwnersResponse>('/crm/v3/owners?limit=100')
  const map = new Map<string, string>()
  for (const owner of data.results) {
    const name = [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.email
    map.set(owner.id, name)
  }
  return map
}
