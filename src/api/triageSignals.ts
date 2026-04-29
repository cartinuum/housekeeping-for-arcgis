import { useQuery, queryOptions } from '@tanstack/react-query'
import { request } from '@esri/arcgis-rest-request'
import type { ArcGISIdentityManager } from '@esri/arcgis-rest-request'
import { PORTAL_URL } from '../config'
import { useAppStore } from '../store/useAppStore'
import type { ArcGISItem, OwnerInfo, DependencyCounts, RelatedItemRef, UsageWindows, ServiceInfo } from '../types/arcgis'
import { scanWebMapsForService } from './dependencyScanner'

// ─── Owner info ───────────────────────────────────────────────────────────────

async function fetchOwnerInfo(username: string, session: ArcGISIdentityManager): Promise<OwnerInfo> {
  const data = await request(
    `${PORTAL_URL}/community/users/${encodeURIComponent(username)}`,
    { authentication: session }
  )
  return {
    email: (data.email as string) ?? null,
    fullName: (data.fullName as string) ?? username,
    disabled: (data.disabled as boolean) ?? false,
  }
}

export const ownerInfoQueryOptions = (username: string, session: ArcGISIdentityManager) =>
  queryOptions({
    queryKey: ['ownerInfo', username],
    queryFn: () => fetchOwnerInfo(username, session),
    staleTime: 5 * 60 * 1000,
  })

export function useOwnerInfo(username: string, session: ArcGISIdentityManager) {
  return useQuery(ownerInfoQueryOptions(username, session))
}

// ─── Dependency counts ────────────────────────────────────────────────────────

// Relationship types covered (both forward and reverse are queried per direction).
// WFSServer2Layer is omitted — WFS items are rare in typical AGOL orgs.
const RELATIONSHIP_TYPES = [
  'Map2Service',
  'WMA2Code',
  'Survey2Service',
  'Service2Data',
  'MobileMap2Service',
  'WMASetting2Code',
  'Map2FeatureCollection',
] as const

type RawRelatedItem = { id?: string; title?: string; type?: string }

// Fetch all unique related items for a given item + direction across all
// RELATIONSHIP_TYPES. Results are deduplicated by item ID.
async function fetchRelatedItems(
  itemId: string,
  direction: 'forward' | 'reverse',
  session: ArcGISIdentityManager,
  excludeIds: Set<string> = new Set()
): Promise<RelatedItemRef[]> {
  const batches = await Promise.all(
    RELATIONSHIP_TYPES.map(relationshipType =>
      request(`${PORTAL_URL}/content/items/${encodeURIComponent(itemId)}/relatedItems`, {
        params: { relationshipType, direction, f: 'json' },
        authentication: session,
      })
        .then((r: { relatedItems?: RawRelatedItem[] }) => r.relatedItems ?? [])
        .catch((): RawRelatedItem[] => [])
    )
  )
  const seen = new Set<string>(excludeIds)
  const items: RelatedItemRef[] = []
  for (const batch of batches) {
    for (const raw of batch) {
      if (raw.id && !seen.has(raw.id)) {
        seen.add(raw.id)
        items.push({ id: raw.id, title: raw.title ?? raw.id, type: raw.type ?? '' })
      }
    }
  }
  return items
}

async function fetchDependencyCounts(
  itemId: string,
  session: ArcGISIdentityManager
): Promise<DependencyCounts> {
  // One level deep in each direction. ArcGIS Online does not reliably expose
  // formal relatedItems links beyond this (e.g. Dashboard → Web Map chains are
  // embedded in item JSON, not the relationships API). The UI discloses this
  // limitation — see DepSection in TriageStrip.tsx.
  const [upstreamItems, downstreamItems] = await Promise.all([
    fetchRelatedItems(itemId, 'forward', session),
    fetchRelatedItems(itemId, 'reverse', session, new Set([itemId])),
  ])

  return {
    upstream: upstreamItems.length,
    downstream: downstreamItems.length,
    upstreamItems,
    downstreamItems,
  }
}

export const dependencyCountsQueryOptions = (
  itemId: string,
  session: ArcGISIdentityManager
) =>
  queryOptions({
    queryKey: ['dependencyCounts', itemId],
    queryFn: () => fetchDependencyCounts(itemId, session),
    staleTime: 5 * 60 * 1000,
  })

export function useDependencyCounts(itemId: string, session: ArcGISIdentityManager) {
  return useQuery(dependencyCountsQueryOptions(itemId, session))
}

// ─── Usage windows ────────────────────────────────────────────────────────────

// Correct approach (discovered via Python SDK HTTP trace, 2026-04-25):
// The portal usage endpoint filters by service name using groupby=name&name={serviceName}.
// This returns exactly 1 row per request rather than org-wide data.
//
// Only works for Feature/Map Services (items with a service URL). Portal items
// (Web Maps, Dashboards, etc.) have no service URL and return null — the component
// falls back to all-time numViews + lastViewed data.
//
// Single-request strategy: one 60D POST with daily granularity, split by timestamp
// boundary to derive both 30D and 60D totals. Stays within the 60D max block size.

/**
 * Extract service name and type from an item URL.
 * Returns null for portal items (Web Maps, Dashboards, Apps, etc.) that have no
 * service URL — those use the all-time numViews fallback instead.
 */
export function extractServiceInfo(itemUrl: string | null | undefined): ServiceInfo | null {
  if (!itemUrl) return null
  const match = itemUrl.match(
    /\/([^/]+)\/(FeatureServer|MapServer|ImageServer|VectorTileServer|SceneServer|GeometryServer|GPServer)/
  )
  if (!match) return null
  const stypeMap: Record<string, ServiceInfo['stype']> = {
    FeatureServer:     'features',
    MapServer:         'maps',
    ImageServer:       'image',
    VectorTileServer:  'vector',
    SceneServer:       'scene',
    GeometryServer:    'geometry',
    GPServer:          'gpserver',
  }
  return { name: match[1], stype: stypeMap[match[2]] }
}

type PortalUsageRow = {
  etype?: string
  name?: string
  stype?: string
  num?: Array<[string, string]>   // [[epochMsStr, countStr], ...]
}

async function fetchUsageWindows(
  serviceInfo: ServiceInfo,
  orgId: string,
  session: ArcGISIdentityManager
): Promise<UsageWindows> {
  const now = Date.now()
  const MS_PER_DAY = 86_400_000
  const sixtyDaysAgo = now - 60 * MS_PER_DAY
  const thirtyDaysAgo = now - 30 * MS_PER_DAY

  const response = (await request(
    `${PORTAL_URL}/portals/${encodeURIComponent(orgId)}/usage`,
    {
      params: {
        f: 'json',
        vars: 'num',
        etype: 'svcusg',
        groupby: 'name',             // ← key: groups by service name instead of returning org-wide data
        name: serviceInfo.name,      // ← the service name extracted from item.url
        stype: serviceInfo.stype,    // ← 'features' | 'maps' | 'image' | 'vector'
        startTime: sixtyDaysAgo.toString(),
        endTime: now.toString(),
        period: '1d',
      },
      authentication: session,
      httpMethod: 'GET',
    }
  )) as { data?: PortalUsageRow[] }

  let views30d = 0
  let views60d = 0

  for (const row of response.data ?? []) {
    if (!row.num || !Array.isArray(row.num)) continue
    for (const [tsStr, countStr] of row.num) {
      const count = parseInt(countStr, 10)
      if (isNaN(count) || count <= 0) continue
      views60d += count
      if (parseInt(tsStr, 10) >= thirtyDaysAgo) views30d += count
    }
  }

  return { views30d, views60d }
}

export const usageWindowsQueryOptions = (
  itemId: string,
  itemUrl: string | null | undefined,
  orgId: string,
  session: ArcGISIdentityManager
) => {
  const serviceInfo = extractServiceInfo(itemUrl)
  return queryOptions({
    queryKey: ['usageWindows', itemId, orgId],
    queryFn: () => fetchUsageWindows(serviceInfo!, orgId, session).catch(err => {
      const msg = err?.message ?? err?.code ?? JSON.stringify(err)
      console.error('[usageWindows] fetch failed', serviceInfo?.name, msg, err)
      throw err
    }),
    enabled: !!orgId && !!serviceInfo,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  })
}

export function useUsageWindows(
  itemId: string,
  itemUrl: string | null | undefined,
  orgId: string,
  session: ArcGISIdentityManager
) {
  return useQuery(usageWindowsQueryOptions(itemId, itemUrl, orgId, session))
}

// ─── Web Map dependencies (JSON parsing) ─────────────────────────────────────

/**
 * Check if an item type is a hosted service that could be used in Web Maps.
 * These item types should get Web Map dependency scanning.
 */
function isHostedService(itemType: string): boolean {
  return (
    itemType === 'Feature Service' ||
    itemType === 'Map Service' ||
    itemType === 'Image Service' ||
    itemType === 'Vector Tile Service' ||
    itemType === 'Scene Service'
  )
}

/**
 * Scan Web Maps for references to a service item (Phase 1 + 2 default).
 * 
 * **Only runs for hosted services** (Feature Service, Map Service, etc.)
 * 
 * **Phased Strategy (Fast Tier):**
 * - Phase 1: User's own Web Maps (2-4s, prefetched)
 * - Phase 2: Public Web Maps (3-5s)
 * - Total: <7s for most orgs ✅
 * 
 * **Tier 2 (Optional):**
 * - Phase 3: Org-shared Web Maps (triggered by button click, 10-20s)
 * 
 * @param item The service item to scan for
 * @param session Auth session
 * @param orgId Org ID
 * @param scanScope 'own' | 'public' | 'org' — which phase to run
 * @param username Username for 'own' scope
 */
export const webMapDependenciesQueryOptions = (
  item: ArcGISItem,
  session: ArcGISIdentityManager,
  orgId: string,
  scanScope: import('./dependencyScanner').ScanScope,
  username: string
) => {
  return queryOptions({
    queryKey: ['webMapDependencies', item.id, scanScope, username, orgId],
    queryFn: async (): Promise<import('./dependencyScanner').WebMapDependencyMatch[]> => {
      if (!isHostedService(item.type)) return []
      
      return await scanWebMapsForService(
        item.id,
        item.url,
        scanScope,
        username,
        orgId,
        session
      )
    },
    enabled: isHostedService(item.type) && !!orgId && !!username,
    staleTime: 5 * 60 * 1000,  // 5 min cache
    gcTime: 10 * 60 * 1000,     // Keep in cache for 10 min
    retry: 1,
  })
}

/**
 * Hook to fetch Web Map dependencies for a service item (Phase 1 + 2).
 * 
 * Automatically runs Phase 1 (own) + Phase 2 (public) for fast, high-value results.
 * Phase 3 (org) is triggered separately via UI button.
 */
export function useWebMapDependencies(
  item: ArcGISItem,
  session: ArcGISIdentityManager
) {
  const { orgId } = useAppStore()
  const signedInUsername = session.username ?? ''
  
  // Phase 1: User's own Web Maps (high value, fast)
  const phase1 = useQuery(
    webMapDependenciesQueryOptions(item, session, orgId ?? '', 'own', signedInUsername)
  )
  
  // Phase 2: Public Web Maps (medium value, still fast)
  const phase2 = useQuery({
    ...webMapDependenciesQueryOptions(item, session, orgId ?? '', 'public', signedInUsername),
    // Only start Phase 2 after Phase 1 completes
    enabled: phase1.isSuccess && isHostedService(item.type) && !!orgId,
  })
  
  // Combine results from both phases
  const combinedData = [
    ...(phase1.data ?? []),
    ...(phase2.data ?? []),
  ]
  
  // Deduplicate by itemId (in case a map appears in multiple phases)
  const uniqueData = Array.from(
    new Map(combinedData.map(m => [m.itemId, m])).values()
  )
  
  // Determine overall status
  const isLoading = phase1.isLoading || (phase1.isSuccess && phase2.isLoading)
  const isSuccess = phase2.isSuccess || (phase1.isSuccess && !phase2.isLoading)
  const fetchStatus = isLoading ? 'fetching' : 'idle'
  
  return {
    data: uniqueData,
    isLoading,
    isSuccess,
    fetchStatus,
    phase1Status: phase1.status,
    phase2Status: phase2.status,
    currentPhase: phase1.isLoading ? 1 : phase2.isLoading ? 2 : undefined,
  }
}

/**
 * Hook for Phase 3 (org-wide scan) — triggered manually by user.
 * Returns null if not enabled; otherwise runs comprehensive org scan.
 */
export function useWebMapDependenciesPhase3(
  item: ArcGISItem,
  session: ArcGISIdentityManager,
  enabled: boolean
) {
  const { orgId } = useAppStore()
  const signedInUsername = session.username ?? ''
  
  return useQuery({
    ...webMapDependenciesQueryOptions(item, session, orgId ?? '', 'org', signedInUsername),
    enabled: enabled && isHostedService(item.type) && !!orgId,
  })
}

// ─── Facade ───────────────────────────────────────────────────────────────────

export function useTriageSignals(item: ArcGISItem, session: ArcGISIdentityManager) {
  const { orgId } = useAppStore()
  const owner = useOwnerInfo(item.owner, session)
  const dependencies = useDependencyCounts(item.id, session)
  const usageWindows = useUsageWindows(item.id, item.url, orgId ?? '', session)
  const webMapDeps = useWebMapDependencies(item, session)
  return { owner, dependencies, usageWindows, webMapDeps }
}
