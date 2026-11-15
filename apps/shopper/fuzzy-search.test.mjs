import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fuzzyFilter, normaliseSearch, editDistance } from './src/fuzzy-search.ts';

const shops = [
  { name: 'Café Nero', category: 'Coffee', address: '1 High St' },
  { name: 'Notes Coffee', category: 'Coffee', address: '2 Low Rd' },
  { name: 'Nuts About Nuts', category: 'Food', address: '3 Mill Ln' },
  { name: 'The Bake House', category: 'Bakery', address: 'Nero Way' },
];
const f = (q) => fuzzyFilter(shops, q, (s) => [s.name, s.category, s.address]).map((s) => s.name);

test('normalise strips accents and punctuation', () => assert.equal(normaliseSearch('  Café  Nero\'s '), 'cafe nero s'));
test('edit distance counts a swap as one', () => { assert.equal(editDistance('nero', 'nreo'), 1); assert.equal(editDistance('abc', 'abc'), 0); });
test('empty query returns everything untouched', () => assert.deepEqual(f('  '), shops.map((s) => s.name)));
test('accent-insensitive', () => assert.equal(f('cafe')[0], 'Café Nero'));
test('typo: "nots" still finds Notes Coffee', () => assert.ok(f('nots').includes('Notes Coffee')));
test('transposed letters', () => assert.equal(f('nreo')[0], 'Café Nero'));
test('name match outranks address match', () => assert.deepEqual(f('nero').slice(0, 2), ['Café Nero', 'The Bake House']));
test('every word must match', () => assert.deepEqual(f('nero bakery'), ['The Bake House']));
test('short junk does not fuzzy-match everything', () => assert.deepEqual(f('zz'), []));
test('partial word', () => assert.equal(f('cof')[0], 'Notes Coffee'));
