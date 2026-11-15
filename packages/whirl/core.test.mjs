// Run: node --test packages/whirl/core.test.mjs   (Node 22.6+ strips the TypeScript types itself)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_WHIRL_SETTINGS,
  WHIRL_MINI_BELOW,
  WHIRL_TIMING,
  artKindForSize,
  assertDurations,
  barSweep,
  createDelayedVisibility,
  createFrequencyBudget,
  createMemoryStorage,
  decideMoment,
  markSeen,
  motionAllowed,
  parseWhirlSettings,
  resetWhirlSessionForTests,
  shouldCelebrate,
  shouldShowOnce,
  spinnerAngle,
} from './core.ts'
import { WHIRL_ART, WHIRL_POSES } from './art.generated.ts'

// ----- frequency budget -----
test('budget: only one non-loading moment per screen', () => {
  const b = createFrequencyBudget(1)
  assert.equal(b.claim('home', 'greeting'), true)
  assert.equal(b.claim('home', 'tip'), false)
  assert.equal(b.claim('rewards', 'empty'), true, 'another screen has its own slot')
  assert.equal(b.count('home'), 1)
})
test('budget: the same moment re-rendering keeps its slot; releasing frees it', () => {
  const b = createFrequencyBudget(1)
  assert.equal(b.claim('home', 'greeting'), true)
  assert.equal(b.claim('home', 'greeting'), true)
  b.release('home', 'greeting')
  assert.equal(b.claim('home', 'tip'), true)
  b.release('home')
  assert.equal(b.count('home'), 0)
})

// ----- once-only memory -----
test('once: a first-time tip shows once, then never again (even in a new session)', async () => {
  const store = createMemoryStorage()
  assert.equal(await shouldShowOnce(store, 'tip-scan'), true)
  await markSeen(store, 'tip-scan')
  assert.equal(await shouldShowOnce(store, 'tip-scan'), false)
  assert.equal(await shouldShowOnce(store, 'tip-other'), true, 'other tips are independent')
})
test('once: unreadable storage fails closed (does not nag)', async () => {
  const broken = { getItem: () => { throw new Error('locked') }, setItem: () => { throw new Error('locked') } }
  assert.equal(await shouldShowOnce(broken, 'x'), false)
  await assert.doesNotReject(markSeen(broken, 'x'))
})
test('celebrations fire once per event', () => {
  resetWhirlSessionForTests()
  assert.equal(shouldCelebrate('reward-1'), true)
  assert.equal(shouldCelebrate('reward-1'), false)
  assert.equal(shouldCelebrate('reward-2'), true)
})

// ----- settings switch -----
test('settings: default on, parses stored value, survives garbage', () => {
  assert.deepEqual(parseWhirlSettings(null), DEFAULT_WHIRL_SETTINGS)
  assert.equal(parseWhirlSettings('{"showWhirl":false}').showWhirl, false)
  assert.equal(parseWhirlSettings('not json').showWhirl, true)
  assert.equal(parseWhirlSettings('{"showWhirl":"no"}').showWhirl, true)
})
test('decideMoment: switch off blocks decoration; once and budget both apply', () => {
  const b = createFrequencyBudget(1)
  const on = { showWhirl: true }
  assert.equal(decideMoment({ settings: { showWhirl: false }, budget: b, screenId: 's', momentId: 'm' }), false)
  assert.equal(b.count('s'), 0, 'a refused moment must not use up the slot')
  assert.equal(decideMoment({ settings: on, budget: b, screenId: 's', momentId: 'm', onceOk: false }), false)
  assert.equal(decideMoment({ settings: on, budget: b, screenId: 's', momentId: 'm' }), true)
  assert.equal(decideMoment({ settings: on, budget: b, screenId: 's', momentId: 'n' }), false)
})

// ----- reduced motion + durations -----
test('reduced motion turns motion off', () => {
  assert.equal(motionAllowed({ reduceMotion: true }), false)
  assert.equal(motionAllowed({ reduceMotion: false }), true)
})
test('durations: loops under 1.2 s, one-shots under 1.5 s', () => {
  assert.ok(WHIRL_TIMING.SPIN_TURN_MS < WHIRL_TIMING.LOOP_MAX_MS)
  assert.doesNotThrow(() => assertDurations(1100, 1300))
  assert.throws(() => assertDurations(1200, null))
  assert.throws(() => assertDurations(null, 1500))
})
test('spinner turns in four eased quarter turns that land on 90 degree steps', () => {
  assert.equal(spinnerAngle(0), 0)
  assert.equal(spinnerAngle(0.25), 90)
  assert.equal(spinnerAngle(0.5), 180)
  assert.equal(spinnerAngle(0.75), 270)
  const mid = spinnerAngle(0.125)
  assert.ok(Math.abs(mid - 45) < 1e-9, 'eased quarter is symmetric')
  assert.ok(spinnerAngle(0.03) < 0.03 * 360, 'slow start (eased)')
  let prev = -1
  for (let p = 0; p < 1; p += 0.01) { const a = spinnerAngle(p); assert.ok(a >= prev); prev = a }
})
test('bar sweep enters from the left and leaves on the right', () => {
  assert.ok(barSweep(0) < 0)
  assert.ok(barSweep(0.999) > 0.9)
})
test('mini face is used below 48 px', () => {
  assert.equal(artKindForSize(WHIRL_MINI_BELOW - 1), 'mini')
  assert.equal(artKindForSize(WHIRL_MINI_BELOW), 'full')
})

// ----- the 300 ms rule -----
function fakeTimers() {
  let now = 0
  let id = 0
  const pending = new Map()
  return {
    now: () => now,
    set(fn, ms) { const h = ++id; pending.set(h, { at: now + ms, fn }); return h },
    clear(h) { pending.delete(h) },
    advance(ms) {
      const end = now + ms
      for (;;) {
        const next = [...pending.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
        if (!next) break
        pending.delete(next[0]); now = next[1].at; next[1].fn()
      }
      now = end
    },
  }
}
test('spinner never appears for a wait under 300 ms (no flicker)', () => {
  const t = fakeTimers(); const seen = []
  const g = createDelayedVisibility((v) => seen.push(v), { timers: t })
  g.update(true); t.advance(250); g.update(false); t.advance(1000)
  assert.deepEqual(seen, [])
})
test('spinner appears after 300 ms and stays at least 400 ms', () => {
  const t = fakeTimers(); const seen = []
  const g = createDelayedVisibility((v) => seen.push(v), { timers: t })
  g.update(true); t.advance(299); assert.deepEqual(seen, [])
  t.advance(1); assert.deepEqual(seen, [true])
  t.advance(100); g.update(false)           // load finished 100 ms after it appeared
  t.advance(299); assert.deepEqual(seen, [true], 'still visible, minimum not reached')
  t.advance(1); assert.deepEqual(seen, [true, false])
})
test('spinner: loading again before the minimum cancels the hide; dispose clears timers', () => {
  const t = fakeTimers(); const seen = []
  const g = createDelayedVisibility((v) => seen.push(v), { timers: t })
  g.update(true); t.advance(300); g.update(false); t.advance(100); g.update(true); t.advance(2000)
  assert.deepEqual(seen, [true])
  g.update(false)                            // long past the minimum: hides at once
  assert.deepEqual(seen, [true, false])
  g.update(true); t.advance(300); g.update(false); g.dispose(); t.advance(5000)
  assert.deepEqual(seen, [true, false, true], 'dispose cancels the pending hide')
})

// ----- art sanity -----
test('art: every pose exists in light and dark, full and mini, with a body layer; the wave arm has a pivot', () => {
  assert.deepEqual(WHIRL_POSES.slice(6), ['oops', 'point', 'peek'])
  for (const v of ['light', 'dark']) {
    assert.equal(WHIRL_ART[v].blades.length, 4)
    for (const kind of ['full', 'mini']) for (const p of WHIRL_POSES) {
      const a = WHIRL_ART[v][kind][p]
      assert.ok(a.layers.some((l) => l.id === 'body'), `${v} ${kind} ${p} has a body`)
      assert.equal(a.vb.length, 4)
    }
    assert.ok(WHIRL_ART[v].full.wave.layers.find((l) => l.id === 'armR').pivot)
  }
})
