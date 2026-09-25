import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { as, startFidelDatabase } from './fidel-fixture.mjs';

// The one-off switchover (ARCH_PLAN.md §4.11) on the focused fixture, with shop
// shapes copied from the live data: a spend shop with an un-priced reward,
// stamp shops with one or several rewards, and a stamp shop with none.

const switchover = new URL('../../../../supabase/migrations/20260925190000_spend_switchover.sql', import.meta.url);

test('switchover prices every reward, moves every shop to spend, resets stamp progress and keeps earned rewards', { timeout: 120000 }, async () => {
  const { client, stop } = await startFidelDatabase('loyalty-switchover-');
  try {
    const owner = randomUUID();
    await client.query('insert into auth.users(id) values ($1)', [owner]);
    const shop = async (name, model = 'stamp_legacy', threshold = null) => {
      const id = randomUUID();
      await client.query(`insert into public.businesses(id, owner_id, name, reward_model, reward_threshold_pence)
        values ($1, $2, $3, $4, $5)`, [id, owner, name, model, threshold]);
      return id;
    };
    const reward = (business, title, stamps, sort = 0) => client.query(
      'insert into public.reward_catalog(business_id, title, stamp_threshold, sort_order) values ($1, $2, $3, $4)',
      [business, title, stamps, sort]);
    const member = async (business, progress, blocked = null) => {
      const id = randomUUID();
      await client.query('insert into auth.users(id) values ($1)', [id]);
      await client.query(`insert into public.memberships(user_id, business_id, reward_progress_pence, redemption_blocked_reason)
        values ($1, $2, $3, $4)`, [id, business, progress, blocked]);
      await client.query("insert into public.rewards(user_id, business_id, title) values ($1, $2, 'Earned before')", [id, business]);
      return id;
    };
    const tiers = async (business) => (await client.query(
      'select title, spend_threshold_pence p from public.reward_catalog where business_id=$1 order by spend_threshold_pence', [business])).rows
      .map(r => [r.title, r.p]);
    const biz = async (business) => (await client.query(
      'select reward_model m, reward_threshold_pence t from public.businesses where id=$1', [business])).rows[0];
    const progress = async (user, business) => (await client.query(
      'select reward_progress_pence p, redemption_blocked_reason b from public.memberships where user_id=$1 and business_id=$2', [user, business])).rows[0];

    const pure = await shop('Pure Elegant', 'spend_threshold', 1000);
    await reward(pure, '£5 Off', 10);
    const pureCustomer = await member(pure, 640);

    const cafe = await shop('Demo Cafe');
    await reward(cafe, 'Free coffee', 10);
    const cafeCustomer = await member(cafe, 0);
    await as(client, 'service_role', null, 'update public.memberships set stamp_count = 7 where user_id = $1', [cafeCustomer]);

    const bakery = await shop('Bakery');
    await reward(bakery, 'Free bun', 5);
    await reward(bakery, 'Free cake', 12, 1);
    await reward(bakery, 'Free loaf', 12, 2);

    const empty = await shop('Squeezed');
    const blockedCustomer = await member(empty, -300, 'refund');

    const rewardsBefore = (await client.query('select count(*)::int n from public.rewards')).rows[0].n;

    await client.query(await readFile(switchover, 'utf8'));

    assert.deepEqual(await tiers(pure), [['£5 Off', 1000]], 'a spend shop keeps its amount');
    assert.deepEqual(await biz(pure), { m: 'spend_threshold', t: 1000 });
    assert.deepEqual(await progress(pureCustomer, pure), { p: 640, b: null }, 'spend-shop progress is kept');

    assert.deepEqual(await tiers(cafe), [['Free coffee', 2000]], 'the lowest reward unlocks at £20');
    assert.deepEqual(await biz(cafe), { m: 'spend_threshold', t: 2000 });

    assert.deepEqual(await tiers(bakery), [['Free bun', 2000], ['Free cake', 4800], ['Free loaf', 4900]],
      'higher rewards scale in whole pounds and equal stamp counts get distinct amounts');
    assert.equal((await biz(bakery)).t, 4900, 'the cycle length is the biggest reward');

    assert.deepEqual(await tiers(empty), [['Free reward', 2000]], 'a shop with no rewards gets one at £20');
    assert.deepEqual(await progress(blockedCustomer, empty), { p: 0, b: null }, 'stamp-shop progress starts at £0 and the block clears');

    assert.equal((await client.query('select count(*)::int n from public.rewards')).rows[0].n, rewardsBefore, 'earned rewards are untouched');

    const fresh = randomUUID();
    await client.query('insert into public.businesses(id, owner_id, name) values ($1, $2, $3)', [fresh, owner, 'New shop']);
    assert.deepEqual(await biz(fresh), { m: 'spend_threshold', t: 2000 }, 'new shops default to spend at £20');

    await assert.rejects(client.query(
      "insert into public.transactions(user_id, business_id, type, value) values ($1, $2, 'stamp', 1)", [cafeCustomer, cafe]),
      /shop_uses_spend_rewards/, 'stamps are refused after the switchover');
  } finally {
    await stop();
  }
});
