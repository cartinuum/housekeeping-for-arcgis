import { useQuery } from '@tanstack/react-query'
import { request } from '@esri/arcgis-rest-request'
import type { ArcGISIdentityManager } from '@esri/arcgis-rest-request'
import type { UserInfo } from '../types/arcgis'
import { PORTAL_URL } from '../config'

async function fetchUserInfo(
  username: string,
  session: ArcGISIdentityManager
): Promise<UserInfo> {
  const data = await request(
    `${PORTAL_URL}/community/users/${encodeURIComponent(username)}`,
    { authentication: session }
  )
  return {
    username: data.username,
    fullName: data.fullName,
    thumbnail: data.thumbnail ?? null,
    role: data.role,
    orgId: data.orgId,
    privileges: Array.isArray(data.privileges) ? (data.privileges as string[]) : [],
  }
}

export function useUserInfo(
  username: string | null,
  session: ArcGISIdentityManager | null
) {
  return useQuery({
    queryKey: ['userInfo', username],
    queryFn: () => fetchUserInfo(username!, session!),
    enabled: !!username && !!session,
  })
}

/** Fetches /portals/self to get the org's portal hostname for item URL construction. */
export function usePortalSelf(session: ArcGISIdentityManager | null) {
  return useQuery<string | null>({
    queryKey: ['portalSelf'],
    queryFn: async () => {
      const data = await request(`${PORTAL_URL}/portals/self`, { authentication: session! })
      return (data.portalHostname as string) ?? null
    },
    enabled: !!session,
    staleTime: Infinity, // org hostname never changes during a session
  })
}
