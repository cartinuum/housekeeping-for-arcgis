import { useQuery } from '@tanstack/react-query'
import { request } from '@esri/arcgis-rest-request'
import type { ArcGISIdentityManager } from '@esri/arcgis-rest-request'
import { PORTAL_URL } from '../config'

export interface OrgUser {
  username: string
  fullName: string
}

async function searchOrgUsers(
  query: string,
  orgId: string,
  session: ArcGISIdentityManager
): Promise<OrgUser[]> {
  if (!query || query.length < 2) return []
  // /community/users with org-scoped query — supports text search by username and full name
  const data = await request(`${PORTAL_URL}/community/users`, {
    authentication: session,
    params: {
      // Plain text search within the org — field-specific syntax (fullname:ben*)
      // is not reliably supported; freetext + orgid filter works across username/fullname
      q: `orgid:${orgId} ${query}`,
      num: 20,
    },
  })
  interface RawUser { username: string; fullName: string }
  return (data.results ?? []).map((u: RawUser) => ({
    username: u.username,
    fullName: u.fullName,
  }))
}

export function useOrgUsers(
  query: string,
  orgId: string,
  session: ArcGISIdentityManager | null,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['orgUsers', orgId, query],
    queryFn: () => searchOrgUsers(query, orgId, session!),
    enabled: enabled && !!session && !!orgId && query.length >= 2,
  })
}
