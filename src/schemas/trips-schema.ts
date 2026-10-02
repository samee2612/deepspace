import type { CollectionSchema } from 'deepspace/schema'

const sharedPermissions = {
  viewer: { read: false, create: false, update: false, delete: false },
  member: { read: 'shared' as const, create: false, update: false, delete: false },
  admin: { read: true, create: true, update: true, delete: true },
}

export const tripsSchema: CollectionSchema = {
  name: 'trips',
  collaboratorsField: 'memberIds',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'destination', storage: 'text', interpretation: 'plain', required: true },
    { name: 'startDate', storage: 'text', interpretation: { kind: 'date' }, required: true },
    { name: 'endDate', storage: 'text', interpretation: { kind: 'date' }, required: true },
    { name: 'preferences', storage: 'text', interpretation: 'plain', required: true },
    { name: 'memberIds', storage: 'text', interpretation: { kind: 'json' }, required: true },
    { name: 'inviteCode', storage: 'text', interpretation: 'plain', required: true },
    { name: 'searchHash', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'weatherJson', storage: 'text', interpretation: { kind: 'json' }, default: [] },
    { name: 'itineraryHash', storage: 'text', interpretation: 'plain', default: '' },
  ],
  permissions: sharedPermissions,
}

export const activityCardsSchema: CollectionSchema = {
  name: 'activityCards',
  collaboratorsField: 'memberIds',
  columns: [
    { name: 'tripId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'memberIds', storage: 'text', interpretation: { kind: 'json' }, required: true },
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'sourceUrl', storage: 'text', interpretation: { kind: 'url' }, required: true },
    { name: 'sourceName', storage: 'text', interpretation: 'plain', required: true },
    { name: 'snippet', storage: 'text', interpretation: 'plain', required: true },
    { name: 'imageUrl', storage: 'text', interpretation: { kind: 'url' }, default: '' },
  ],
  permissions: sharedPermissions,
}

export const votesSchema: CollectionSchema = {
  name: 'votes',
  collaboratorsField: 'memberIds',
  uniqueOn: ['activityId', 'voterId'],
  columns: [
    { name: 'tripId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'activityId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'voterId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'memberIds', storage: 'text', interpretation: { kind: 'json' }, required: true },
  ],
  permissions: sharedPermissions,
}

export const itinerariesSchema: CollectionSchema = {
  name: 'itineraries',
  collaboratorsField: 'memberIds',
  uniqueOn: ['tripId'],
  columns: [
    { name: 'tripId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'memberIds', storage: 'text', interpretation: { kind: 'json' }, required: true },
    { name: 'content', storage: 'text', interpretation: 'plain', required: true },
    { name: 'sourceActivityIds', storage: 'text', interpretation: { kind: 'json' }, required: true },
    { name: 'inputHash', storage: 'text', interpretation: 'plain', required: true },
  ],
  permissions: sharedPermissions,
}
