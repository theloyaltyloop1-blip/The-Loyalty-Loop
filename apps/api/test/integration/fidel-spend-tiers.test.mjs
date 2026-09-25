import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { as, startFidelDatabase } from './fidel-fixture.mjs';

// Tiered £ rewards (ARCH_PLAN.md §4.11) on the focused fixture: not a
// full-history replay.

test('spend tiers: tier walk, cycles, carry, negative progress, lowered tiers, fallback, sync and stamp guard', { timeout: 120000 }, async () => {
  const { client, migrations, stop } = await startFidelDatabase('loyalty-spend-tiers-');
  try {
    assert.ok(migrations.includes('20260925164755_fidel_spend_tiers.sql'));

    const owner = randomUUID(), staff = randomUUID();
    await client.query('insert into auth.users(id) values ($1), ($2)', [owner, staff]);
    const shop = async (name, threshold = null) => {
      const id = randomUUID();
      await client.query(`insert into public.businesses(id, owner_id, name, reward_model, reward_threshold_pence)
        values ($1, $2, $3, 'spend_threshold', $4)`, [id, owner, name, threshold]);
      await client.query("insert into public.test_staff values ($1, $2, 'scan_stamps')", [id, staff]);
      return id;
    };
    const tier = (business, title, pence) => client.query(
      'insert into public.reward_catalog(business_id, title, spend_threshold_pence) values ($1, $2, $3) returning id',
      [business, title, pence]).then(r => r.rows[0].id);
    const customer = async (business) => {
      const id = randomUUID();
      await client.query('insert into auth.users(id) values ($1)', [id]);
      await client.query('insert into public.memberships(user_id, business_id) values ($1, $2)', [id, business]);
      return id;
    };
    const spend = (business, user, pence) => as(client, 'service_role', null,
      "insert into public.transactions(user_id, business_id, type, value) values ($1, $2, 'spend', $3)", [user, business, pence]);
    const state = async (business, user) => {
      const m = (await client.query('select reward_progress_pence p, redemption_blocked_reason b from public.memberships where user_id=$1 and business_id=$2', [user, business])).rows[0];
      const rewards = (await client.query('select title, catalog_id from public.rewards where user_id=$1 and business_id=$2 order by created_at, title', [user, business])).rows;
      const lastNote = (await client.query("select body from public.notifications where user_id=$1 and business_id=$2 and kind='stamp' order by created_at desc limit 1", [user, business])).rows[0]?.body;
      return { progress: m.p, blocked: m.b, rewards, lastNote };
    };

    // --- one tier at £20 ---
    const cafe = await shop('Cafe');
    const coffee = await tier(cafe, 'Free coffee', 2000);
    assert.equal((await client.query('select reward_threshold_pence t from public.businesses where id=$1', [cafe])).rows[0].t, 2000, 'sync sets the cycle length');
    const amy = await customer(cafe);
    await spend(cafe, amy, 637);
    let s = await state(cafe, amy);
    assert.equal(s.progress, 637);
    assert.equal(s.rewards.length, 0);
    assert.equal(s.lastNote, 'You are £13.63 away from Free coffee.');
    await spend(cafe, amy, 1500);
    s = await state(cafe, amy);
    assert.deepEqual(s.rewards, [{ title: 'Free coffee', catalog_id: coffee }]);
    assert.equal(s.progress, 137, 'cycle restarts at £0 and carries the excess');

    // --- two tiers: £20 coffee, £50 lunch ---
    const bistro = await shop('Bistro');
    await tier(bistro, 'Free coffee', 2000);
    await tier(bistro, 'Free lunch', 5000);
    assert.equal((await client.query('select reward_threshold_pence t from public.businesses where id=$1', [bistro])).rows[0].t, 5000);
    const ben = await customer(bistro);
    await spend(bistro, ben, 6000);
    s = await state(bistro, ben);
    assert.deepEqual(s.rewards.map(r => r.title).sort(), ['Free coffee', 'Free lunch']);
    assert.equal(s.progress, 1000, 'both tiers crossed, cycle restarted, £10 carried');
    await spend(bistro, ben, 1500);
    s = await state(bistro, ben);
    assert.equal(s.rewards.length, 3, '£25 crosses the £20 tier again');
    assert.equal(s.progress, 2500);
    assert.equal((await client.query('select title from public.spend_next_tier($1, 2500)', [bistro])).rows[0].title, 'Free lunch');

    // --- negative progress must be covered first ---
    const cara = await customer(cafe);
    await client.query(`update public.memberships set reward_progress_pence = -300,
      redemption_blocked_reason = 'refund' where user_id=$1 and business_id=$2`, [cara, cafe]);
    await spend(cafe, cara, 2000);
    s = await state(cafe, cara);
    assert.equal(s.rewards.length, 0);
    assert.equal(s.progress, 1700);
    assert.equal(s.blocked, null, 'block clears once progress is back above £0');
    assert.equal(s.lastNote, 'You are £3.00 away from Free coffee.');

    // --- owner lowers every tier below a customer's progress ---
    const deli = await shop('Deli');
    await tier(deli, 'Sandwich', 2000);
    const big = await tier(deli, 'Hamper', 5000);
    const dan = await customer(deli);
    await spend(deli, dan, 3000);
    await client.query('delete from public.reward_catalog where id=$1', [big]);
    assert.equal((await client.query('select reward_threshold_pence t from public.businesses where id=$1', [deli])).rows[0].t, 2000, 'sync follows a deleted tier');
    await spend(deli, dan, 100);
    s = await state(deli, dan);
    assert.deepEqual(s.rewards.map(r => r.title), ['Sandwich', 'Sandwich'], 'the top reward is issued, then a new cycle');
    assert.equal(s.progress, 100);

    // --- no £ tiers: the single-threshold fallback still works ---
    const plain = await shop('Plain', 1000);
    const pat = await customer(plain);
    await spend(plain, pat, 2500);
    s = await state(plain, pat);
    assert.deepEqual(s.rewards.map(r => r.title), ['Free reward', 'Free reward']);
    assert.equal(s.progress, 500);
    assert.equal((await client.query('select amount_pence, title from public.spend_next_tier($1, 500)', [plain])).rows[0].amount_pence, 1000);

    // --- the manual entry RPC reports the next reward ---
    const eve = await customer(bistro);
    const r = (await as(client, 'authenticated', staff,
      'select public.record_manual_spend($1, $2, 450, null, $3) as r', [bistro, eve, randomUUID()])).rows[0].r;
    assert.equal(r.thresholdPence, 2000);
    assert.equal(r.nextRewardTitle, 'Free coffee');
    assert.equal(r.progressPence, 450);

    // --- tier rules ---
    await assert.rejects(tier(bistro, 'Duplicate', 2000), /reward_catalog_business_spend_threshold_key/);
    await assert.rejects(tier(bistro, 'Zero', 0), /reward_catalog_spend_threshold_pence_check/);

    // --- stamps are refused at spend shops, allowed at stamp shops ---
    await assert.rejects(as(client, 'service_role', null,
      "insert into public.transactions(user_id, business_id, type, value) values ($1, $2, 'stamp', 1)", [amy, cafe]),
      /shop_uses_spend_rewards/);
    const stampShop = randomUUID();
    await client.query("insert into public.businesses(id, owner_id, name) values ($1, $2, 'Stamps')", [stampShop, owner]);
    await client.query('insert into public.memberships(user_id, business_id) values ($1, $2)', [amy, stampShop]);
    await as(client, 'service_role', null,
      "insert into public.transactions(user_id, business_id, type, value) values ($1, $2, 'stamp', 1)", [amy, stampShop]);
    await assert.rejects(as(client, 'service_role', null,
      "insert into public.transactions(user_id, business_id, type, value) values ($1, $2, 'stamp', 51)", [amy, stampShop]),
      /transactions_value_check/, 'legacy 1–50 stamp range still enforced at stamp shops');

    // --- privileges ---
    for (const [sig, role, expected] of [
      ['public.spend_next_tier(uuid,integer)', 'anon', false],
      ['public.spend_next_tier(uuid,integer)', 'authenticated', true],
      ['public.sync_business_spend_threshold()', 'authenticated', false],
      ['public.refuse_stamps_at_spend_shops()', 'authenticated', false],
    ]) {
      const { rows: [p] } = await client.query("select has_function_privilege($1::name, $2::text, 'EXECUTE') ok", [role, sig]);
      assert.equal(p.ok, expected, `${role} ${sig}`);
    }
  } finally {
    await stop();
  }
});
