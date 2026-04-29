import { describe, it, expect } from 'vitest'
import { formatStaleness } from '../utils/format'

describe('formatStaleness', () => {
  const DAY = 86_400_000

  it('returns "Modified today" for recent timestamps', () => {
    expect(formatStaleness(Date.now() - 3_600_000)).toBe('Modified today')
  })

  it('returns "Modified yesterday" for ~1 day ago', () => {
    expect(formatStaleness(Date.now() - DAY)).toBe('Modified yesterday')
  })

  it('returns days for < 90 days', () => {
    expect(formatStaleness(Date.now() - 30 * DAY)).toBe('Modified 30 days ago')
  })

  it('returns months for 90 days–2 years', () => {
    expect(formatStaleness(Date.now() - 180 * DAY)).toBe('Modified 6 months ago')
    expect(formatStaleness(Date.now() - 30 * DAY * 13)).toBe('Modified 13 months ago')
  })

  it('returns years for 2+ years', () => {
    expect(formatStaleness(Date.now() - 365 * DAY * 2)).toBe('Modified 2 years ago')
    expect(formatStaleness(Date.now() - 365 * DAY * 3)).toBe('Modified 3 years ago')
  })

  it('uses singular for 1 year', () => {
    expect(formatStaleness(Date.now() - 365 * DAY)).toBe('Modified 12 months ago')
  })
})
