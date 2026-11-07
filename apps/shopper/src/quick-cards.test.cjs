const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

const code = ts.transpileModule(fs.readFileSync(`${__dirname}/quick-cards.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const mod = { exports: {} }
new Function('module', 'exports', 'require', code)(mod, mod.exports, (name) => {
  if (name === 'react') return { useState: () => [], useEffect: () => {}, useCallback: (fn) => fn }
  if (name === 'expo-secure-store') return {}
  throw new Error(`unexpected import ${name}`)
})
const { parseQuickCards, toggleQuickCard, QUICK_CARDS_MAX } = mod.exports

test('picks keep their order, and tapping again removes one', () => {
  let ids = toggleQuickCard([], 'a')
  ids = toggleQuickCard(ids, 'b')
  ids = toggleQuickCard(ids, 'c')
  assert.deepEqual(ids, ['a', 'b', 'c'])
  assert.deepEqual(toggleQuickCard(ids, 'b'), ['a', 'c'])
})

test('no more than the limit can be picked', () => {
  const full = Array.from({ length: QUICK_CARDS_MAX }, (_, i) => `shop${i}`)
  assert.deepEqual(toggleQuickCard(full, 'extra'), full)
})

test('stored value is read defensively', () => {
  assert.deepEqual(parseQuickCards(null), [])
  assert.deepEqual(parseQuickCards('not json'), [])
  assert.deepEqual(parseQuickCards('{"a":1}'), [])
  assert.deepEqual(parseQuickCards('["a",2,"b"]'), ['a', 'b'])
  assert.equal(parseQuickCards(JSON.stringify(['1', '2', '3', '4', '5', '6'])).length, QUICK_CARDS_MAX)
})
