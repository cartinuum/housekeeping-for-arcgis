import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { classifyUsageWindows, validateLastViewed } from '../utils/usageSignal'

const NOW = new Date('2026-04-24T12:00:00Z').getTime()

describe('classifyUsageWindows', () => {
  it('critical — zero views in both windows', () => {
    const cls = classifyUsageWindows(0, 0)
    expect(cls.tier).toBe('critical')
    expect(cls.kind).toBe('danger')
    expect(cls.message).toContain('Deletion candidate')
  })

  it('critical — zero 30D views and ≤10 in 60D', () => {
    const cls = classifyUsageWindows(0, 7)
    expect(cls.tier).toBe('critical')
    expect(cls.kind).toBe('danger')
  })

  it('warning — zero 30D views but >10 in 60D (recently went quiet)', () => {
    const cls = classifyUsageWindows(0, 50)
    expect(cls.tier).toBe('warning')
    expect(cls.kind).toBe('warning')
    expect(cls.message).toContain('Review recommended')
  })

  it('warning — ≤10 views in 30D', () => {
    const cls = classifyUsageWindows(5, 40)
    expect(cls.tier).toBe('warning')
    expect(cls.kind).toBe('warning')
  })

  it('warning — exactly 10 views in 30D', () => {
    const cls = classifyUsageWindows(10, 80)
    expect(cls.tier).toBe('warning')
  })

  it('active — 11+ views in 30D', () => {
    const cls = classifyUsageWindows(11, 90)
    expect(cls.tier).toBe('active')
    expect(cls.kind).toBe('success')
    expect(cls.message).toBe('Active usage')
  })

  it('active — high view counts', () => {
    const cls = classifyUsageWindows(200, 800)
    expect(cls.tier).toBe('active')
  })
})

describe('validateLastViewed', () => {
  beforeEach(() => vi.setSystemTime(NOW))
  afterEach(() => vi.useRealTimers())

  it('returns null when lastViewed is absent', () => {
    expect(validateLastViewed(5, null)).toBeNull()
    expect(validateLastViewed(5, undefined)).toBeNull()
  })

  it('rejects inconsistency: no 30D views but lastViewed within 30 days', () => {
    const fifteenDaysAgo = NOW - 15 * 86_400_000
    expect(validateLastViewed(0, fifteenDaysAgo)).toBeNull()
  })

  it('rejects inconsistency: views in 30D but lastViewed > 30 days ago', () => {
    const fortyDaysAgo = NOW - 40 * 86_400_000
    expect(validateLastViewed(10, fortyDaysAgo)).toBeNull()
  })

  it('accepts consistent data: no 30D views, lastViewed > 30 days ago', () => {
    const fortyDaysAgo = NOW - 40 * 86_400_000
    expect(validateLastViewed(0, fortyDaysAgo)).toBe(fortyDaysAgo)
  })

  it('accepts consistent data: views in 30D, lastViewed within 30 days', () => {
    const fiveDaysAgo = NOW - 5 * 86_400_000
    expect(validateLastViewed(20, fiveDaysAgo)).toBe(fiveDaysAgo)
  })

  it('boundary: exactly 30 days ago is consistent with zero 30D views', () => {
    const thirtyDaysAgo = NOW - 30 * 86_400_000
    expect(validateLastViewed(0, thirtyDaysAgo)).toBe(thirtyDaysAgo)
  })
})
