# Roam Consensus

Roam Consensus is a private planner for a short-notice getaway. An organizer
curates a small, sourced set of activities, invited members vote in real time,
and the organizer builds one weather-aware itinerary from the group’s choices.

Live app: https://roam-consensus-2026.app.space

## Core flow

1. The organizer creates a board with a destination, dates, and preferences.
2. They share a signed-in invitation link with the group.
3. The organizer discovers up to six sourced activity options.
4. Members review the same options and cast one vote per activity.
5. The organizer builds one shared itinerary from the voted options and the
   five-day forecast.
6. Voting and itinerary generation close once that itinerary is created, so the
   group has a clear result.

Boards are labeled as either "Owned by you" or "Shared with you." Each board
shows the organizer and a private roster of joined member names.

## Why this scope

This app plans activities only. It does not claim booking availability, prices,
restaurant reservations, transportation, or lodging. The trip must be within
the next five days because the forecast provider supplies a reliable rolling
five-day window.

The main product decision is intentionally asymmetric: the organizer owns the
curation and synthesis steps, while members supply the group signal through
votes. That avoids competing itineraries and limits paid integration calls.

## DeepSpace integrations

- **Auth and real-time records:** every trip, activity card, vote, and itinerary
  uses a `memberIds` collaborator field. Shared reads are enforced by the
  Durable Object. Server actions separately verify membership and organizer
  ownership before any protected operation.
- **Exa search:** finds up to six destination-specific activity candidates with
  source URLs and snippets.
- **OpenWeather forecast:** adds a weather signal to the itinerary and restricts
  dates to the next five days.
- **OpenAI chat completion:** writes concise Markdown from only the voted cards
  and forecast. Its instructions prohibit invented prices, availability, or
  reservations.

External calls run only on the server. They are developer-billed, never expose
provider credentials, and are limited by sign-in, membership checks, owner-only
controls, disabled in-flight buttons, and stable discovery hashes.

## Run and verify

```bash
pnpm dev
pnpm validate
npx deepspace test run
pnpm deploy
```

The intended manual check is: organizer creates a board, copies the invite,
another signed-in account joins, organizer discovers ideas, both accounts vote,
and organizer builds the itinerary. Then verify that vote and build controls
are disabled for the completed board.

## Submission note

**Built:** Roam Consensus, a collaborative short-notice getaway planner with a
clear organizer-led decision flow.

**DeepSpace integrations used:** DeepSpace auth and real-time shared records,
Exa search, OpenWeather forecast, and OpenAI chat completion.

**Main tradeoff:** I kept the product to activity selection and left out booking,
prices, restaurants, transport, and accommodation. I also made discovery and
itinerary generation organizer-only. This makes the important path complete,
keeps paid calls bounded, and gives the group one unambiguous result.

**Agent contribution:** Codex scaffolded the app, designed the schemas and
server actions, implemented the React interface and integration orchestration,
and added validation coverage. I directed the product decisions, tested the
owner and member workflow with separate accounts, and iterated on permissions,
the roster, weather handling, and the final locked decision flow.

**What I verified:** I created boards, shared an invite, joined with a separate
account, checked the live roster and role-specific controls, cast votes, built
an itinerary, and confirmed that voting and itinerary generation close after
completion. I also ran TypeScript, unit, lint, and platform smoke checks. No
provider credentials or secrets are committed; DeepSpace holds the integration
credentials and proxy.
