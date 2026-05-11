/**
 * Dependency scanner for detecting Web Map → Service references via JSON parsing.
 * 
 * **Why this exists:**
 * ArcGIS Online does not create formal relationships when users add Feature Services
 * to Web Maps via the UI. The REST API /relatedItems endpoint cannot see these
 * JSON-embedded layer references. This scanner fetches Web Map JSON directly and
 * parses operationalLayers for itemId/URL matches.
 * 
 * **Performance:**
 * - Target: <15 seconds for 500 Web Maps
 * - Approach: Parallel batch fetching (20 maps at a time)
 * - Early exit after 50 matches (sufficient signal)
 * - 5-minute cache (Web Map data rarely changes)
 * 
 * **Visibility:**
 * The scanner respects the signed-in user's permissions:
 * - Admin: Can see all org Web Maps (public, org, private from any owner)
 * - Non-admin: Only sees own Web Maps + public/org Web Maps they have access to
 * - Emulation mode: See "Scope behavior" below
 * 
 * **Scope behavior:**
 * - scope='own': Search only the target user's Web Maps
 * - scope='org': Search all Web Maps in org (admin only)
 * - Emulation mode: When admin is emulating user X, scope should be 'own' (X's content)
 * 
 * @see dependency_enhancement.md for full architecture documentation
 */

import { request } from '@esri/arcgis-rest-request'
import type { ArcGISIdentityManager } from '@esri/arcgis-rest-request'
import { PORTAL_URL } from '../config'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScanScope = 'own' | 'public' | 'org'
export type ScanPhase = 1 | 2 | 3

export interface WebMapDependencyMatch {
  itemId: string
  title: string
  type: string
  owner: string
  access: 'public' | 'org' | 'private'
  matchedIn: 'operationalLayers' | 'baseMap' | 'tables'
  layerTitle?: string  // Title of the layer that matched (if available)
}

export interface ScanProgress {
  phase: ScanPhase
  phaseLabel: string
  checked: number
  total: number
  matches: number
  isComplete: boolean
}

export interface ScanResult {
  items: WebMapDependencyMatch[]
  progress?: ScanProgress
}

interface WebMapSearchResult {
  id: string
  title: string
  type: string
  owner: string
  access: 'public' | 'org' | 'private'
}

interface OperationalLayer {
  itemId?: string
  url?: string
  title?: string
  layerType?: string
}

interface BaseMapLayer {
  itemId?: string
  url?: string
  title?: string
}

interface WebMapData {
  operationalLayers?: OperationalLayer[]
  baseMap?: {
    baseMapLayers?: BaseMapLayer[]
  }
  tables?: Array<{ itemId?: string; url?: string; title?: string }>
}

// ─── Configuration ────────────────────────────────────────────────────────────

const BATCH_SIZE = 20      // Parallel requests per batch (browser connection limit)

// ─── URL Normalization ────────────────────────────────────────────────────────

/**
 * Normalize a service URL for comparison.
 * - Remove protocol (http/https)
 * - Remove layer index (/0, /1, /FeatureServer/0, etc.)
 * - Remove trailing slash
 * - Lowercase for case-insensitive matching
 */
export function normalizeServiceUrl(url: string | undefined | null): string | null {
  if (!url) return null
  return url
    .replace(/^https?:\/\//, '')           // Remove protocol
    .replace(/\/FeatureServer\/\d+\/?$/, '/FeatureServer')  // Remove layer index
    .replace(/\/MapServer\/\d+\/?$/, '/MapServer')
    .replace(/\/ImageServer\/\d+\/?$/, '/ImageServer')
    .replace(/\/\d+\/?$/, '')              // Remove trailing layer index
    .replace(/\/$/, '')                    // Remove trailing slash
    .toLowerCase()
}

/**
 * Check if two service URLs refer to the same service.
 */
export function urlsMatch(url1: string | undefined | null, url2: string | undefined | null): boolean {
  const norm1 = normalizeServiceUrl(url1)
  const norm2 = normalizeServiceUrl(url2)
  if (!norm1 || !norm2) return false
  return norm1 === norm2
}

/**
 * Extract base service URL from an item.url field.
 * Example: "https://services.arcgis.com/.../FeatureServer/0" → "https://services.arcgis.com/.../FeatureServer"
 */
export function extractServiceUrl(itemUrl: string | undefined | null): string | null {
  if (!itemUrl) return null
  // Remove layer index if present
  return itemUrl
    .replace(/\/FeatureServer\/\d+$/, '/FeatureServer')
    .replace(/\/MapServer\/\d+$/, '/MapServer')
    .replace(/\/ImageServer\/\d+$/, '/ImageServer')
    .replace(/\/\d+$/, '')
}

// ─── Web Map Search ───────────────────────────────────────────────────────────

/**
 * Search for Web Maps and Web Scenes by scan scope.
 * 
 * Scope behavior:
 * - 'own': owner:{username} — User's own Web Maps (Phase 1)
 * - 'public': access:public — Public Web Maps (Phase 2)
 * - 'org': access:org — Org-shared Web Maps (Phase 3)
 * 
 * @param scanScope Phase-specific scope filter
 * @param username Target username (for 'own' scope)
 * @param orgId Org ID
 * @param session Authenticated session
 */
async function searchWebMapsByScope(
  scanScope: ScanScope,
  username: string | null,
  orgId: string,
  session: ArcGISIdentityManager
): Promise<WebMapSearchResult[]> {
  const results: WebMapSearchResult[] = []
  let start = 1
  
  // Build query based on scan scope
  let scopeQuery: string
  if (scanScope === 'own') {
    scopeQuery = username ? `owner:${username}` : `orgid:${orgId}`
  } else if (scanScope === 'public') {
    scopeQuery = `access:public AND orgid:${orgId}`
  } else {
    // 'org' scope — get ALL maps in org (public + org-shared + private that admin can see)
    // Note: private items not shared with admin will still return in search results
    // but will 403 when we try to fetch their /data — we handle this gracefully
    scopeQuery = `orgid:${orgId} NOT owner:${username || ''}`  // Exclude own maps (already scanned in Phase 1)
  }
  
  // Search for both Web Maps and Web Scenes (they both use operationalLayers)
  const query = `(type:"Web Map" OR type:"Web Scene") AND ${scopeQuery}`
  
  while (true) {
    const response = await request(`${PORTAL_URL}/search`, {
      params: {
        q: query,
        start,
        num: 100,  // Max per page
        sortField: 'modified',
        sortOrder: 'desc',
        f: 'json',
      },
      authentication: session,
    })
    
    const items = response.results || []
    for (const item of items) {
      results.push({
        id: item.id,
        title: item.title,
        type: item.type,
        owner: item.owner,
        access: item.access || 'private',
      })
    }
    
    // Check if more results exist
    if (response.nextStart === -1 || items.length === 0) break
    start = response.nextStart
  }
  
  return results
}

// ─── Web Map JSON Inspection ──────────────────────────────────────────────────

/**
 * Check if a Web Map or Web Scene's JSON contains a reference to the target service.
 * 
 * @param webMap Web Map or Web Scene metadata
 * @param serviceId Item ID of the target service
 * @param serviceUrl Normalized URL of the target service
 * @param session Authenticated session
 * @returns Match object if found, null otherwise
 */
async function checkWebMapForService(
  webMap: WebMapSearchResult,
  serviceId: string,
  serviceUrl: string | null,
  session: ArcGISIdentityManager
): Promise<WebMapDependencyMatch | null> {
  try {
    // Fetch Web Map JSON (typically 10-50KB)
    const data: WebMapData = await request(
      `${PORTAL_URL}/content/items/${webMap.id}/data`,
      { 
        authentication: session,
        httpMethod: 'GET',
      }
    )
    
    // Check operational layers
    const opLayers = data.operationalLayers || []
    for (const layer of opLayers) {
      if (
        layer.itemId === serviceId ||
        (serviceUrl && urlsMatch(layer.url, serviceUrl))
      ) {
        return {
          itemId: webMap.id,
          title: webMap.title,
          type: webMap.type,
          owner: webMap.owner,
          access: webMap.access,
          matchedIn: 'operationalLayers',
          layerTitle: layer.title,
        }
      }
    }
    
    // Check basemap layers
    const basemapLayers = data.baseMap?.baseMapLayers || []
    for (const layer of basemapLayers) {
      if (
        layer.itemId === serviceId ||
        (serviceUrl && urlsMatch(layer.url, serviceUrl))
      ) {
        return {
          itemId: webMap.id,
          title: webMap.title,
          type: webMap.type,
          owner: webMap.owner,
          access: webMap.access,
          matchedIn: 'baseMap',
          layerTitle: layer.title,
        }
      }
    }
    
    // Check tables (related tables in Web Map)
    const tables = data.tables || []
    for (const table of tables) {
      if (
        table.itemId === serviceId ||
        (serviceUrl && urlsMatch(table.url, serviceUrl))
      ) {
        return {
          itemId: webMap.id,
          title: webMap.title,
          type: webMap.type,
          owner: webMap.owner,
          access: webMap.access,
          matchedIn: 'tables',
          layerTitle: table.title,
        }
      }
    }
    
    return null
    
  } catch (err: unknown) {
    // Permission denied (403) — admin can see Web Map metadata but not data
    // This is expected for some private Web Maps in org-wide scan
    if (err && typeof err === 'object' && 'code' in err && err.code === 403) {
      return null
    }
    
    // Log other errors but continue scan
    console.warn(`Failed to check Web Map ${webMap.id}:`, err)
    return null
  }
}

// ─── Main Scanner ─────────────────────────────────────────────────────────────

/**
 * Scan Web Maps and Web Scenes for references to a target service.
 * 
 * **Phased Scanning Strategy:**
 * - Phase 1 (own): User's own Web Maps — fast, high value (2-4s)
 * - Phase 2 (public): Public Web Maps — medium value (3-5s)
 * - Phase 3 (org): Org-shared Web Maps — comprehensive (10-20s, optional)
 * 
 * **Performance:**
 * - Parallel batching (20 maps/scenes at a time)
 * - Progressive results via callback
 * - Stops after MAX_MATCHES to prevent runaway scans
 * 
 * @param serviceId Item ID of the service to find dependencies for
 * @param serviceItemUrl The item.url field from the service item (will be normalized)
 * @param scanScope Phase-specific scope: 'own' | 'public' | 'org'
 * @param username Target username (for 'own' scope)
 * @param orgId Organization ID
 * @param session Authenticated session
 * @param onProgress Optional callback for progress updates
 */
export async function scanWebMapsForService(
  serviceId: string,
  serviceItemUrl: string | null,
  scanScope: ScanScope,
  username: string | null,
  orgId: string,
  session: ArcGISIdentityManager,
  onProgress?: (progress: ScanProgress) => void
): Promise<WebMapDependencyMatch[]> {
  
  // Step 1: Search for Web Maps and Web Scenes in this phase's scope
  const allWebMaps = await searchWebMapsByScope(scanScope, username, orgId, session)
  
  // Determine phase number and label for UI
  const phaseMap: Record<ScanScope, { phase: ScanPhase; label: string }> = {
    own: { phase: 1, label: 'your Web Maps' },
    public: { phase: 2, label: 'public Web Maps' },
    org: { phase: 3, label: 'org-shared Web Maps' },
  }
  const { phase, label } = phaseMap[scanScope]
  
  if (allWebMaps.length === 0) {
    onProgress?.({ 
      phase, 
      phaseLabel: label, 
      checked: 0, 
      total: 0, 
      matches: 0,
      isComplete: true 
    })
    return []
  }
  
  // Normalize service URL once
  const normalizedServiceUrl = extractServiceUrl(serviceItemUrl)
  
  const matches: WebMapDependencyMatch[] = []
  let checked = 0
  
  // Step 2: Batch-process Web Maps (parallel within batch)
  const MAX_MATCHES = 200  // Scan thoroughly - cap at 200 to avoid excessive load
  for (let i = 0; i < allWebMaps.length; i += BATCH_SIZE) {
    const batch = allWebMaps.slice(i, i + BATCH_SIZE)
    
    // Parallel fetch within batch
    const results = await Promise.all(
      batch.map(webMap => 
        checkWebMapForService(webMap, serviceId, normalizedServiceUrl, session)
      )
    )
    
    // Collect matches
    for (const result of results) {
      if (result) {
        matches.push(result)
      }
    }
    
    checked += batch.length
    
    // Progress callback with phase info
    onProgress?.({
      phase,
      phaseLabel: label,
      checked,
      total: allWebMaps.length,
      matches: matches.length,
      isComplete: checked >= allWebMaps.length,
    })
    
    // Early exit if we found enough matches (rare, but prevents runaway scans)
    if (matches.length >= MAX_MATCHES) {
      break
    }
  }
  
  return matches
}
