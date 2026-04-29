import type { ArcGISItem } from '../types/arcgis'

export function mapItem(raw: Record<string, unknown>): ArcGISItem {
  return {
    id: raw.id as string,
    title: raw.title as string,
    type: raw.type as string,
    size: (raw.size as number) ?? -1,
    modified: raw.modified as number,
    thumbnail: (raw.thumbnail as string) ?? null,
    snippet: (raw.snippet as string) ?? '',
    url: (raw.url as string) ?? '',
    access: raw.access as ArcGISItem['access'],
    owner: raw.owner as string,
    numViews: (raw.numViews as number) ?? 0,
    lastViewed: raw.lastViewed != null ? (raw.lastViewed as number) : undefined,
  }
}
