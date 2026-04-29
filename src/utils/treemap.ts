import { calcCreditsPerMonth } from './credits'
import type { ArcGISItem } from '../types/arcgis'
import type { ActiveMetric } from '../store/useAppStore'

export const TYPE_COLOURS = [
  '#de2900', // rank 1
  '#338033', // rank 2
  '#e4d154', // rank 3
  '#0079c1', // rank 4
  '#e8912e', // rank 5
] as const

export const OTHER_COLOUR = '#595959'

export interface TreemapItemNode {
  name: string
  value: number
  credits: number
  item: ArcGISItem
  itemStyle: { color: string; borderColor?: string; borderWidth?: number }
}

export interface TreemapGroupNode {
  name: string
  value: number
  colour: string
  children: TreemapItemNode[]
  itemStyle: { color: string }
}

export function itemValue(item: ArcGISItem, metric: ActiveMetric): number {
  if (metric === 'views') return item.numViews
  if (metric === 'size') return Math.max(0, item.size)
  return calcCreditsPerMonth(item.type, item.size)
}

/**
 * Build a stable type→colour map from the FULL (unfiltered) item set.
 * Pass the result into buildTreemapData so colours never shift when filtering.
 */
export function buildTypeColourMap(
  items: ArcGISItem[],
  metric: ActiveMetric
): Map<string, string> {
  const totals = new Map<string, number>()
  for (const item of items) {
    totals.set(item.type, (totals.get(item.type) ?? 0) + itemValue(item, metric))
  }
  const ranked = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])
  const map = new Map<string, string>()
  ranked.forEach(([type], index) => {
    map.set(type, index < 5 ? TYPE_COLOURS[index] : OTHER_COLOUR)
  })
  return map
}

/**
 * @param typeColourMap Optional stable colour map from buildTypeColourMap.
 *   When provided, colours are looked up from the map (stable across filters).
 *   When omitted, colours are assigned by current rank (legacy behaviour).
 * @param selectedIds Optional set of item IDs currently in the review basket.
 *   Selected items get a distinct teal border so they're identifiable in the treemap.
 */
export function buildTreemapData(
  items: ArcGISItem[],
  metric: ActiveMetric,
  typeColourMap?: Map<string, string>,
  selectedIds?: Set<string>
): TreemapGroupNode[] {
  if (items.length === 0) return []

  const groups = new Map<string, ArcGISItem[]>()
  for (const item of items) {
    const bucket = groups.get(item.type) ?? []
    bucket.push(item)
    groups.set(item.type, bucket)
  }

  const ranked = Array.from(groups.entries())
    .map(([type, groupItems]) => ({
      type,
      items: groupItems,
      total: groupItems.reduce((sum, i) => sum + itemValue(i, metric), 0),
    }))
    .sort((a, b) => b.total - a.total)

  function colourFor(type: string, rankIndex: number): string {
    if (typeColourMap) return typeColourMap.get(type) ?? OTHER_COLOUR
    return rankIndex < 5 ? TYPE_COLOURS[rankIndex] : OTHER_COLOUR
  }

  const top5 = ranked.slice(0, 5)
  const rest = ranked.slice(5)

  // Minimum display value — ensures zero-credit/zero-size items (Web Maps, Dashboards, etc.)
  // still appear as tiny tiles rather than being silently dropped by ECharts.
  const MIN_VALUE = 0.01

  function itemNode(item: ArcGISItem, colour: string): TreemapItemNode {
    const inBasket = selectedIds?.has(item.id) ?? false
    return {
      name: item.title,
      value: Math.max(itemValue(item, metric), MIN_VALUE),
      credits: calcCreditsPerMonth(item.type, item.size),
      item,
      itemStyle: inBasket
        ? { color: colour, borderColor: '#00d4aa', borderWidth: 3 }
        : { color: colour },
    }
  }

  const result: TreemapGroupNode[] = top5.map((group, index) => {
    const colour = colourFor(group.type, index)
    return {
      name: group.type,
      value: group.total,
      colour,
      itemStyle: { color: colour },
      children: group.items.map(item => itemNode(item, colour)),
    }
  })

  if (rest.length > 0) {
    const otherItems = rest.flatMap(g => g.items)
    const otherTotal = rest.reduce((sum, g) => sum + g.total, 0)
    result.push({
      name: 'Other',
      value: otherTotal,
      colour: OTHER_COLOUR,
      itemStyle: { color: OTHER_COLOUR },
      children: otherItems.map(item => itemNode(item, OTHER_COLOUR)),
    })
  }

  return result
}
