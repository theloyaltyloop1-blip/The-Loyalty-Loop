const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const code = ts.transpileModule(fs.readFileSync(`${__dirname}/home-rails.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const helper = { exports: {} }
new Function('module', 'exports', code)(helper, helper.exports)
const { categoryRails, newestShops, categoryCounts, heroSlides } = helper.exports
const shop = (id, category, created_at, cover_url) => ({ id, category, created_at, cover_url })

test('category rails need two shops, skip Other, biggest first, capped', () => {
  const shops = [shop('a', 'Cafe'), shop('b', 'Cafe'), shop('c', 'Cafe'), shop('d', 'Barber'), shop('e', 'Barber'), shop('f', 'Florist'), shop('g', null), shop('h', '')]
  const rails = categoryRails(shops, { max: 4 })
  assert.deepEqual(rails.map(r => r.category), ['Cafe', 'Barber'])
  assert.equal(categoryRails(shops, { max: 1 }).length, 1)
  assert.equal(categoryRails(shops, { per: 2 })[0].shops.length, 2)
})

test('newest shops: newest first, undated left out, hidden when few shops', () => {
  const shops = [shop('a', 'x', '2026-01-01'), shop('b', 'x', '2026-03-01'), shop('c', 'x', null), shop('d', 'x', '2026-02-01'), shop('e', 'x', '2025-01-01'), shop('f', 'x', '2025-06-01')]
  assert.deepEqual(newestShops(shops, { limit: 3 }).map(s => s.id), ['b', 'd', 'a'])
  assert.deepEqual(newestShops(shops.slice(0, 5)), [])
})

test('category counts include Other and sort by size', () => {
  assert.deepEqual(categoryCounts([shop('a', 'Cafe'), shop('b', null), shop('c', 'Cafe')]), [['Cafe', 2], ['Other', 1]])
})

test('hero slides: personal first, photos preferred, no repeats, fallback', () => {
  const p = shop('p'), t1 = shop('t1', null, null, 'x.jpg'), t2 = shop('t2')
  assert.deepEqual(heroSlides(p, [t2, t1, p], []).map(s => s.id), ['p', 't1', 't2'])
  assert.deepEqual(heroSlides(undefined, [], [t2]).map(s => s.id), ['t2'])
  assert.equal(heroSlides(undefined, [t1, t2, p], [], 2).length, 2)
})
