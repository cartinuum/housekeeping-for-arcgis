import { request } from '@esri/arcgis-rest-request'
import type { ArcGISIdentityManager } from '@esri/arcgis-rest-request'
import type { ArcGISItem } from '../types/arcgis'
import { PORTAL_URL } from '../config'
import { mapItem } from './mapItem'
import { calcCreditsPerMonth } from '../utils/credits'

// ── Types ────────────────────────────────────────────────────────────────────

// Raw shape from the analytics endpoint. Edge cases from live data:
//   title: 0     — unnamed/private item (numeric zero, not a string)
//   last_viewed: 0 — never viewed (numeric zero, not a date string)
interface AnalyticsItem {
  id: string
  title: string | 0
  owner: string
  deleted: boolean
  num_views: number
  last_viewed: string | 0
  total_credits: number
}

export type OrgDataSource = 'analytics' | 'fallback-storage'

export interface OrgAnalyticsResult {
  items: ArcGISItem[]
  source: OrgDataSource
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// startTime must be UTC midnight on the 1st of a month.
// Using local midnight is rejected by the server (verified 2026-05-06).
function startOfMonthUtc(monthsAgo: number): number {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1)
}

// Runs async task factories with at most `limit` in flight at a time.
// Preserves result order (index-aligned with input array).
async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const results = new Array<T>(tasks.length)
  let next = 0

  async function worker() {
    while (next < tasks.length) {
      const i = next++
      results[i] = await tasks[i]()
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

// ── Primary path (undocumented analytics endpoint) ────────────────────────────

async function fetchAnalyticsTopItems(
  session: ArcGISIdentityManager
): Promise<AnalyticsItem[]> {
  // Use fetch() directly — the analytics endpoint is undocumented and does not
  // follow the standard ArcGIS REST error envelope, so arcgis-rest-request's
  // error handling would misinterpret a failure response.
  const url = new URL(`${PORTAL_URL}/portals/self/analytics/topn`)
  url.searchParams.set('type', 'stg')
  url.searchParams.set('groupBy', 'item')
  url.searchParams.set('startTime', String(startOfMonthUtc(3)))
  url.searchParams.set('period', '3m')
  url.searchParams.set('f', 'json')
  url.searchParams.set('token', session.token)

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`Analytics endpoint returned HTTP ${response.status}`)
  }
  const data = await response.json()
  if (!Array.isArray(data?.data)) {
    throw new Error('Unexpected analytics response shape — data.data is not an array')
  }
  return data.data as AnalyticsItem[]
}

async function fetchItemDetail(
  id: string,
  session: ArcGISIdentityManager
): Promise<ArcGISItem | null> {
  try {
    const data = await request(`${PORTAL_URL}/content/items/${encodeURIComponent(id)}`, {
      authentication: session,
    })
    return mapItem(data)
  } catch {
    // Item may have been deleted between the analytics call and the detail fetch
    return null
  }
}

export async function fetchTopItemsByCredits(
  session: ArcGISIdentityManager
): Promise<ArcGISItem[]> {
  const analyticsItems = await fetchAnalyticsTopItems(session)

  // Exclude deleted items and any malformed entries without an id
  const active = analyticsItems.filter(a => !a.deleted && typeof a.id === 'string' && a.id)

  // Fetch full item metadata in parallel, throttled to avoid API rate limits.
  // /content/items/{id} gives us type, access, modified, thumbnail, etc.
  // size may still be -1 for hosted Feature Services — we use analyticsCredits
  // as the credit metric instead of the heuristic for those items.
  const tasks = active.map(a => () => fetchItemDetail(a.id, session))
  const details = await withConcurrency(tasks, 10)

  const result: ArcGISItem[] = []
  for (let i = 0; i < active.length; i++) {
    const detail = details[i]
    if (!detail) continue
    const a = active[i]
    // total_credits covers the 3-month period — divide by 3 for a per-month figure
    result.push({ ...detail, analyticsCredits: a.total_credits / 3 })
  }

  return result
}

// ── Fallback path (documented APIs only) ─────────────────────────────────────
// Mirrors the user-sampling logic in orgContent.ts. Used when the analytics
// endpoint is unavailable (404, 403, network error, or unexpected response shape).

const FALLBACK_TOP_USERS = 15
const FALLBACK_ITEMS_CAP = 800
const FALLBACK_USER_CONCURRENCY = 5

async function fetchFolderItems(
  username: string,
  folderId: string | null,
  session: ArcGISIdentityManager
): Promise<ArcGISItem[]> {
  const path = folderId
    ? `${PORTAL_URL}/content/users/${encodeURIComponent(username)}/${folderId}`
    : `${PORTAL_URL}/content/users/${encodeURIComponent(username)}`

  const all: ArcGISItem[] = []
  let start = 1

  while (true) {
    const data = await request(path, { authentication: session, params: { num: 100, start } })
    const batch: ArcGISItem[] = (data.items ?? []).map(mapItem)
    all.push(...batch)
    if (data.nextStart === -1 || data.nextStart == null || batch.length === 0) break
    start = data.nextStart
  }

  return all
}

async function fetchUserContent(
  username: string,
  session: ArcGISIdentityManager
): Promise<ArcGISItem[]> {
  const rootData = await request(
    `${PORTAL_URL}/content/users/${encodeURIComponent(username)}`,
    { authentication: session }
  )
  const folderIds: Array<string | null> = [
    null,
    ...(rootData.folders ?? []).map((f: Record<string, unknown>) => f.id as string),
  ]
  const perFolder = await Promise.all(
    folderIds.map(id => fetchFolderItems(username, id, session))
  )
  const seen = new Set<string>()
  const all: ArcGISItem[] = []
  for (const batch of perFolder) {
    for (const item of batch) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        all.push(item)
      }
    }
  }
  return all
}

export async function fetchTopItemsByStorageFallback(
  orgId: string,
  session: ArcGISIdentityManager
): Promise<ArcGISItem[]> {
  const usersData = await request(`${PORTAL_URL}/portals/${orgId}/users`, {
    authentication: session,
    params: { pnum: FALLBACK_TOP_USERS, sortField: 'storageusage', sortOrder: 'desc' },
  })
  const usernames: string[] = (usersData.users ?? []).map(
    (u: Record<string, unknown>) => u.username as string
  )
  if (usernames.length === 0) return []

  const tasks = usernames.map(username => () => fetchUserContent(username, session))
  const perUser = await withConcurrency(tasks, FALLBACK_USER_CONCURRENCY)
  const all = perUser.flat()

  return all
    .sort((a, b) => calcCreditsPerMonth(b.type, b.size) - calcCreditsPerMonth(a.type, a.size))
    .slice(0, FALLBACK_ITEMS_CAP)
}

// ── Public wrapper ────────────────────────────────────────────────────────────

export async function fetchOrgTopItems(
  orgId: string,
  session: ArcGISIdentityManager
): Promise<OrgAnalyticsResult> {
  try {
    const items = await fetchTopItemsByCredits(session)
    console.log('[orgAnalytics] Primary path succeeded:', items.length, 'items')
    return { items, source: 'analytics' }
  } catch (err) {
    console.warn('[orgAnalytics] Primary path failed — falling back to user-sampling:', err)
    const items = await fetchTopItemsByStorageFallback(orgId, session)
    console.log('[orgAnalytics] Fallback path returned:', items.length, 'items')
    return { items, source: 'fallback-storage' }
  }
}
