import { describe, it, expect } from 'vitest'
import { truncateLabel, buildGraphData } from '../utils/dependencyGraph'
import type { ArcGISItem, DependencyCounts } from '../types/arcgis'

const NOW = new Date('2026-04-24T12:00:00Z').getTime()

function makeItem(overrides: Partial<ArcGISItem> = {}): ArcGISItem {
  return {
    id: 'root-id',
    title: 'Root Item',
    type: 'Feature Service',
    size: 1_048_576,
    modified: NOW - 30 * 86_400_000,
    thumbnail: null,
    snippet: '',
    url: '',
    access: 'org',
    owner: 'testuser',
    numViews: 100,
    ...overrides,
  }
}

function makeCounts(overrides: Partial<DependencyCounts> = {}): DependencyCounts {
  return {
    upstream: 0,
    downstream: 0,
    upstreamItems: [],
    downstreamItems: [],
    ...overrides,
  }
}

describe('truncateLabel', () => {
  it('returns the title unchanged when within maxChars', () => {
    expect(truncateLabel('Short title', 22)).toBe('Short title')
  })

  it('truncates and appends ellipsis when over maxChars', () => {
    const result = truncateLabel('A very long title that exceeds the limit', 22)
    expect(result).toHaveLength(22)
    expect(result.endsWith('…')).toBe(true)
  })

  it('handles title exactly at maxChars length', () => {
    const title = 'Exactly twenty-one ch'  // 21 chars
    expect(truncateLabel(title, 21)).toBe(title)
  })

  it('truncates title that is exactly one char over maxChars', () => {
    const result = truncateLabel('01234567890123456789012', 22) // 23 chars, limit 22
    expect(result).toHaveLength(22)
    expect(result).toBe('012345678901234567890…')
  })
})

describe('buildGraphData', () => {
  it('places root node at (cx, cy) with isRoot=true', () => {
    const { nodes } = buildGraphData(makeItem(), makeCounts(), 400, 300)
    const root = nodes.find(n => n.isRoot)!
    expect(root).toBeDefined()
    expect(root.x).toBe(400)
    expect(root.y).toBe(300)
    expect(root.id).toBe('root-id')
  })

  it('returns only root when no neighbours', () => {
    const { nodes, edges } = buildGraphData(makeItem(), makeCounts(), 400, 300)
    expect(nodes).toHaveLength(1)
    expect(edges).toHaveLength(0)
  })

  it('creates one node and one edge per upstream item', () => {
    const counts = makeCounts({
      upstream: 2,
      upstreamItems: [
        { id: 'a', title: 'Alpha', type: 'Web Map' },
        { id: 'b', title: 'Beta', type: 'Web Map' },
      ],
    })
    const { nodes, edges } = buildGraphData(makeItem(), counts, 400, 300)
    expect(nodes).toHaveLength(3) // root + 2
    expect(edges).toHaveLength(2)
    expect(edges.every(e => e.direction === 'upstream')).toBe(true)
  })

  it('creates one node and one edge per downstream item', () => {
    const counts = makeCounts({
      downstream: 1,
      downstreamItems: [{ id: 'c', title: 'Child', type: 'Dashboard' }],
    })
    const { nodes, edges } = buildGraphData(makeItem(), counts, 400, 300)
    expect(nodes).toHaveLength(2)
    expect(edges[0].direction).toBe('downstream')
  })

  it('deduplicates items that appear in both upstream and downstream', () => {
    const counts = makeCounts({
      upstream: 1,
      upstreamItems: [{ id: 'shared', title: 'Shared', type: 'Feature Layer' }],
      downstream: 1,
      downstreamItems: [{ id: 'shared', title: 'Shared', type: 'Feature Layer' }],
    })
    const { nodes, edges } = buildGraphData(makeItem(), counts, 400, 300)
    expect(nodes).toHaveLength(2) // root + 1 (deduplicated)
    expect(edges).toHaveLength(1)
    expect(edges[0].direction).toBe('upstream') // upstream takes precedence
  })

  it('excludes root item if it appears in dep lists', () => {
    const counts = makeCounts({
      upstream: 1,
      upstreamItems: [{ id: 'root-id', title: 'Root Item', type: 'Feature Service' }],
    })
    const { nodes } = buildGraphData(makeItem(), counts, 400, 300)
    expect(nodes).toHaveLength(1) // only root, self-reference excluded
  })

  it('uses root item id as sourceId in all edges', () => {
    const counts = makeCounts({
      downstream: 2,
      downstreamItems: [
        { id: 'x', title: 'X', type: 'Web Map' },
        { id: 'y', title: 'Y', type: 'Web Map' },
      ],
    })
    const { edges } = buildGraphData(makeItem(), counts, 400, 300)
    expect(edges.every(e => e.sourceId === 'root-id')).toBe(true)
    expect(edges.map(e => e.targetId).sort()).toEqual(['x', 'y'])
  })

  it('truncates long neighbour labels to 22 chars', () => {
    const longTitle = 'A very long title that exceeds twenty-two characters easily'
    const counts = makeCounts({
      downstream: 1,
      downstreamItems: [{ id: 'z', title: longTitle, type: 'Web Map' }],
    })
    const { nodes } = buildGraphData(makeItem(), counts, 400, 300)
    const neighbour = nodes.find(n => !n.isRoot)!
    expect(neighbour.label.length).toBe(22)
    expect(neighbour.label.endsWith('…')).toBe(true)
  })

  it('truncates root label to 18 chars', () => {
    const item = makeItem({ title: 'A very long root item title that is too long' })
    const { nodes } = buildGraphData(item, makeCounts(), 400, 300)
    const root = nodes.find(n => n.isRoot)!
    expect(root.label.length).toBe(18)
  })

  it('assigns neighbour nodes positions on a circle around root', () => {
    const counts = makeCounts({
      downstream: 4,
      downstreamItems: [
        { id: 'a', title: 'A', type: 'Web Map' },
        { id: 'b', title: 'B', type: 'Web Map' },
        { id: 'c', title: 'C', type: 'Web Map' },
        { id: 'd', title: 'D', type: 'Web Map' },
      ],
    })
    const cx = 400, cy = 300
    const { nodes } = buildGraphData(makeItem(), counts, cx, cy)
    const neighbours = nodes.filter(n => !n.isRoot)
    // Each neighbour should be ~160px from root
    for (const n of neighbours) {
      const dist = Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2)
      expect(dist).toBeCloseTo(160, 0)
    }
  })
})
