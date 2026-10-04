import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { startFidelDatabase } from './fidel-fixture.mjs';

// 20261004001549_back_to_stamps.sql after the 2026-09-25 switchover: shops return
// to stamps (Pure Elegant stays on £), nothing is deleted, stamps work again.

const migrations = (name) => new URL(`../../../../supabase/migrations/${name}`, import.meta.url);

test('back to stamps moves shops to stamps, keeps Pure Elegant and all data, and the stamp guard lets stamps through', { timeout: 120000 }, async () => {
  const { client, stop } = await startFidelDatabase('loyalty-back-to-stamps-');
  try {
    const owner = randomUUID();
    await client.query('insert into auth.users(id) values ($1)', [owner]);
    const shop = async (name, model = 'stamp_legacy') => {
      const id = randomUUID();
      await client.query('insert into public.businesses(id, owner_id, name, reward_model, reward_threshold_pence) values ($1, $2, $3, $4, 1000)', [id, owner, name, model]);
      await client.query('insert into public.reward_catalog(business_id, title, stamp_threshold) values ($1, $2, 3)', [id, 'Free coffee']);
      return id;
    };
    const cafe = await shop('Demo Cafe');
    const pure = await shop('Pure Elegant Dry Cleaners', 'spend_threshold');
    const customer = randomUUID();
    await client.query('insert into auth.users(id) values ($1)', [customer]);
    await client.query('insert into public.memberships(user_id, business_id) values ($1, $2), ($1, $3)', [customer, cafe, pure]);

    await client.query(await readFile(migrations('20260925190000_spend_switchover.sql'), 'utf8'));
    assert.equal((await client.query('select reward_model m from public.businesses where id=$1', [cafe])).rows[0].m, 'spend_threshold');
    await assert.rejects(client.query("insert into public.transactions(user_id, business_id, type, value) values ($1, $2, 'stamp', 1)", [customer, cafe]), /shop_uses_spend_rewards/);

    await client.query(await readFile(migrations('20261004001549_back_to_stamps.sql'), 'utf8'));
    const model = async (id) => (await client.query('select reward_model m from public.businesses where id=$1', [id])).rows[0].m;
    assert.equal(await model(cafe), 'stamp_legacy');
    assert.equal(await model(pure), 'spend_threshold', 'Pure Elegant stays on £');

    const fresh = randomUUID();
    await client.query('insert into public.businesses(id, owner_id, name) values ($1, $2, $3)', [fresh, owner, 'New shop']);
    assert.equal(await model(fresh), 'stamp_legacy', 'new shops default to stamps');

    // The focused fixture has no stamp award trigger (handle_stamp_transaction lives in
    // 20260806144703_core_loop.sql), so this only proves the guard lets a stamp through.
    await client.query("insert into public.transactions(user_id, business_id, type, value) values ($1, $2, 'stamp', 1)", [customer, cafe]);
    assert.equal((await client.query('select spend_threshold_pence p from public.reward_catalog where business_id=$1', [cafe])).rows[0].p, 2000, '£ amounts are kept');
    await assert.rejects(client.query("insert into public.transactions(user_id, business_id, type, value) values ($1, $2, 'stamp', 1)", [customer, pure]), /shop_uses_spend_rewards/, 'the stamp guard still protects the spend shop');
  } finally {
    await stop();
  }
});
