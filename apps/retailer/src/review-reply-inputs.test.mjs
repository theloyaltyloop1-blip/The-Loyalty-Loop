import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeReplyInputs } from './review-reply-inputs.ts';

test('polling keeps an unsaved correction on one review while another is being written', () => {
  const reviews = [{ id: 'a', reply: null }, { id: 'b', reply: null }];
  // Owner is fixing review A's suggestion while review B's AI reply is still generating.
  const current = { a: 'Sorry about the wait, we have fixed the till.', b: '' };
  const drafts = { a: { status: 'ready', body: 'We are so sorry.' }, b: { status: 'generating', body: null } };
  const first = mergeReplyInputs(current, reviews, drafts, new Set(['a']));
  assert.equal(first.a, 'Sorry about the wait, we have fixed the till.');
  assert.equal(first.b, '');
  // B's reply lands on the next poll; A's correction is still there.
  const second = mergeReplyInputs(first, reviews, { ...drafts, b: { status: 'ready', body: 'Thank you!' } }, new Set(['a']));
  assert.equal(second.a, 'Sorry about the wait, we have fixed the till.');
  assert.equal(second.b, 'Thank you!');
});

test('untouched boxes follow the saved reply, then the AI suggestion, then empty', () => {
  const reviews = [{ id: 'a', reply: [{ body: 'Posted reply' }] }, { id: 'b', reply: null }, { id: 'c', reply: null }];
  const drafts = { a: { status: 'ready', body: 'Old draft' }, b: { status: 'ready', body: 'Suggestion' }, c: { status: 'dismissed', body: 'Gone' } };
  assert.deepEqual(mergeReplyInputs({}, reviews, drafts, new Set()), { a: 'Posted reply', b: 'Suggestion', c: '' });
});
