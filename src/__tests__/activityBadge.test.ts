import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { classifyTier, formatViewedText } from '../utils/activityBadge'
import type { ArcGISItem } from '../types/arcgis'

const NOW = new Date('2026-04-24T12:00:00Z').getTime()

function makeItem(overrides: Partial<ArcGISItem> = {}): ArcGISItem {
  return {
    id: 'test-id',
    title: 'Test Item',
    type: 'Feature Service',
    size: 1_048_576,
    modified: NOW - 30 * 86_400_000,
    thumbnail: null,
    snippet: '',
    url: '',
    access: 'org',
    owner: 'testuser',
    numViews: 100,
    lastViewed: NOW - 5 * 86_400_000, // 5 days ago
    ...overrides,
  }
}

describe('classifyTier', () => {
  beforeEach(() => vi.setSystemTime(NOW))
  afterEach(() => vi.useRealTimers())

  it('returns dormant when numViews is 0', () => {
    const item = makeItem({ numViews: 0, lastViewed: NOW - 1 * 86_400_000 })
    expect(classifyTier(item)).toBe('dormant')
  })

  it('returns dormant when lastViewed is absent and numViews > 0', () => {
    const item = makeItem({ numViews: 50, lastViewed: undefined })
    expect(classifyTier(item)).toBe('dormant')
  })

  it('returns active when viewed within 7 days', () => {
    const item = makeItem({ lastViewed: NOW - 3 * 86_400_000 })
    expect(classifyTier(item)).toBe('active')
  })

  it('returns active on boundary (exactly 7 days)', () => {
    const item = makeItem({ lastViewed: NOW - 7 * 86_400_000 })
    expect(classifyTier(item)).toBe('active')
  })

  it('returns recent when viewed within 30 days', () => {
    const item = makeItem({ lastViewed: NOW - 15 * 86_400_000 })
    expect(classifyTier(item)).toBe('recent')
  })

  it('returns recent on boundary (exactly 30 days)', () => {
    const item = makeItem({ lastViewed: NOW - 30 * 86_400_000 })
    expect(classifyTier(item)).toBe('recent')
  })

  it('returns quiet when viewed within 365 days', () => {
    const item = makeItem({ lastViewed: NOW - 120 * 86_400_000 })
    expect(classifyTier(item)).toBe('quiet')
  })

  it('returns dormant when viewed more than 365 days ago', () => {
    const item = makeItem({ lastViewed: NOW - 400 * 86_400_000 })
    expect(classifyTier(item)).toBe('dormant')
  })
})

describe('formatViewedText', () => {
  beforeEach(() => vi.setSystemTime(NOW))
  afterEach(() => vi.useRealTimers())

  it('returns "Never viewed" when numViews is 0', () => {
    const item = makeItem({ numViews: 0, lastViewed: undefined })
    expect(formatViewedText(item)).toBe('Never viewed')
  })

  it('returns "Viewed (date unknown)" when numViews > 0 but no lastViewed', () => {
    const item = makeItem({ numViews: 10, lastViewed: undefined })
    expect(formatViewedText(item)).toBe('Viewed (date unknown)')
  })

  it('returns "Viewed today" for same-day access', () => {
    const item = makeItem({ lastViewed: NOW - 3_600_000 }) // 1 hour ago
    expect(formatViewedText(item)).toBe('Viewed today')
  })

  it('returns "Viewed yesterday" for 1-day-old access', () => {
    const item = makeItem({ lastViewed: NOW - 86_400_000 })
    expect(formatViewedText(item)).toBe('Viewed yesterday')
  })

  it('returns day count for recent access', () => {
    const item = makeItem({ lastViewed: NOW - 5 * 86_400_000 })
    expect(formatViewedText(item)).toBe('Viewed 5 days ago')
  })

  it('returns month count for month-range access', () => {
    const item = makeItem({ lastViewed: NOW - 60 * 86_400_000 })
    expect(formatViewedText(item)).toBe('Viewed 2 months ago')
  })

  it('returns year count for year-range access', () => {
    const item = makeItem({ lastViewed: NOW - 400 * 86_400_000 })
    expect(formatViewedText(item)).toBe('Viewed 1 year ago')
  })

  it('returns plural years', () => {
    const item = makeItem({ lastViewed: NOW - 800 * 86_400_000 })
    expect(formatViewedText(item)).toBe('Viewed 2 years ago')
  })
})
