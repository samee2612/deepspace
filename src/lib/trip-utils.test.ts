import { describe, expect, it } from 'vitest'
import { stableHash, validateForecastWindow } from './trip-utils'

describe('forecast-window validation', () => {
  const now = new Date('2026-10-01T15:00:00Z')

  it('accepts a trip fully inside the provider forecast horizon', () => {
    expect(validateForecastWindow({ startDate: '2026-10-02', endDate: '2026-10-05' }, now)).toBeNull()
  })

  it('rejects reversed, past, and out-of-window trips', () => {
    expect(validateForecastWindow({ startDate: '2026-10-03', endDate: '2026-10-02' }, now)).toMatch(/end date/i)
    expect(validateForecastWindow({ startDate: '2026-09-30', endDate: '2026-10-01' }, now)).toMatch(/today/i)
    expect(validateForecastWindow({ startDate: '2026-10-04', endDate: '2026-10-06' }, now)).toMatch(/today/i)
  })
})

describe('request cache keys', () => {
  it('is stable for the same brief and changes when selected input changes', () => {
    const brief = { destination: 'Santa Cruz', preferences: 'walkable', cards: ['a', 'b'] }
    expect(stableHash(brief)).toBe(stableHash(brief))
    expect(stableHash({ ...brief, cards: ['a', 'c'] })).not.toBe(stableHash(brief))
  })
})
