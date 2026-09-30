import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distanceKm, joinChoices, matchShops, nearbyReply, nearestShops, parseJoin, parseNearby } from './whatsapp-shops.ts';

const shops = [
  { id: '1', name: 'Pure Elegant Dry Cleaners', slug: 'pure-elegant', category: 'Dry cleaner', lat: 51.501, lng: -0.1416 },
  { id: '2', name: 'Bean There Cafe', slug: 'bean-there', category: 'Cafe', lat: 51.5033, lng: -0.1195 },
  { id: '3', name: 'Bean Counter', slug: 'bean-counter', category: 'Cafe', lat: 53.8008, lng: -1.5491 },
  { id: '4', name: 'No Location Shop', slug: 'no-location', category: null, lat: null, lng: null },
];

test('JOIN commands are recognised with the shop text', () => {
  assert.equal(parseJoin('JOIN Pure Elegant'), 'Pure Elegant');
  assert.equal(parseJoin('join pure-elegant'), 'pure-elegant');
  assert.equal(parseJoin('can I join?'), null);
  assert.equal(parseJoin('joined'), null);
});

test('nearby requests: postcode, location prompt, or not a nearby request', () => {
  assert.deepEqual(parseNearby('shops near SW1A1AA'), { postcode: 'SW1A 1AA' });
  assert.deepEqual(parseNearby('any shops near ls1 4ap?'), { postcode: 'LS1 4AP' });
  assert.equal(parseNearby('shops near me'), 'ask');
  assert.equal(parseNearby('nearby'), 'ask');
  assert.equal(parseNearby('how close am I to a reward?'), null);
  assert.equal(parseNearby('what rewards do I have'), null);
});

test('shop matching: exact slug or name first, then all-words matches', () => {
  assert.deepEqual(matchShops('pure-elegant', shops).map((s) => s.id), ['1']);
  assert.deepEqual(matchShops('Pure Elegant Dry Cleaners', shops).map((s) => s.id), ['1']);
  assert.deepEqual(matchShops('pure elegant', shops).map((s) => s.id), ['1']);
  assert.deepEqual(matchShops('bean', shops).map((s) => s.id), ['3', '2'], 'shortest name first');
  assert.deepEqual(matchShops('pizza palace', shops), []);
  assert.deepEqual(matchShops('   ', shops), []);
});

test('nearest shops are sorted by distance, skip shops with no location and too far away', () => {
  const near = nearestShops(51.50101, -0.141563, shops);
  assert.deepEqual(near.map((x) => x.shop.id), ['1', '2'], 'Leeds is more than 25 km away; no-location shop skipped');
  assert.ok(near[0].km < 0.1);
  assert.ok(Math.abs(distanceKm(51.50101, -0.141563, 51.5033, -0.1195) - 1.54) < 0.05);
});

test('replies show distance in miles and how to join, marking shops already joined', () => {
  const reply = nearbyReply(nearestShops(51.50101, -0.141563, shops), new Set(['1']));
  assert.match(reply, /Pure Elegant Dry Cleaners \(Dry cleaner\) — right by you ✓ joined/);
  assert.match(reply, /Bean There Cafe \(Cafe\) — 1\.0 miles\n  Reply: JOIN bean-there/);
  assert.match(nearbyReply([], new Set()), /aren't any Loyalty Loop shops near there yet/);
  assert.match(joinChoices(matchShops('bean', shops)), /Bean Counter — reply: JOIN bean-counter/);
});
