import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleReviewReply } from './review-reply-handler.ts';

// Fake dependencies only: no database, network or model.
const REVIEW = '11111111-1111-4111-8111-111111111111';
const claimed = (rating = 5) => ({
  status: 'claimed', attempt: 1, review_version: 't',
  review: { rating, body: 'Great service.' },
  business: { name: 'Pure Elegant', category: 'Dry cleaner', description: null },
  sign_off: null,
});

function fakes({ claim = claimed(), reply = 'Thank you so much for the kind words!', verdict = 'PASS', user = 'owner-1', allowed = true, limits = true, chat = true } = {}) {
  const calls = { rpc: [], chat: [] };
  const deps = {
    rpc: async (fn, args) => {
      calls.rpc.push([fn, args]);
      if (fn === 'can_manage_review_replies') return { data: allowed, error: null };
      if (fn === 'claim_review_reply_generation') return { data: claim, error: null };
      if (fn === 'complete_review_reply_generation') return { data: { status: args._safe_to_post && args._allow_auto_post ? 'posted' : 'ready' }, error: null };
      throw new Error('unexpected rpc ' + fn);
    },
    reviewBusinessId: async () => 'shop-1',
    userIdFromToken: async () => user,
    withinUserLimits: async () => limits,
    chat: chat ? async (messages) => {
      calls.chat.push(messages);
      return calls.chat.length === 1 ? reply : verdict;
    } : null,
  };
  return { deps, calls };
}
const completeArgs = calls => calls.rpc.find(([fn]) => fn === 'complete_review_reply_generation')?.[1];

test('rejects bad ids and unknown modes before touching anything', async () => {
  const { deps, calls } = fakes();
  assert.equal((await handleReviewReply({ review_id: 'nope' }, '', deps)).status, 400);
  assert.equal((await handleReviewReply({ review_id: REVIEW, mode: 'post' }, '', deps)).status, 400);
  assert.equal(calls.rpc.length + calls.chat.length, 0);
});

test('an automatic call the database did not queue costs nothing', async () => {
  const { deps, calls } = fakes({ claim: { status: 'skipped', reason: 'not_requested' } });
  const result = await handleReviewReply({ review_id: REVIEW }, '', deps);
  assert.deepEqual(result, { status: 200, body: { status: 'skipped', reason: 'not_requested' } });
  assert.equal(calls.chat.length, 0);
  assert.deepEqual(calls.rpc.map(([fn]) => fn), ['claim_review_reply_generation']);
});

test('a safe 5-star automatic reply is posted only after the verifier passes it', async () => {
  const { deps, calls } = fakes();
  const result = await handleReviewReply({ review_id: REVIEW }, '', deps);
  assert.equal(result.body.status, 'posted');
  assert.equal(calls.chat.length, 2, 'reply plus verifier');
  assert.equal(completeArgs(calls)._safe_to_post, true);
  assert.equal(completeArgs(calls)._allow_auto_post, true);
});

test('a verifier FAIL, verifier error or filter hit keeps the reply as a draft', async () => {
  for (const [options, reason] of [
    [{ verdict: 'FAIL' }, 'verifier'],
    [{ reply: 'Your next clean is free!' }, 'offer_or_account'],
  ]) {
    const { deps, calls } = fakes(options);
    assert.equal((await handleReviewReply({ review_id: REVIEW }, '', deps)).body.status, 'ready');
    assert.equal(completeArgs(calls)._safe_to_post, false);
    assert.match(completeArgs(calls)._error, new RegExp(reason));
  }
  const { deps, calls } = fakes();
  let n = 0;
  deps.chat = async () => { n += 1; if (n === 2) throw new Error('down'); return 'Thank you!'; };
  assert.equal((await handleReviewReply({ review_id: REVIEW }, '', deps)).body.status, 'ready');
  assert.equal(completeArgs(calls)._error, 'verifier_unavailable');
});

test('low ratings are never verified for posting and stay drafts', async () => {
  const { deps, calls } = fakes({ claim: claimed(2) });
  assert.equal((await handleReviewReply({ review_id: REVIEW }, '', deps)).body.status, 'ready');
  assert.equal(calls.chat.length, 1);
  assert.equal(completeArgs(calls)._safe_to_post, false);
});

test('owner drafts need a signed-in manager within limits and never auto-post', async () => {
  assert.equal((await handleReviewReply({ review_id: REVIEW, mode: 'draft' }, '', fakes().deps)).status, 401);
  assert.equal((await handleReviewReply({ review_id: REVIEW, mode: 'draft' }, 'Bearer t', fakes({ user: null }).deps)).status, 401);
  assert.equal((await handleReviewReply({ review_id: REVIEW, mode: 'draft' }, 'Bearer t', fakes({ allowed: false }).deps)).status, 403);
  assert.equal((await handleReviewReply({ review_id: REVIEW, mode: 'draft' }, 'Bearer t', fakes({ limits: false }).deps)).status, 429);
  const { deps, calls } = fakes();
  const result = await handleReviewReply({ review_id: REVIEW, mode: 'draft' }, 'Bearer t', deps);
  assert.deepEqual(result, { status: 200, body: { status: 'ready', body: 'Thank you so much for the kind words!' } });
  assert.equal(calls.chat.length, 1, 'no verifier for owner drafts');
  assert.equal(completeArgs(calls)._allow_auto_post, false);
  assert.equal(calls.rpc.find(([fn]) => fn === 'claim_review_reply_generation')[1]._force, true);
});

test('without a model key, automatic calls skip and owner calls explain', async () => {
  assert.deepEqual((await handleReviewReply({ review_id: REVIEW }, '', fakes({ chat: false }).deps)).body, { status: 'skipped', reason: 'not_configured' });
  assert.equal((await handleReviewReply({ review_id: REVIEW, mode: 'draft' }, 'Bearer t', fakes({ chat: false }).deps)).status, 503);
});
