import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { classifyFailure, coarseNear, COPY, poseFor, resolvePose, STARTERS, toRequestMessages, NOTICE_TEXT } from './ask-whirl-core.ts';

test('the shopper and Business copies of the core are identical', () => {
  const a = readFileSync(new URL('./ask-whirl-core.ts', import.meta.url), 'utf8');
  const b = readFileSync(new URL('../../retailer/src/ask-whirl-core.ts', import.meta.url), 'utf8');
  assert.equal(a, b);
  const sa = readFileSync(new URL('./components/AskWhirlSheet.tsx', import.meta.url), 'utf8');
  const sb = readFileSync(new URL('../../retailer/src/components/AskWhirlSheet.tsx', import.meta.url), 'utf8');
  assert.equal(sa, sb);
});

test('poses per state: wave on open, think while waiting, thumbs after an answer, oops on error, sleepy when blocked', () => {
  assert.equal(poseFor('idle', false), 'wave');
  assert.equal(poseFor('thinking', true), 'think');
  assert.equal(poseFor('answered', true), 'thumbs');
  assert.equal(poseFor('error', true), 'oops');
  assert.equal(poseFor('refused', true), 'oops');
  for (const st of ['offline', 'minute', 'day', 'resting']) assert.equal(poseFor(st, true), 'sleepy');
});

test('oops is drawn by the kit; an older kit without it falls back to sleepy', () => {
  assert.equal(resolvePose('oops'), 'oops');
  assert.equal(resolvePose('oops', ['wave', 'sleepy']), 'sleepy');
  assert.equal(resolvePose('think'), 'think');
});

test('failures map to the right state', () => {
  assert.equal(classifyFailure(null, null), 'offline');
  assert.equal(classifyFailure(429, { scope: 'minute' }), 'minute');
  assert.equal(classifyFailure(429, { scope: 'day' }), 'day');
  assert.equal(classifyFailure(429, { scope: 'global' }), 'day');
  assert.equal(classifyFailure(429, { error: 'Daily message limit reached — try again tomorrow.' }), 'day');
  assert.equal(classifyFailure(429, { error: 'Too many requests — please slow down.' }), 'minute');
  assert.equal(classifyFailure(503, { reason: 'resting' }), 'resting');
  assert.equal(classifyFailure(502, null), 'error');
  assert.equal(classifyFailure(500, 'x'), 'error');
});

test('requests carry only user/assistant turns, the last 10, trimmed to 500 chars', () => {
  const history = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
  const out = toRequestMessages(history, '  hello  ' + 'x'.repeat(600));
  assert.equal(out.length, 10);
  assert.equal(out.at(-1).role, 'user');
  assert.ok(out.at(-1).content.length <= 500);
  assert.deepEqual(Object.keys(out[0]).sort(), ['content', 'role']);
});

test('location is rounded to about 1 km before it leaves the phone', () => {
  assert.deepEqual(coarseNear(51.50731, -0.12765), { lat: 51.51, lng: -0.13 });
  assert.equal(coarseNear('a', 1), null);
});

test('every problem state has copy; starters and notice are present and name Groq', () => {
  for (const k of ['refused', 'error', 'offline', 'minute', 'day', 'resting']) assert.ok(COPY[k].text.length > 10);
  assert.equal(STARTERS.shopper.length, 3);
  assert.equal(STARTERS.business.length, 3);
  assert.match(NOTICE_TEXT, /Groq/);
  assert.match(NOTICE_TEXT, /do not keep the chat/);
});
