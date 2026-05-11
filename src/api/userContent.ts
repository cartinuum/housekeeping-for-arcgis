import { useQuery } from '@tanstack/react-query'
import { request } from '@esri/arcgis-rest-request'
import type { ArcGISIdentityManager } from '@esri/arcgis-rest-request'
import type { ArcGISItem } from '../types/arcgis'
import { PORTAL_URL } from '../config'
import { mapItem } from './mapItem'

// Fetch all items from a folder, following pagination via nextStart
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

    // nextStart === -1 means no more pages
    if (data.nextStart === -1 || data.nextStart == null || batch.length === 0) break
    start = data.nextStart
  }

  return all
}

async function fetchUserContent(
  username: string,
  session: ArcGISIdentityManager
): Promise<ArcGISItem[]> {
  // Fetch root folder to get the folder list
  const rootData = await request(
    `${PORTAL_URL}/content/users/${encodeURIComponent(username)}`,
    { authentication: session }
  )

  const folderIds: (string | null)[] = [
    null,  // root
    ...(rootData.folders ?? []).map((f: Record<string, unknown>) => f.id as string),
  ]

  // Fetch all folders in parallel
  const perFolder = await Promise.all(
    folderIds.map(id => fetchFolder(username, id, session))
  )

  // Flatten and deduplicate by id (root listing can include items from subfolders)
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

export function useUserContent(
  username: string | null,
  session: ArcGISIdentityManager | null
) {
  return useQuery({
    queryKey: ['userContent', username],
    queryFn: () => fetchUserContent(username!, session!),
    enabled: !!username && !!session,
  })
}
