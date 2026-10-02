# Roam Consensus

A focused, private group planner for a short-notice getaway. Create a board,
share a signed-in invitation link, curate a small set of sourced activities,
collect live votes, and turn the group’s choices into one weather-aware itinerary.

## Why this scope

This deliberately plans **activities only**. It does not claim booking
availability, prices, restaurant reservations, transportation, or lodging.
The trip must fall within the next five days because the weather integration
only provides a reliable rolling five-day forecast.

## DeepSpace usage

- **Auth + shared realtime records:** every board and its related activity,
  vote, and itinerary rows use a `memberIds` collaborator field. The Durable
  Object enforces shared reads server-side; writes flow through checked actions.
- **Clear decision ownership:** the board creator alone can discover ideas,
  build a draft, publish the final itinerary, or unlock planning. Members vote
  on the shared options and see the resulting draft or final plan in real time.
- **Exa search:** finds up to six candidate activity sources for the destination
  and stated preferences.
- **OpenWeather forecast:** supplies the weather signal used by the plan.
- **OpenAI chat completion:** produces one concise Markdown itinerary from only
  the selected cards and forecast. It is instructed never to invent pricing,
  availability, or bookings.

The three external integrations are developer-billed but guarded by sign-in,
trip membership, disabled in-flight controls, and stable input hashes. An
unchanged discovery or itinerary request reuses saved output rather than
spending again.

## Run and verify

```bash
pnpm dev
pnpm validate
pnpm test
pnpm deploy
```

For the full multi-user test, create two local DeepSpace test accounts and run
`npx deepspace test run all`. The important manual flow is: creator makes a
board → copies the invite → a second account joins → creator discovers → both
accounts vote → creator builds and publishes the itinerary.

## Submission note

**Built:** Roam Consensus, a collaborative short-notice getaway planner.

**Main tradeoff:** I kept the product to activity selection and did not add
booking or pricing flows. That makes the promise verifiable and leaves time to
make the private sharing, live voting, and integration path reliable.

**Agent contribution:** Codex scaffolded the DeepSpace app, designed the record
schemas/actions, implemented the React UI and integration orchestration, and
added validation/tests.

**What I verified:** TypeScript, unit tests, production build, static landing
behavior, auth-protected planner routes, and the deployed happy path should be
checked with two signed-in test accounts before submission. No secrets are
committed; DeepSpace owns the app credentials and integration proxy.
