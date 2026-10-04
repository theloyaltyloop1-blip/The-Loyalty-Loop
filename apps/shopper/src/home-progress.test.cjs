const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const code = ts.transpileModule(fs.readFileSync(`${__dirname}/home-progress.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const helper = { exports: {} }
new Function('module', 'exports', code)(helper, helper.exports)
const { homeProgress } = helper.exports
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
