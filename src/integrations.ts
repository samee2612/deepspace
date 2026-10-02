/**
 * Integration Billing Config
 *
 * Configure who pays for each integration's API calls.
 *
 * - 'developer': The app owner pays (default). Works for anonymous users.
 * - 'user': The calling user pays. Requires sign-in.
 *
 * Integrations not listed here default to 'developer'.
 *
 * IMPORTANT: any integration backed by per-user OAuth tokens (Google,
 * etc.) must be 'user' — the api-worker looks up the row keyed by the
 * JWT subject. With 'developer' the app owner's JWT is forwarded and
 * the handler operates on the app owner's connected account regardless
 * of who's signed in client-side.
 */

export const integrations: Record<string, { billing: 'developer' | 'user' }> = {
  google: { billing: 'user' },
  // Discovery and the one deliberate itinerary synthesis are owner-funded.
  // The action layer requires sign-in, membership, and input hashes before it
  // reaches these providers, so a public page cannot spend the app's credits.
  exa: { billing: 'developer' },
  openweathermap: { billing: 'developer' },
  openai: { billing: 'developer' },
}
