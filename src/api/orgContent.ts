import { useQuery } from '@tanstack/react-query'
import { request } from '@esri/arcgis-rest-request'
import type { ArcGISIdentityManager } from '@esri/arcgis-rest-request'
import type { ArcGISItem } from '../types/arcgis'
import { PORTAL_URL } from '../config'
import { mapItem } from './mapItem'
import { calcCreditsPerMonth } from '../utils/credits'

// User-sampling strategy: /search returns size:-1 for hosted Feature Services,
// making credits uncomputable. /content/users/{username} returns accurate sizes
// for all item types. We fetch the top N users by storage usage and aggregate
// their content — this surfaces the real credit consumers across the organisation.
const TOP_USERS = 50
const ITEMS_CAP = 500
const USER_CONCURRENCY = 5 // parallel user fetches at a time

export interface OrgContentResult {
  items: ArcGISItem[]
  total: number        // true org item count from a lightweight /search call
  truncated: boolean   // true when combined items exceeded ITEMS_CAP
  usersScanned: number // actual number of users sampled (≤ TOP_USERS)
}

// ─── Concurrency limiter ────────────────────────────────────────────────────
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

  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, worker)
  )
  return results
}

// ─── Per-user content fetch ─────────────────────────────────────────────────
// Mirrors the folder-aware pattern in userContent.ts — fetches root to discover
// folders, then fetches all folders in parallel, deduplicates by item id.
async function fetchFolder(
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
    const data = await request(path, {
      authentication: session,
      params: { num: 100, start },
    })
    const batch: ArcGISItem[] = (data.items ?? []).map(mapItem)
    all.push(...batch)
    if (data.nextStart === -1 || data.nextStart == null || batch.length === 0) break
    start = data.nextStart
  }

  return all
}

async function fetchSingleUserContent(
  username: string,
  session: ArcGISIdentityManager
): Promise<ArcGISItem[]> {
  // First call gets root items + folder list in one response
  const rootData = await request(
    `${PORTAL_URL}/content/users/${encodeURIComponent(username)}`,
    { authentication: session }
  )

  const folderIds: Array<string | null> = [
    null, // root
    ...(rootData.folders ?? []).map((f: Record<string, unknown>) => f.id as string),
  ]

  // Fetch all folders in parallel (within this single user)
  const perFolder = await Promise.all(
    folderIds.map(id => fetchFolder(username, id, session))
  )

  // Deduplicate — root listing sometimes includes items already listed in subfolders
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

// ─── Org-level fetch ────────────────────────────────────────────────────────
async function fetchOrgContent(
  orgId: string,
  session: ArcGISIdentityManager
): Promise<OrgContentResult> {
  // 1. Lightweight /search — true total item count for the sidebar display only.
  //    We don't use these items; this is a single num:1 call.
  const countData = await request(`${PORTAL_URL}/search`, {
    authentication: session,
    params: { q: `orgid:${orgId}`, num: 1 },
  })
  const total: number = countData.total ?? 0

  // 2. Fetch top N users sorted by storage usage via the Portal admin endpoint.
  //    /portals/{orgId}/users is the correct endpoint for this — it supports
  //    sortField=storageusage and returns a .users array.
  //    /community/users (the text search API) doesn't support storage sorting
  //    and returns .results, not .users.
  const usersData = await request(`${PORTAL_URL}/portals/${orgId}/users`, {
    authentication: session,
    params: {
      pnum: TOP_USERS,       // admin endpoint uses pnum, not num
      sortField: 'storageusage',
      sortOrder: 'desc',
    },
  })

  const usernames: string[] = (usersData.users ?? []).map(
    (u: Record<string, unknown>) => u.username as string
  )

  if (usernames.length === 0) {
    return { items: [], total, truncated: false, usersScanned: 0 }
  }

  // 3. Fetch each user's full content (all folders) in parallel, throttled to
  //    USER_CONCURRENCY users at a time to stay within API rate limits.
  //    /content/users/{username} returns accurate sizes for hosted Feature Services —
  //    this is the key difference from /search which returns size:-1.
  const tasks = usernames.map(
    username => () => fetchSingleUserContent(username, session)
  )
  const perUser = await withConcurrency(tasks, USER_CONCURRENCY)

  // 4. Flatten, sort by estimated monthly credits descending, cap at ITEMS_CAP.
  const all = perUser.flat()
  const sorted = all.sort(
    (a, b) => calcCreditsPerMonth(b.type, b.size) - calcCreditsPerMonth(a.type, a.size)
  )
  const items = sorted.slice(0, ITEMS_CAP)

  return {
    items,
    total,
    truncated: all.length > ITEMS_CAP,
    usersScanned: usernames.length,
  }
}

// ─── React Query hook ───────────────────────────────────────────────────────
export function useOrgContent(
  orgId: string | null,
  session: ArcGISIdentityManager | null
) {
  return useQuery({
    queryKey: ['orgContent', orgId],
    queryFn: () => fetchOrgContent(orgId!, session!),
    enabled: !!orgId && !!session,
    staleTime: 5 * 60 * 1000, // cache for 5 minutes — org data doesn't change mid-session
  })
}
