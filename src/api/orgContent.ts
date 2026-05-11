import { useQuery } from '@tanstack/react-query'
import { request } from '@esri/arcgis-rest-request'
import type { ArcGISIdentityManager } from '@esri/arcgis-rest-request'
import type { ArcGISItem } from '../types/arcgis'
import { PORTAL_URL } from '../config'
import { fetchOrgTopItems, type OrgDataSource } from './orgAnalytics'

export interface OrgContentResult {
  items: ArcGISItem[]
  total: number        // true org item count from a lightweight /search call
  source: OrgDataSource // which data path was used — for sidebar notice
}

async function fetchOrgContent(
  orgId: string,
  session: ArcGISIdentityManager
): Promise<OrgContentResult> {
  // Run the lightweight count call and the analytics fetch in parallel.
  // The count is for the sidebar display ("X items in org") — we don't use
  // its items. The analytics call provides the actual ranked content.
  const [countData, { items, source }] = await Promise.all([
    request(`${PORTAL_URL}/search`, {
      authentication: session,
      params: { q: `orgid:${orgId}`, num: 1 },
    }),
    fetchOrgTopItems(orgId, session),
  ])

  return { items, total: countData.total ?? 0, source }
}

export function useOrgContent(
  orgId: string | null,
  session: ArcGISIdentityManager | null
) {
  return useQuery({
    queryKey: ['orgContent', orgId],
    queryFn: () => fetchOrgContent(orgId!, session!),
    enabled: !!orgId && !!session,
    staleTime: 5 * 60 * 1000,
  })
}
