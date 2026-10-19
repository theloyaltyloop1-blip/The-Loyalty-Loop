import assert from 'node:assert/strict'
import test from 'node:test'
import { TOUR_STOPS, nextStop, remainingOnRoute, tourSeenKey } from './tour-script.ts'

const all = new Set(TOUR_STOPS.map((s) => s.id))

test('seen keys are per shop and per stop', () => {
  assert.equal(tourSeenKey('abc', 'scan-input'), 'tour_seen_abc_scan-input')
  assert.notEqual(tourSeenKey('abc', 'scan-input'), tourSeenKey('def', 'scan-input'))
})

test('each route shows its own first unseen stop', () => {
  assert.equal(nextStop({ pathname: '/owner', seen: new Set(), found: all })?.id, 'home-scan-tab')
  assert.equal(nextStop({ pathname: '/owner/scan', seen: new Set(), found: all })?.id, 'scan-input')
  assert.equal(nextStop({ pathname: '/owner/tools', seen: new Set(), found: all })?.id, 'shop-poster')
  assert.equal(nextStop({ pathname: '/owner/reviews', seen: new Set(), found: all }), null)
})

test('seen stops and stops without an element are skipped', () => {
  assert.equal(nextStop({ pathname: '/owner', seen: new Set(['home-scan-tab']), found: all }), null)
  assert.equal(nextStop({ pathname: '/owner/scan', seen: new Set(), found: new Set() }), null)
  assert.equal(remainingOnRoute('/owner/scan', new Set(), all), 1)
})
