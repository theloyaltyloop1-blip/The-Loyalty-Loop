import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isStop, nextTier, pounds, progressLine, welcomeBack } from './whatsapp-messages.ts';

const shop = (progressPence, tiers = [{ title: 'Free coffee', spend_threshold_pence: 1000 }, { title: 'Free lunch', spend_threshold_pence: 2000 }], thresholdPence = 2000) =>
  ({ name: 'Pure Elegant', progressPence, thresholdPence, tiers });

test('pounds formats whole and part pounds, and negatives', () => {
  assert.equal(pounds(2000), '£20');
  assert.equal(pounds(1250), '£12.50');
  assert.equal(pounds(-726), '-£7.26');
});

test('next tier matches spend_next_tier', () => {
  assert.deepEqual(nextTier(shop(0)), { title: 'Free coffee', amountPence: 1000 });
  assert.deepEqual(nextTier(shop(1000)), { title: 'Free lunch', amountPence: 2000 }, 'exactly on a tier moves to the next');
  assert.deepEqual(nextTier(shop(2500)), { title: 'Free lunch', amountPence: 2000 }, 'above every tier: the highest');
  assert.deepEqual(nextTier(shop(300, [], 1500)), { title: 'Free reward', amountPence: 1500 }, 'no £ tiers: single threshold');
  assert.equal(nextTier(shop(300, [], null)), null);
});

test('progress lines read naturally, including negative progress after a refund', () => {
  assert.equal(progressLine(shop(1250)), '• Pure Elegant: £12.50 of £20 towards Free lunch (£7.50 to go)');
  assert.equal(progressLine(shop(-726)), '• Pure Elegant: £0 of £10 towards Free coffee (£17.26 to go)');
  assert.equal(progressLine(shop(2500)), '• Pure Elegant: your Free lunch is ready');
});

test('welcome back lists shops, caps at ten and always gives the card link', () => {
  const one = welcomeBack('Zahi', [shop(1250)], 'https://x/card?token=t');
  assert.match(one, /^Welcome back, Zahi!/);
  assert.match(one, /£12\.50 of £20 towards Free lunch/);
  assert.match(one, /https:\/\/x\/card\?token=t$/);
  assert.doesNotMatch(one, /stamp|point/i);
  const many = welcomeBack(null, Array.from({ length: 12 }, () => shop(0)), 'u');
  assert.equal(many.split('\n').filter((l) => l.startsWith('• ')).length, 10);
  assert.match(many, /…and 2 more in the app\./);
  assert.match(welcomeBack(null, [], 'u'), /haven't joined any shops yet/);
});

test('STOP and its variants are recognised on their own only', () => {
  for (const t of ['STOP', 'stop', ' Stop ', 'unsubscribe', 'opt out']) assert.equal(isStop(t), true, t);
  for (const t of ['stop please send more', 'nonstop', 'START']) assert.equal(isStop(t), false, t);
});
