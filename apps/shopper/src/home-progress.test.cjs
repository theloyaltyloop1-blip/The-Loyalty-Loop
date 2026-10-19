const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
// Loads a TypeScript file on its own. `requireFn` stands in for require(), so the
// shared loyalty package can be supplied without a bundler.
const load = (file, requireFn) => {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', code)(mod, mod.exports, requireFn)
  return mod.exports
}
const loyalty = load(`${__dirname}/../../../packages/loyalty/src/index.ts`, (name) => { throw new Error(`unexpected import ${name}`) })
const { homeProgress } = load(`${__dirname}/home-progress.ts`, (name) => {
  if (name === '@loyalty-loop/loyalty') return loyalty
  throw new Error(`unexpected import ${name}`)
})
const shop = { id: 'coffee', name: 'Coffee', reward_model: 'stamp_legacy' }
const member = { business_id: 'coffee', stamp_count: 6, points_balance: 0 }
const tier = (threshold, title = 'Coffee reward') => ({ business_id: 'coffee', title, stamp_threshold: threshold })

test('stamp cards select next real tier regardless of catalogue order', () => {
  const result = homeProgress(shop, member, [tier(10), tier(4), tier(8, 'Free coffee')])
  assert.equal(result.threshold, 8)
  assert.equal(result.label, '6 of 8 stamps')
  assert.equal(result.offer, '8 stamps · Free coffee')
  assert.equal(result.fraction, 0.75)
})
test('shop filtering keeps another business reward out of the card', () => {
  assert.equal(homeProgress(shop, member, [{ ...tier(2), business_id: 'other' }]).threshold, null)
})
test('empty catalogue never invents a reward or target', () => {
  const result = homeProgress(shop, member, [])
  assert.equal(result.threshold, null)
  assert.equal(result.title, null)
  assert.equal(result.label, '6 stamps collected')
})
test('missing catalogue may use an explicitly configured target', () => {
  assert.equal(homeProgress({ ...shop, loyalty_config: { stamps_required: 10 } }, member, []).label, '6 of 10 stamps')
})
test('spend card uses pence tiers and clamps refunded progress to zero', () => {
  const result = homeProgress({ ...shop, reward_model: 'spend_threshold' }, { ...member, reward_progress_pence: -500 }, [{ ...tier(8), spend_threshold_pence: 2000 }])
  assert.equal(result.label, '£0.00 of £20.00')
  assert.equal(result.fraction, 0)
  assert.equal(result.spend, true)
})
test('points and visit cards keep their actual units', () => {
  assert.equal(homeProgress({ ...shop, loyalty_type: 'points' }, { ...member, points_balance: 45 }, [tier(100)]).label, '45 of 100 points')
  assert.equal(homeProgress({ ...shop, loyalty_type: 'tiered' }, member, [tier(8)]).label, '6 of 8 visits')
})
test('completed top tier clamps the bar without claiming a redeemable reward', () => {
  const result = homeProgress(shop, { ...member, stamp_count: 12 }, [tier(10)])
  assert.equal(result.fraction, 1)
  assert.equal(result.label, '12 stamps collected')
  assert.equal(result.title, 'Coffee reward')
})
test('discovery starts at zero and ignores invalid thresholds', () => {
  const result = homeProgress(shop, undefined, [tier(0), tier(-1), tier(8)])
  assert.equal(result.label, '0 of 8 stamps')
  assert.equal(result.threshold, 8)
})

const tierShop = { id: 'coffee', name: 'Coffee', reward_model: 'tiers' }
const levels = [
  { kind: 'tier', business_id: 'coffee', title: 'Silver', stamp_threshold: 0, spend_threshold_pence: 25000 },
  { kind: 'tier', business_id: 'coffee', title: 'Gold', stamp_threshold: 0, spend_threshold_pence: 50000 },
]
test('tiers card shows the level, distance to the next level and the bar', () => {
  const result = homeProgress(tierShop, { business_id: 'coffee', current_tier: 'Silver', rolling_spend_pence: 30000, stamp_count: 0, points_balance: 0 }, levels)
  assert.equal(result.label, 'Silver · £200.00 to Gold')
  assert.equal(result.title, 'Gold')
  assert.equal(result.threshold, 50000)
  assert.equal(result.offer, 'Spend £500.00 a year · Gold')
  assert.equal(result.fraction, 0.2)
})
test('tiers card never guesses a distance when spend is not loaded', () => {
  const result = homeProgress(tierShop, { business_id: 'coffee', current_tier: 'Silver', stamp_count: 0, points_balance: 0 }, levels)
  assert.equal(result.label, 'Silver level')
  assert.equal(result.threshold, null)
  assert.equal(result.fraction, 0)
})
test('tiers card at the top level has no next target', () => {
  const result = homeProgress(tierShop, { business_id: 'coffee', current_tier: 'Gold', rolling_spend_pence: 90000, stamp_count: 0, points_balance: 0 }, levels)
  assert.equal(result.threshold, null)
  assert.equal(result.offer, 'Top level')
  assert.equal(result.fraction, 1)
})
test('tier rows never leak into a stamp card', () => {
  const result = homeProgress(shop, member, [...levels.map((row) => ({ ...row, business_id: 'coffee' })), tier(8, 'Free coffee')])
  assert.equal(result.threshold, 8)
  assert.equal(result.title, 'Free coffee')
})
const pointsShop = { id: 'coffee', name: 'Coffee', reward_model: 'points', loyalty_config: { points_per_pound: 1 } }
const pointRewards = [
  { business_id: 'coffee', title: 'Free coffee', stamp_threshold: 0, points_cost: 100 },
  { business_id: 'coffee', title: 'Free cake', stamp_threshold: 0, points_cost: 300 },
]
test('points card shows the balance and the next reward to save for', () => {
  const result = homeProgress(pointsShop, { business_id: 'coffee', points_balance: 240, stamp_count: 0 }, pointRewards)
  assert.equal(result.value, 240)
  assert.equal(result.threshold, 300)
  assert.equal(result.title, 'Free cake')
  assert.equal(result.label, '240 points · 60 to Free cake')
  assert.equal(result.offer, '300 points · Free cake')
  assert.equal(result.fraction, 0.8)
})
test('points card with every reward affordable says so', () => {
  const result = homeProgress(pointsShop, { business_id: 'coffee', points_balance: 500, stamp_count: 0 }, pointRewards)
  assert.equal(result.threshold, null)
  assert.equal(result.offer, 'Rewards ready to swap')
  assert.equal(result.title, 'Free coffee')
})
