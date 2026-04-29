import { describe, it, expect } from 'vitest'
import { calcCreditsPerMonth } from '../utils/credits'

describe('calcCreditsPerMonth', () => {
  it('Feature Service: 2.4 credits per 10 MB', () => {
    // 10 MB Feature Service = 2.4 credits
    const result = calcCreditsPerMonth('Feature Service', 10 * 1_048_576)
    expect(result).toBeCloseTo(2.4, 5)
  })

  it('Feature Service: 100 MB = 24 credits', () => {
    const result = calcCreditsPerMonth('Feature Service', 100 * 1_048_576)
    expect(result).toBeCloseTo(24, 4)
  })

  it('Notebook: 1 GB = 12 credits', () => {
    const result = calcCreditsPerMonth('Notebook', 1_073_741_824)
    expect(result).toBeCloseTo(12, 5)
  })

  it('Image Service: 1 GB = 1.2 credits (standard rate)', () => {
    const result = calcCreditsPerMonth('Image Service', 1_073_741_824)
    expect(result).toBeCloseTo(1.2, 5)
  })

  it('Vector Tile Service: 1 GB = 1.2 credits (standard rate)', () => {
    const result = calcCreditsPerMonth('Vector Tile Service', 1_073_741_824)
    expect(result).toBeCloseTo(1.2, 5)
  })

  it('Web Map: standard rate (0 bytes = 0 credits)', () => {
    // Web Maps have size = -1 in the API; treat negative sizes as 0
    const result = calcCreditsPerMonth('Web Map', -1)
    expect(result).toBe(0)
  })

  it('Unknown type falls through to standard rate', () => {
    const result = calcCreditsPerMonth('PDF', 1_073_741_824)
    expect(result).toBeCloseTo(1.2, 5)
  })
})
