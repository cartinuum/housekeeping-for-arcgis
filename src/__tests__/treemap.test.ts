import { describe, it, expect } from 'vitest'
import { buildTreemapData, buildTypeColourMap } from '../utils/treemap'
import type { ArcGISItem } from '../types/arcgis'

function makeItem(overrides: Partial<ArcGISItem>): ArcGISItem {
  return {
    id: 'id1',
    title: 'Test',
    type: 'Web Map',
    size: 0,
    modified: Date.now(),
    thumbnail: null,
    snippet: '',
    url: '',
    access: 'private',
    owner: 'user1',
    numViews: 0,
    ...overrides,
  }
}

describe('buildTreemapData', () => {
  it('groups items by type', () => {
    const items: ArcGISItem[] = [
      makeItem({ id: '1', type: 'Feature Service', size: 10 * 1_048_576 }),
      makeItem({ id: '2', type: 'Feature Service', size: 10 * 1_048_576 }),
      makeItem({ id: '3', type: 'Web Map', size: 0 }),
    ]
    const result = buildTreemapData(items, 'credits')
    const featureSvc = result.find(n => n.name === 'Feature Service')
    expect(featureSvc).toBeDefined()
    expect(featureSvc!.children).toHaveLength(2)
  })

  it('collapses types beyond top 5 into "Other"', () => {
    const types = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
    const items = types.map((type, i) =>
      makeItem({ id: String(i), type, size: (types.length - i) * 1_048_576 })
    )
    const result = buildTreemapData(items, 'credits')
    // Should have at most 6 groups: top 5 + Other
    expect(result.length).toBeLessThanOrEqual(6)
    const other = result.find(n => n.name === 'Other')
    expect(other).toBeDefined()
  })

  it('uses numViews as value when metric is views', () => {
    const items: ArcGISItem[] = [
      makeItem({ id: '1', type: 'Web Map', size: 0, numViews: 500 }),
      makeItem({ id: '2', type: 'Web Map', size: 0, numViews: 300 }),
    ]
    const result = buildTreemapData(items, 'views')
    const webMap = result.find(n => n.name === 'Web Map')
    expect(webMap).toBeDefined()
    expect(webMap!.value).toBe(800)
  })

  it('assigns a colour to each group', () => {
    const items = [makeItem({ id: '1', type: 'Feature Service', size: 1_048_576 })]
    const result = buildTreemapData(items, 'credits')
    expect(result[0].itemStyle.color).toBeDefined()
    expect(result[0].itemStyle.color).toMatch(/^#/)
  })

  it('returns empty array for empty item list', () => {
    expect(buildTreemapData([], 'credits')).toEqual([])
  })
})

describe('buildTypeColourMap', () => {
  it('assigns top-ranked type the first colour', () => {
    const items = [
      makeItem({ id: '1', type: 'Feature Service', size: 10 * 1_048_576 }),
      makeItem({ id: '2', type: 'Feature Service', size: 10 * 1_048_576 }),
      makeItem({ id: '3', type: 'Map Service', size: 5 * 1_048_576 }),
    ]
    const map = buildTypeColourMap(items, 'credits')
    // Feature Service is #1 by credits → TYPE_COLOURS[0] = '#de2900'
    expect(map.get('Feature Service')).toBe('#de2900')
    // Map Service is #2 → TYPE_COLOURS[1] = '#338033'
    expect(map.get('Map Service')).toBe('#338033')
  })

  it('assigns OTHER_COLOUR to types beyond top 5', () => {
    const types = ['A', 'B', 'C', 'D', 'E', 'F']
    const items = types.map((type, i) =>
      makeItem({ id: String(i), type, size: (types.length - i) * 1_048_576 })
    )
    const map = buildTypeColourMap(items, 'credits')
    expect(map.get('F')).toBe('#595959') // OTHER_COLOUR
  })
})

describe('buildTreemapData with typeColourMap', () => {
  it('uses stable colour map so filtered items keep original colour', () => {
    const allItems = [
      makeItem({ id: '1', type: 'Feature Service', size: 10 * 1_048_576 }),
      makeItem({ id: '2', type: 'Feature Service', size: 10 * 1_048_576 }),
      makeItem({ id: '3', type: 'Map Service', size: 5 * 1_048_576 }),
    ]
    const stableMap = buildTypeColourMap(allItems, 'credits')

    // Filter to only Map Service — without stable map it would become rank #0 → red
    const filtered = allItems.filter(i => i.type === 'Map Service')
    const groups = buildTreemapData(filtered, 'credits', stableMap)

    // Map Service should keep its stable colour (#338033), not become red (#de2900)
    expect(groups[0].colour).toBe('#338033')
    expect(groups[0].itemStyle.color).toBe('#338033')
    expect(groups[0].children[0].itemStyle.color).toBe('#338033')
  })
})
