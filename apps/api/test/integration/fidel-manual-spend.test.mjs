import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { as, startFidelDatabase } from './fidel-fixture.mjs';

// Manual spend entry (ARCH_PLAN.md §4.10, decisions M1–M3) on the focused
// fixture (see fidel-fixture.mjs): not a full-history replay.

test('manual spend: callers, cap, membership, idempotency, rewards, P5 and undo windows', { timeout: 120000 }, async () => {
  const { client, newClient, migrations, stop } = await startFidelDatabase('loyalty-manual-spend-');
  try {
    assert.ok(migrations.includes('20260923231109_fidel_manual_spend_entry.sql'));

    // --- privileges ---
    for (const [sig, clientFacing] of [
      ['public.record_manual_spend(uuid,uuid,integer,text,uuid)', true],
      ['public.undo_manual_spend(uuid,text)', true],
      ['public.scanned_member_spend_summary(uuid,uuid)', true],
      ['public.can_record_manual_spend(uuid,uuid)', false],
      ['public.handle_spend_void()', false],
    ]) {
      for (const role of ['anon', 'authenticated']) {
        const { rows: [p] } = await client.query(
          "select has_function_privilege($1::name, $2::text, 'EXECUTE') as ok", [role, sig]);
        assert.equal(p.ok, clientFacing && role === 'authenticated', `${role} EXECUTE ${sig}`);
      }
    }

    // --- people and shops ---
    const [owner, staff, noPermStaff, admin, alice, bob, carol, stranger] = Array.from({ length: 8 }, () => randomUUID());
    const shop = randomUUID(), stampShop = randomUUID();
    await client.query('insert into auth.users(id) select unnest($1::uuid[])', [[owner, staff, noPermStaff, admin, alice, bob, carol, stranger]]);
    await client.query(`insert into public.businesses(id, owner_id, name, reward_model, reward_threshold_pence)
      values ($1, $3, 'Spend Cafe', 'spend_threshold', 3000), ($2, $3, 'Stamp Cafe', 'stamp_legacy', null)`, [shop, stampShop, owner]);
    await client.query("insert into public.test_staff values ($1, $2, 'scan_stamps'), ($1, $3, 'respond_reviews'), ($4, $2, 'scan_stamps')",
      [shop, staff, noPermStaff, stampShop]);
    await client.query('insert into public.test_admins values ($1)', [admin]);
    for (const customer of [alice, bob, carol]) {
      await client.query('insert into public.memberships(user_id, business_id) values ($1, $2), ($1, $3)', [customer, shop, stampShop]);
    }

    const record = (caller, customer, amount, { business = shop, method = null, ref = randomUUID(), c = client } = {}) =>
      as(c, 'authenticated', caller,
        'select public.record_manual_spend($1, $2, $3, $4, $5) as r', [business, customer, amount, method, ref])
        .then(res => res.rows[0].r);
    const progress = async (customer, business = shop) => (await client.query(
      'select reward_progress_pence p, redemption_blocked_reason b from public.memberships where user_id = $1 and business_id = $2',
      [customer, business])).rows[0];

    // --- callers (M3) ---
    await assert.rejects(record(stranger, alice, 500), /not_allowed/);
    await assert.rejects(record(noPermStaff, alice, 500), /not_allowed/);
    await assert.rejects(record(alice, alice, 500), /not_allowed/, 'customers cannot credit themselves');
    await assert.rejects(as(client, 'anon', null,
      'select public.record_manual_spend($1, $2, 500, null, $3)', [shop, alice, randomUUID()]), /permission denied/);
    const first = await record(staff, alice, 450);
    assert.deepEqual({ ...first, transactionId: undefined },
      { status: 'recorded', transactionId: undefined, amountPence: 450, progressPence: 450, thresholdPence: 3000, rewardsEarned: 0 });
    assert.equal((await record(owner, alice, 100)).status, 'recorded');
    assert.equal((await record(admin, alice, 100)).status, 'recorded');
    assert.equal((await progress(alice)).p, 650);
    const row = (await client.query('select recorded_by, type::text, manual_payment_method from public.transactions where id = $1', [first.transactionId])).rows[0];
    assert.deepEqual(row, { recorded_by: staff, type: 'spend', manual_payment_method: null });

    // --- shop, amount (M1), membership ---
    await assert.rejects(record(staff, alice, 500, { business: stampShop }), /shop_not_spend_based/);
    await assert.rejects(record(staff, alice, 0), /amount_out_of_range/);
    assert.equal((await record(staff, bob, 1)).status, 'recorded', '1p allowed');
    assert.equal((await record(staff, bob, 20000)).rewardsEarned, 6, 'cap allowed; £200.01 over a £30 threshold earns 6 rewards');
    await assert.rejects(record(staff, bob, 20001), err => {
      assert.match(err.message, /amount_out_of_range/);
      assert.equal(err.detail, '20000');
      return true;
    });
    await as(client, 'authenticated', owner, 'update public.businesses set manual_spend_max_pence = 50000 where id = $1', [shop])
      .catch(() => client.query('update public.businesses set manual_spend_max_pence = 50000 where id = $1', [shop]));
    assert.equal((await record(staff, bob, 50000)).status, 'recorded', 'owner raised cap applies');
    await assert.rejects(client.query('update public.businesses set manual_spend_max_pence = 100001 where id = $1', [shop]),
      /businesses_manual_spend_max_pence_check/);
    await assert.rejects(client.query('update public.businesses set manual_spend_max_pence = 99 where id = $1', [shop]),
      /businesses_manual_spend_max_pence_check/);
    const nonMember = randomUUID();
    await client.query('insert into auth.users(id) values ($1)', [nonMember]);
    await assert.rejects(record(staff, nonMember, 500), /not_a_member/);

    // --- idempotency ---
    const ref = randomUUID();
    const once = await record(staff, carol, 700, { ref });
    const twice = await record(staff, carol, 700, { ref });
    assert.equal(once.status, 'recorded');
    assert.equal(twice.status, 'duplicate');
    assert.equal(twice.transactionId, once.transactionId);
    assert.equal((await progress(carol)).p, 700, 'a retried entry is not credited twice');
    await assert.rejects(record(owner, carol, 700, { ref }), /invalid_client_ref/, 'another caller cannot reuse a ref');
    const concurrentRef = randomUUID();
    const [a, b] = await Promise.all([
      record(staff, carol, 300, { ref: concurrentRef, c: await newClient() }),
      record(staff, carol, 300, { ref: concurrentRef, c: await newClient() }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), ['duplicate', 'recorded']);
    assert.equal((await client.query('select count(*)::int n from public.transactions where client_ref = $1', [concurrentRef])).rows[0].n, 1);
    assert.equal((await progress(carol)).p, 1000);

    // --- direct client inserts of spend stay refused ---
    await assert.rejects(as(client, 'authenticated', staff,
      "insert into public.transactions(user_id, business_id, type, value) values ($1, $2, 'spend', 500)", [carol, shop]),
      /row-level security/);

    // --- P5 still applies through the RPC ---
    await client.query(`insert into public.business_fidel_locations(business_id, fidel_program_id, fidel_location_id, fidel_status)
      values ($1, 'prog', 'loc', 'active')`, [shop]);
    await client.query("insert into public.linked_cards(user_id, fidel_card_id, card_scheme, last_numbers) values ($1, 'card-carol', 'visa', '4242')", [carol]);
    await assert.rejects(record(staff, carol, 500), /linked_customer_payment_method_required/);
    assert.equal((await record(staff, carol, 500, { method: 'cash' })).status, 'recorded');
    await assert.rejects(record(staff, carol, 500, { method: 'cash' }), /manual_too_soon/);
    await assert.rejects(record(staff, carol, 500, { method: 'cheque' }), /invalid_arguments/);

    // --- summary after a scan ---
    const summary = (await as(client, 'authenticated', staff,
      'select public.scanned_member_spend_summary($1, $2) as s', [carol, shop])).rows[0].s;
    assert.equal(summary.rewardModel, 'spend_threshold');
    assert.equal(summary.member, true);
    assert.equal(summary.thresholdPence, 3000);
    assert.equal(summary.manualMaxPence, 50000);
    assert.equal(summary.linked, true);
    assert.equal(summary.manualToday, 1);
    assert.ok(summary.nextAllowedAt);
    await assert.rejects(as(client, 'authenticated', stranger,
      'select public.scanned_member_spend_summary($1, $2)', [carol, shop]), /not_allowed/);

    // --- undo (M2) ---
    const undo = (caller, id) => as(client, 'authenticated', caller,
      'select public.undo_manual_spend($1, $2) as r', [id, 'Typo']).then(r => r.rows[0].r);
    const age = (id, interval) => client.query(`update public.transactions set created_at = now() - interval '${interval}' where id = $1`, [id]);

    // alice: staff undo own entry at 9 minutes allowed, and progress goes back down.
    const own = await record(staff, alice, 1000);
    const before = (await progress(alice)).p;
    await age(own.transactionId, '9 minutes');
    assert.equal((await undo(staff, own.transactionId)).status, 'undone');
    assert.equal((await progress(alice)).p, before - 1000);
    await assert.rejects(undo(staff, own.transactionId), /already_undone/);
    const voided = (await client.query('select voided_by, void_reason from public.transactions where id = $1', [own.transactionId])).rows[0];
    assert.deepEqual(voided, { voided_by: staff, void_reason: 'Typo' });
    assert.equal((await client.query(
      "select count(*)::int n from public.notifications where user_id = $1 and title = 'Purchase corrected'", [alice])).rows[0].n, 1);

    // staff at 11 minutes: too late; someone else's entry: not allowed.
    const late = await record(staff, alice, 200);
    await age(late.transactionId, '11 minutes');
    await assert.rejects(undo(staff, late.transactionId), /too_late/);
    const ownersEntry = await record(owner, alice, 200);
    await assert.rejects(undo(staff, ownersEntry.transactionId), /not_allowed/);
    // owner: any manual entry up to 7 days.
    await age(late.transactionId, '6 days');
    assert.equal((await undo(owner, late.transactionId)).status, 'undone');
    const old = await record(staff, alice, 200);
    await age(old.transactionId, '8 days');
    await assert.rejects(undo(owner, old.transactionId), /too_late/);
    await assert.rejects(undo(stranger, ownersEntry.transactionId), /not_allowed/);
    assert.equal((await undo(admin, ownersEntry.transactionId)).status, 'undone');

    // a Fidel-credited row (no recorded_by) can never be undone here.
    const fidelRow = (await as(client, 'service_role', null,
      "insert into public.transactions(user_id, business_id, type, value, note) values ($1, $2, 'spend', 500, 'fidel:auth:x') returning id",
      [alice, shop])).rows[0].id;
    await assert.rejects(undo(owner, fidelRow), /not_allowed/);

    // undo that takes progress below zero blocks redemption.
    const dave = randomUUID();
    await client.query('insert into auth.users(id) values ($1)', [dave]);
    await client.query('insert into public.memberships(user_id, business_id) values ($1, $2)', [dave, shop]);
    const big = await record(staff, dave, 3500);
    assert.equal(big.rewardsEarned, 1);
    assert.equal((await progress(dave)).p, 500);
    assert.equal((await undo(owner, big.transactionId)).status, 'undone');
    const after = await progress(dave);
    assert.equal(after.p, -3000);
    assert.match(after.b, /corrected/);

    // voided rows still count toward the P5 daily limit.
    const voidedCount = (await client.query(`select count(*)::int n from public.transactions
      where user_id = $1 and business_id = $2 and manual_payment_method is not null and voided_at is null`, [carol, shop])).rows[0].n;
    const allCount = (await client.query(`select count(*)::int n from public.transactions
      where user_id = $1 and business_id = $2 and manual_payment_method is not null`, [carol, shop])).rows[0].n;
    assert.equal(voidedCount, allCount);
    const carolCash = (await client.query(`select id from public.transactions where user_id = $1 and manual_payment_method = 'cash' limit 1`, [carol])).rows[0].id;
    assert.equal((await undo(staff, carolCash)).status, 'undone');
    const status = (await as(client, 'authenticated', staff,
      'select public.customer_card_link_status($1, $2) as s', [carol, shop])).rows[0].s;
    assert.equal(status.manualToday, 1, 'an undone entry still counts');

    // clients still cannot void rows directly.
    await assert.rejects(as(client, 'authenticated', owner,
      "update public.transactions set voided_at = now(), void_reason = 'x' where id = $1 returning id", [fidelRow])
      .then(r => { if (r.rowCount === 0) throw new Error('no rows updated'); }), /permission denied|no rows updated/);
  } finally {
    await stop();
  }
});
