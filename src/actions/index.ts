import type { ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { asString, isMember, memberIdsOf, stableHash, validateForecastWindow, weatherQuery } from '../lib/trip-utils'

type Trip = {
  title: string
  destination: string
  startDate: string
  endDate: string
  preferences: string
  memberIds: string[]
  inviteCode: string
  searchHash: string
  weatherJson: WeatherPoint[]
  itineraryHash: string
}

type ActivityCard = {
  tripId: string
  memberIds: string[]
  title: string
  sourceUrl: string
  sourceName: string
  snippet: string
  imageUrl: string
}

type Vote = { tripId: string; activityId: string; voterId: string; memberIds: string[] }
type Itinerary = { tripId: string; memberIds: string[]; content: string; sourceActivityIds: string[]; inputHash: string }
type WeatherPoint = { dt: number; temp: number; description: string; humidity?: number; icon?: string }

type ExaResult = { title?: string; url?: string; text?: string; highlights?: string[]; image?: string }
type ExaResponse = { results?: ExaResult[] }
type OpenAiResponse = { choices?: Array<{ message?: { content?: string } }> }

const success = <T>(data: T): ActionResult<T> => ({ success: true, data })
const failure = (error: string, code = 'invalid_request'): ActionResult<never> => ({ success: false, error, code })

function actionParams(params: Record<string, unknown>, names: string[]): Record<string, string> | null {
  const parsed: Record<string, string> = {}
  for (const name of names) {
    const value = asString(params[name])
    if (!value) return null
    parsed[name] = value
  }
  return parsed
}

type TripRecord = { recordId: string; createdBy: string; data: Trip }

async function getTrip(tools: ActionTools, tripId: string): Promise<ActionResult<TripRecord>> {
  const result = await tools.get<Trip>('trips', tripId)
  if (!result.success) return failure('Trip not found.', 'not_found')
  return success(result.data.record)
}

async function requireMember(tools: ActionTools, tripId: string, userId: string): Promise<ActionResult<TripRecord>> {
  const trip = await getTrip(tools, tripId)
  if (!trip.success) return trip
  const memberIds = memberIdsOf(trip.data.data.memberIds)
  if (!isMember(memberIds, userId)) return failure('You do not have access to this trip.', 'forbidden')
  // Keep every downstream record write in the canonical array form that the
  // collaborators-field evaluator expects, even if an older row was read in
  // its serialized JSON representation.
  return success({ ...trip.data, data: { ...trip.data.data, memberIds } })
}

function requireOrganizer(trip: TripRecord, userId: string): ActionResult<TripRecord> {
  return trip.createdBy === userId
    ? success(trip)
    : failure('Only the board organizer can discover ideas or build the itinerary.', 'organizer_only')
}

function inviteCode(): string {
  return crypto.randomUUID().replaceAll('-', '')
}

function safelyParseWeather(value: unknown): WeatherPoint[] {
  return Array.isArray(value)
    ? value.filter(
        (point): point is WeatherPoint =>
          !!point && typeof point === 'object' && typeof (point as WeatherPoint).temp === 'number',
      )
    : []
}

export const actions: Record<string, ActionHandler<Env>> = {
  async createTrip({ params, tools, userId }) {
    const values = actionParams(params, ['title', 'destination', 'startDate', 'endDate', 'preferences'])
    if (!values) return failure('Complete every trip detail before creating the board.')
    const tripInput = {
      title: values.title,
      destination: values.destination,
      startDate: values.startDate,
      endDate: values.endDate,
      preferences: values.preferences,
    }
    const dateError = validateForecastWindow(tripInput)
    if (dateError) return failure(dateError, 'forecast_window')

    const created = await tools.create<Trip>('trips', {
      ...tripInput,
      memberIds: [userId],
      inviteCode: inviteCode(),
      searchHash: '',
      weatherJson: [],
      itineraryHash: '',
    })
    return created.success ? success({ tripId: created.data.recordId }) : created
  },

  async joinTrip({ params, tools, userId }) {
    const code = asString(params.inviteCode, 100)
    if (!code) return failure('That invitation link is incomplete.')
    const found = await tools.query<Trip>('trips', { where: { inviteCode: code }, limit: 1 })
    if (!found.success || found.data.records.length === 0) return failure('This invitation link is invalid or has expired.', 'not_found')

    const trip = found.data.records[0]
    const existingMemberIds = memberIdsOf(trip.data.memberIds)
    const memberIds = Array.from(new Set([...existingMemberIds, userId]))
    const joined = !existingMemberIds.includes(userId)
    if (joined) {
      const updated = await tools.update<Trip>('trips', trip.recordId, { memberIds })
      if (!updated.success) return updated
    }
    // Existing related rows receive the new member roster so the server-side
    // shared permission stays aligned with the trip.
    const related = await Promise.all([
      tools.query<ActivityCard>('activityCards', { where: { tripId: trip.recordId }, limit: 100 }),
      tools.query<Vote>('votes', { where: { tripId: trip.recordId }, limit: 100 }),
      tools.query<Itinerary>('itineraries', { where: { tripId: trip.recordId }, limit: 1 }),
    ])
    const propagation = await Promise.all([
      ...related[0].success
        ? related[0].data.records.map((record) => tools.update<ActivityCard>('activityCards', record.recordId, { memberIds }))
        : [],
      ...related[1].success
        ? related[1].data.records.map((record) => tools.update<Vote>('votes', record.recordId, { memberIds }))
        : [],
      ...related[2].success
        ? related[2].data.records.map((record) => tools.update<Itinerary>('itineraries', record.recordId, { memberIds }))
        : [],
    ])
    const propagationError = propagation.find((result) => !result.success)
    if (propagationError && !propagationError.success) return propagationError
    return success({ tripId: trip.recordId, joined })
  },

  async discoverActivities({ params, tools, userId }) {
    const tripId = asString(params.tripId)
    if (!tripId) return failure('Select a trip first.')
    const trip = await requireMember(tools, tripId, userId)
    if (!trip.success) return trip
    const organizer = requireOrganizer(trip.data, userId)
    if (!organizer.success) return organizer

    const inputHash = stableHash({
      destination: trip.data.data.destination,
      startDate: trip.data.data.startDate,
      endDate: trip.data.data.endDate,
      preferences: trip.data.data.preferences,
    })
    if (trip.data.data.searchHash === inputHash) return success({ cached: true, count: 0 })

    const [search, forecast] = await Promise.all([
      tools.integration<ExaResponse>('exa/search', {
        query: `${trip.data.data.destination} activities ${trip.data.data.preferences}`,
        numResults: 6,
        contents: { highlights: { highlightsPerUrl: 1, maxCharacters: 280 } },
      }),
      tools.integration<WeatherPoint[]>('openweathermap/forecast', {
        q: weatherQuery(trip.data.data.destination),
        units: 'imperial',
      }),
    ])
    if (!search.success) return failure(`Activity search failed: ${search.error}`, search.code ?? 'integration_error')
    if (!forecast.success) return failure(`Weather lookup failed: ${forecast.error}`, forecast.code ?? 'integration_error')

    const cards = (search.data.results ?? [])
      .map((result) => ({
        title: asString(result.title, 160),
        sourceUrl: asString(result.url, 1_000),
        snippet: asString(result.highlights?.[0] ?? result.text, 500),
        imageUrl: asString(result.image, 1_000) ?? '',
      }))
      .filter((result): result is { title: string; sourceUrl: string; snippet: string; imageUrl: string } =>
        Boolean(result.title && result.sourceUrl && result.snippet),
      )
      .slice(0, 6)

    if (cards.length === 0) return failure('No usable activity ideas were found. Try a more specific preference.', 'empty_results')
    await Promise.all([
      tools.deleteWhere('activityCards', { tripId }, 100),
      tools.deleteWhere('votes', { tripId }, 100),
      tools.deleteWhere('itineraries', { tripId }, 10),
    ])
    const memberIds = trip.data.data.memberIds
    const writes = await Promise.all(
      cards.map((card) => {
        const host = new URL(card.sourceUrl).hostname.replace(/^www\./, '')
        return tools.create<ActivityCard>('activityCards', {
          tripId,
          memberIds,
          ...card,
          sourceName: host,
        })
      }),
    )
    const writeError = writes.find((result) => !result.success)
    if (writeError && !writeError.success) return writeError
    const update = await tools.update<Trip>('trips', tripId, {
      searchHash: inputHash,
      weatherJson: safelyParseWeather(forecast.data),
      itineraryHash: '',
    })
    return update.success ? success({ cached: false, count: cards.length }) : update
  },

  async toggleVote({ params, tools, userId }) {
    const activityId = asString(params.activityId)
    if (!activityId) return failure('Choose an activity to vote for.')
    const card = await tools.get<ActivityCard>('activityCards', activityId)
    if (!card.success) return failure('That activity is no longer available.', 'not_found')
    const trip = await requireMember(tools, card.data.record.data.tripId, userId)
    if (!trip.success) return trip

    const itinerary = await tools.query<Itinerary>('itineraries', { where: { tripId: trip.data.recordId }, limit: 1 })
    if (!itinerary.success) return itinerary
    if (itinerary.data.records[0]) return failure('Voting is closed because the organizer has already built the itinerary.', 'voting_closed')

    const existing = await tools.query<Vote>('votes', { where: { activityId, voterId: userId }, limit: 1 })
    if (!existing.success) return existing
    if (existing.data.records[0]) {
      const removed = await tools.remove('votes', existing.data.records[0].recordId)
      return removed.success ? success({ voted: false }) : removed
    }
    const created = await tools.create<Vote>('votes', {
      tripId: trip.data.recordId,
      activityId,
      voterId: userId,
      memberIds: trip.data.data.memberIds,
    })
    return created.success ? success({ voted: true }) : created
  },

  async generateItinerary({ params, tools, userId }) {
    const tripId = asString(params.tripId)
    if (!tripId) return failure('Select a trip first.')
    const trip = await requireMember(tools, tripId, userId)
    if (!trip.success) return trip
    const organizer = requireOrganizer(trip.data, userId)
    if (!organizer.success) return organizer
    const [cardsResult, votesResult, itineraryResult] = await Promise.all([
      tools.query<ActivityCard>('activityCards', { where: { tripId }, limit: 20 }),
      tools.query<Vote>('votes', { where: { tripId }, limit: 100 }),
      tools.query<Itinerary>('itineraries', { where: { tripId }, limit: 1 }),
    ])
    if (!cardsResult.success) return cardsResult
    if (!votesResult.success) return votesResult
    const voteCounts = new Map<string, number>()
    for (const vote of votesResult.data.records) {
      voteCounts.set(vote.data.activityId, (voteCounts.get(vote.data.activityId) ?? 0) + 1)
    }
    const selected = cardsResult.data.records
      .filter((card) => (voteCounts.get(card.recordId) ?? 0) > 0)
      .map((card) => ({ id: card.recordId, ...card.data, votes: voteCounts.get(card.recordId) ?? 0 }))
    if (selected.length === 0) return failure('Vote for at least one activity before making the itinerary.', 'no_votes')

    const inputHash = stableHash({ searchHash: trip.data.data.searchHash, selected: selected.map(({ id, votes }) => ({ id, votes })) })
    const existing = itineraryResult.success ? itineraryResult.data.records[0] : undefined
    if (existing) return failure('An itinerary has already been built for this board.', 'itinerary_exists')

    const weather = safelyParseWeather(trip.data.data.weatherJson)
      .slice(0, 12)
      .map((point) => `${new Date(point.dt * 1000).toISOString()}: ${Math.round(point.temp)}°F, ${point.description}`)
      .join('\n')
    const choices = selected
      .map((card, index) => `${index + 1}. ${card.title} (${card.votes} votes)\n${card.snippet}\nSource: ${card.sourceUrl}`)
      .join('\n\n')
    const generated = await tools.integration<OpenAiResponse>('openai/chat-completion', {
      model: 'gpt-4.1-mini',
      max_tokens: 700,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            'You are a careful local itinerary editor. Use only supplied activities and weather. Never claim a booking, price, opening hour, or availability. Write concise Markdown with a short weather note, a sensible day flow, and a Sources list that preserves every selected URL.',
        },
        {
          role: 'user',
          content: `Plan: ${trip.data.data.title} in ${trip.data.data.destination}, ${trip.data.data.startDate} to ${trip.data.data.endDate}. Preferences: ${trip.data.data.preferences}.\n\nForecast:\n${weather}\n\nGroup-selected activities:\n${choices}`,
        },
      ],
    })
    if (!generated.success) return failure(`Itinerary generation failed: ${generated.error}`, generated.code ?? 'integration_error')
    const content = asString(generated.data.choices?.[0]?.message?.content, 12_000)
    if (!content) return failure('The itinerary service returned an empty response.', 'empty_response')
    const data: Itinerary = {
      tripId,
      memberIds: trip.data.data.memberIds,
      content,
      sourceActivityIds: selected.map((card) => card.id),
      inputHash,
    }
    const saved = await tools.create<Itinerary>('itineraries', data)
    if (!saved.success) return saved
    await tools.update<Trip>('trips', tripId, { itineraryHash: inputHash })
    return success({ cached: false, content })
  },
}
