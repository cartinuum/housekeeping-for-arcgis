import { describe, it, expect } from 'vitest'
import { applyFilters } from '../utils/filters'
import type { ArcGISItem } from '../types/arcgis'

const BASE_ITEM: ArcGISItem = {
  id: 'test-1',
  title: 'Test Item',
  type: 'Web Map',
  size: 1_048_576,
  modified: Date.now(),
  thumbnail: null,
  snippet: '',
  url: '',
  access: 'private',
  owner: 'testuser',
  numViews: 0,
}

const NO_FILTER = {
  types: [],
  minSizeBytes: null,
  maxSizeBytes: null,
  modifiedDaysAgo: null,
  minCredits: null,
  maxCredits: null,
}

describe('applyFilters — modifiedDaysAgo', () => {
  it('shows items NOT modified in the last 90 days (stale)', () => {
    const now = Date.now()
    const staleItem = { ...BASE_ITEM, id: 'stale', modified: now - 91 * 86_400_000 }
    const recentItem = { ...BASE_ITEM, id: 'recent', modified: now - 30 * 86_400_000 }

    const result = applyFilters([staleItem, recentItem], { ...NO_FILTER, modifiedDaysAgo: 90 })

    expect(result.map(i => i.id)).toContain('stale')
    expect(result.map(i => i.id)).not.toContain('recent')
  })

  it('shows all items when modifiedDaysAgo is null', () => {
    const now = Date.now()
    const staleItem = { ...BASE_ITEM, id: 'stale', modified: now - 500 * 86_400_000 }
    const recentItem = { ...BASE_ITEM, id: 'recent', modified: now - 5 * 86_400_000 }

    const result = applyFilters([staleItem, recentItem], { ...NO_FILTER, modifiedDaysAgo: null })

    expect(result).toHaveLength(2)
  })

  it('item modified exactly at the cutoff boundary is excluded (strictly older required)', () => {
    const now = Date.now()
    const atBoundary = { ...BASE_ITEM, id: 'boundary', modified: now - 90 * 86_400_000 }

    const result = applyFilters([atBoundary], { ...NO_FILTER, modifiedDaysAgo: 90 })

    // modified === cutoff means "modified exactly 90 days ago" — not stale enough, exclude
    expect(result).toHaveLength(0)
  })
})

describe('applyFilters — minCredits', () => {
  it('excludes items below the credit threshold', () => {
    // Feature Service at 10 MB = 2.4 cr/mo; Web Map at 0 bytes = 0 cr/mo
    const featureService = { ...BASE_ITEM, id: 'fs', type: 'Feature Service', size: 10_485_760 }
    const webMap = { ...BASE_ITEM, id: 'wm', type: 'Web Map', size: 0 }

    const result = applyFilters([featureService, webMap], { ...NO_FILTER, minCredits: 1 })

    expect(result.map(i => i.id)).toContain('fs')
    expect(result.map(i => i.id)).not.toContain('wm')
  })

  it('shows all items when minCredits is null', () => {
    const featureService = { ...BASE_ITEM, id: 'fs', type: 'Feature Service', size: 10_485_760 }
    const webMap = { ...BASE_ITEM, id: 'wm', type: 'Web Map', size: 0 }

    const result = applyFilters([featureService, webMap], { ...NO_FILTER, minCredits: null })

    expect(result).toHaveLength(2)
  })
})
