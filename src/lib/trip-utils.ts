export type TripDates = { startDate: string; endDate: string }

const datePattern = /^\d{4}-\d{2}-\d{2}$/

function dayNumber(value: string): number | null {
  if (!datePattern.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? Math.floor(date.getTime() / 86_400_000)
    : null
}

/** OpenWeather's endpoint only supplies a rolling five-day forecast. */
export function validateForecastWindow({ startDate, endDate }: TripDates, now = new Date()): string | null {
  const start = dayNumber(startDate)
  const end = dayNumber(endDate)
  const today = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000)

  if (start === null || end === null) return 'Choose valid start and end dates.'
  if (end < start) return 'The end date must be on or after the start date.'
  if (start < today || end > today + 4) return 'Choose dates from today through the next four days so the forecast is reliable.'
  return null
}

/** Stable, non-security hash for cache keys; never use this for authorization. */
export function stableHash(value: unknown): string {
  const input = JSON.stringify(value)
  let hash = 2_166_136_261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return `rc-${(hash >>> 0).toString(36)}`
}

export function asString(value: unknown, max = 500): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, max) : null
}

/**
 * JSON fields arrive as arrays in normal SDK reads.  Actions can also receive
 * their serialized form, so normalize both representations before using a
 * roster for authorization or permission propagation.
 */
export function memberIdsOf(value: unknown): string[] {
  const candidate = typeof value === 'string' ? safelyParseJsonArray(value) : value
  if (!Array.isArray(candidate)) return []
  return Array.from(new Set(candidate.filter((id): id is string => typeof id === 'string' && id.length > 0)))
}

function safelyParseJsonArray(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return []
  }
}

export function isMember(memberIds: unknown, userId: string): boolean {
  return memberIdsOf(memberIds).includes(userId)
}

const usRegionCodes = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA',
  'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR',
])

/** OpenWeather requires `city,state,country` rather than the familiar US `city, state` label. */
export function weatherQuery(destination: string): string {
  const parts = destination.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length === 2 && usRegionCodes.has(parts[1].toUpperCase())) {
    return `${parts[0]},${parts[1].toUpperCase()},US`
  }
  return destination.trim()
}
