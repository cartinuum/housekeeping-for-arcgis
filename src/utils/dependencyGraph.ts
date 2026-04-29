import type { ArcGISItem, DependencyCounts, RelatedItemRef } from '../types/arcgis'

export interface GraphNode {
  id: string
  label: string
  type: string
  isRoot: boolean
  isWebMapScan: boolean  // true for nodes found via JSON scanning (not formal API)
  x: number
  y: number
  vx: number
  vy: number
  pinned: boolean
}

export interface GraphEdge {
  sourceId: string
  targetId: string
  direction: 'upstream' | 'downstream' | 'webmap'
}

export function truncateLabel(title: string, maxChars: number): string {
  if (title.length <= maxChars) return title
  return title.slice(0, maxChars - 1) + '…'
}

export function buildGraphData(
  rootItem: ArcGISItem,
  counts: DependencyCounts,
  cx: number,
  cy: number,
  webMapItems: RelatedItemRef[] = []
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  // Deduplicate neighbours — upstream takes precedence, then downstream, then webmap scans
  const neighbourMap = new Map<string, { ref: RelatedItemRef; direction: 'upstream' | 'downstream' | 'webmap' }>()
  for (const ref of counts.upstreamItems) {
    if (ref.id !== rootItem.id) {
      neighbourMap.set(ref.id, { ref, direction: 'upstream' })
    }
  }
  for (const ref of counts.downstreamItems) {
    if (ref.id !== rootItem.id && !neighbourMap.has(ref.id)) {
      neighbourMap.set(ref.id, { ref, direction: 'downstream' })
    }
  }
  // Web Map scan results — lowest precedence, don't override formal relationships
  for (const ref of webMapItems) {
    if (ref.id !== rootItem.id && !neighbourMap.has(ref.id)) {
      neighbourMap.set(ref.id, { ref, direction: 'webmap' })
    }
  }

  const neighbours = [...neighbourMap.values()]
  const n = neighbours.length
  const RADIUS = 160

  const rootNode: GraphNode = {
    id: rootItem.id,
    label: truncateLabel(rootItem.title, 18),
    type: rootItem.type,
    isRoot: true,
    isWebMapScan: false,
    x: cx,
    y: cy,
    vx: 0,
    vy: 0,
    pinned: true,
  }

  const neighbourNodes: GraphNode[] = neighbours.map(({ ref, direction }, i) => {
    const angle = n === 0 ? 0 : (2 * Math.PI * i) / n
    return {
      id: ref.id,
      label: truncateLabel(ref.title, 22),
      type: ref.type ?? '',
      isRoot: false,
      isWebMapScan: direction === 'webmap',
      x: cx + RADIUS * Math.cos(angle),
      y: cy + RADIUS * Math.sin(angle),
      vx: 0,
      vy: 0,
      pinned: false,
    }
  })

  const edges: GraphEdge[] = neighbours.map(({ ref, direction }) => ({
    sourceId: rootItem.id,
    targetId: ref.id,
    direction,
  }))

  return { nodes: [rootNode, ...neighbourNodes], edges }
}
