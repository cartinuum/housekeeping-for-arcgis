import { describe, it, expect } from 'vitest'
import { mapItem } from '../api/mapItem'
import { ownerInfoQueryOptions, dependencyCountsQueryOptions } from '../api/triageSignals'
import type { ArcGISIdentityManager } from '@esri/arcgis-rest-request'

describe('mapItem — lastViewed', () => {
  const base = {
    id: 'abc', title: 'Test', type: 'Web Map', size: -1,
    modified: 1700000000000, thumbnail: null, snippet: '',
    url: '', access: 'private', owner: 'user1', numViews: 5,
  }

  it('maps lastViewed when present', () => {
    const item = mapItem({ ...base, lastViewed: 1710000000000 })
    expect(item.lastViewed).toBe(1710000000000)
  })

  it('leaves lastViewed undefined when absent', () => {
    const item = mapItem(base)
    expect(item.lastViewed).toBeUndefined()
  })

  it('leaves lastViewed undefined when null', () => {
    const item = mapItem({ ...base, lastViewed: null })
    expect(item.lastViewed).toBeUndefined()
  })
})

describe('ownerInfoQueryOptions', () => {
  const session = {} as ArcGISIdentityManager

  it('builds the correct query key', () => {
    const opts = ownerInfoQueryOptions('testuser', session)
    expect(opts.queryKey).toEqual(['ownerInfo', 'testuser'])
  })

  it('uses a different query key per username', () => {
    const a = ownerInfoQueryOptions('alice', session)
    const b = ownerInfoQueryOptions('bob', session)
    expect(a.queryKey).not.toEqual(b.queryKey)
  })
})

describe('dependencyCountsQueryOptions', () => {
  const session = {} as ArcGISIdentityManager

  it('builds the correct query key', () => {
    const opts = dependencyCountsQueryOptions('item123', session)
    expect(opts.queryKey).toEqual(['dependencyCounts', 'item123'])
  })

  it('uses a different query key per item', () => {
    const a = dependencyCountsQueryOptions('item1', session)
    const b = dependencyCountsQueryOptions('item2', session)
    expect(a.queryKey).not.toEqual(b.queryKey)
  })
})
