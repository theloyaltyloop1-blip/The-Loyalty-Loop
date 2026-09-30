import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from '../../node_modules/typescript/lib/typescript.js';

// Runs the shop screen's real review functions from App.tsx with fake
// Supabase and timers: no Expo, React or network.
const app = (await readFile(new URL('./App.tsx', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const slice = (from, to) => {
  const start = app.indexOf(from);
  assert.ok(start >= 0, 'missing: ' + from);
  return app.slice(start, app.indexOf(to, start));
};
const load = slice('  const loadReviews = async () => {', '\n\n  useEffect');
const openEffect = slice('  useEffect(() => {\n    // Opening a shop fills the editor', '\n  }, [business.id, userId])')
  .replace('  useEffect(() => {', 'const openShop = () => {') + '\n};';
const save = slice('  async function saveReview()', '\n\n  function reportReview');

function screen({ saved = { rating: 5, body: 'Saved review' }, slowLoad = false } = {}) {
  let nextTimer = 1;
  // Slow loads wait here until the test releases them, in any order.
  const loads = [];
  const state = { reviewBody: '', reviewRating: 5, reviews: [], timers: new Map(), cleared: [], alerts: [], loading: null };
  const rows = () => [{ id: 'r', user_id: 'customer', rating: saved.rating, body: saved.body, reply: { body: 'Thank you!', created_at: 't' } }];
  const context = {
    business: { id: 'shop' }, userId: 'customer', hiddenReviewIds: new Set(),
    replyChecks: { current: [] },
    containsBlockedLanguage: () => false, Alert: { alert: (title) => { state.alerts.push(title); } },
    setSavingReview: () => {}, setReviewsLoading: (x) => { state.loading = x; },
    setReviews: (items) => { state.reviews = items; },
    setReviewBody: (x) => { state.reviewBody = x; context.reviewBody = x; },
    setReviewRating: (x) => { state.reviewRating = x; context.reviewRating = x; },
    setTimeout: (fn, delay) => { const id = nextTimer++; state.timers.set(id, { fn, delay }); return id; },
    clearTimeout: (id) => { state.cleared.push(id); state.timers.delete(id); },
    supabase: { from: () => ({
      upsert: async () => ({ error: null }),
      select: () => ({ eq: () => ({ order: () => slowLoad
        ? new Promise((resolve) => { loads.push(() => resolve({ error: null, data: rows() })); })
        : Promise.resolve({ error: null, data: rows() }) }) }),
    }) },
    get reviewBody() { return state.reviewBody; }, set reviewBody(x) { state.reviewBody = x; },
    get reviewRating() { return state.reviewRating; }, set reviewRating(x) { state.reviewRating = x; },
  };
  const js = ts.transpileModule(`${load}\n${openEffect}\n${save}\n({ loadReviews, openShop, saveReview });`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const fns = vm.runInNewContext(js, context);
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  return { state, fns, tick, release: (index) => loads[index]() };
}

test('opening a shop fills the editor with the saved review once', async () => {
  const { state, fns, tick } = screen();
  fns.openShop();
  await tick();
  assert.deepEqual([state.reviewBody, state.reviewRating], ['Saved review', 5]);
});

test('a reply check after saving shows the reply but keeps what the shopper is typing', async () => {
  const { state, fns, tick } = screen();
  state.reviewBody = 'Saved review';
  await fns.saveReview();
  assert.deepEqual([...state.timers.values()].map((t) => t.delay), [4000, 12000]);
  // The shopper starts correcting their review before the check lands.
  state.reviewBody = 'Unsaved correction';
  state.reviewRating = 3;
  for (const { fn } of state.timers.values()) fn();
  await tick();
  assert.deepEqual([state.reviewBody, state.reviewRating], ['Unsaved correction', 3]);
  assert.equal(state.reviews[0].reply.body, 'Thank you!');
});

test('leaving or switching shop cancels pending checks and ignores a late load', async () => {
  const { state, fns, tick, release } = screen({ slowLoad: true });
  const cleanup = fns.openShop(); // load 0 stays pending
  // A save before the opening load finishes schedules two reply checks.
  const saving = fns.saveReview();
  await tick();
  release(1); // the save's own refresh
  await saving;
  const pending = [...state.timers.keys()];
  assert.equal(pending.length, 2);
  // The shopper leaves; only then does the opening load resolve.
  cleanup();
  release(0);
  await tick();
  assert.deepEqual(state.cleared.sort(), pending.sort(), 'both checks cancelled');
  assert.equal(state.timers.size, 0);
  assert.equal(state.reviewBody, '', 'a late load does not fill the editor after leaving');
});

test('a save that finishes after leaving adds no checks and shows nothing', async () => {
  const { state, fns, tick, release } = screen({ slowLoad: true });
  const cleanup = fns.openShop(); // load 0 pending
  const saving = fns.saveReview();
  await tick(); // saved; its refresh is load 1, still pending
  cleanup(); // the shopper leaves before any check exists
  release(1);
  await saving;
  release(0);
  await tick();
  assert.equal(state.timers.size, 0, 'no reply checks registered after leaving');
  assert.deepEqual(state.alerts, [], 'no "Review saved" message on a screen the shopper has left');
});

test('a late load from the previous shop cannot replace the next shop list or its loading state', async () => {
  const { state, fns, tick, release } = screen({ slowLoad: true });
  const cleanup = fns.openShop(); // load 0 for the old shop
  cleanup(); // switch shop
  const nextShop = [{ id: 'next-shop-review', body: 'Current shop' }];
  state.reviews = nextShop;
  state.loading = true; // the next shop is still loading
  release(0);
  await tick();
  assert.equal(state.reviews, nextShop, 'old list ignored');
  assert.equal(state.loading, true, 'old request does not end the next shop loading state');
  assert.equal(state.reviewBody, '', 'old request does not fill the editor');
});
