import { getAuthToken } from 'deepspace'

export type ActionResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }

export async function callAction<T>(name: string, params: Record<string, unknown>): Promise<ActionResponse<T>> {
  const token = await getAuthToken()
  if (!token) return { success: false, error: 'Please sign in again to continue.', code: 'unauthorized' }
  const response = await fetch(`/api/actions/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  })
  const payload = (await response.json().catch(() => null)) as ActionResponse<T> | null
  return payload ?? { success: false, error: 'The planner returned an unreadable response.', code: 'bad_response' }
}

export function localIsoDate(offset = 0): string {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}
