import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { as, startFidelDatabase } from './fidel-fixture.mjs';

// Focused fixture (see fidel-fixture.mjs): not a full-history replay.

test('card linking migration: identities, claims, unlink, badge list and P5 manual-entry limits', { timeout: 120000 }, async () => {
  const { client, newClient, migrations, stop } = await startFidelDatabase('loyalty-card-link-');
  try {
    assert.ok(migrations.includes('20260923182000_fidel_card_linking.sql'));

    // --- privileges ---
    const serviceOnly = [
      'public.fidel_link_identity(uuid)',
      'public.claim_linked_card(uuid,text,text,text,text)',
      'public.unlink_linked_card(uuid,uuid,text)',
      'public.mark_fidel_card_deleted(uuid,text)',
      'public.fidel_cards_pending_delete(integer)'
    ];
    const clientFacing = ['public.card_linked_business_ids()', 'public.customer_card_link_status(uuid,uuid)'];
    const internal = [
      'public.london_day_start(timestamptz)',
      'public.business_has_active_fidel_location(uuid)',
      'public.user_has_active_linked_card(uuid)',
      'public.enforce_linked_customer_manual_entry()'
    ];
    for (const sig of [...serviceOnly, ...clientFacing, ...internal]) {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const { rows: [p] } = await client.query(
          "select has_function_privilege($1::name, $2::text, 'EXECUTE') as ok", [role, sig]);
        const expected = (serviceOnly.includes(sig) && role === 'service_role')
          || (clientFacing.includes(sig) && role === 'authenticated');
        assert.equal(p.ok, expected, `${role} EXECUTE ${sig}`);
      }
    }

    // --- people and shops ---
    const [owner, staff, admin, alice, bob, carol, dave, erin, stranger] =
      Array.from({ length: 9 }, () => randomUUID());
    const shop = randomUUID(), syncingShop = randomUUID();
    await client.query('insert into auth.users(id) select unnest($1::uuid[])',
      [[owner, staff, admin, alice, bob, carol, dave, erin, stranger]]);
    await client.query('insert into public.businesses(id, owner_id) values ($1, $3), ($2, $3)',
      [shop, syncingShop, owner]);
    await client.query("insert into public.test_staff values ($1, $2, 'scan_stamps')", [shop, staff]);
    await client.query("insert into public.test_staff values ($1, $2, 'scan_stamps')", [syncingShop, staff]);
    await client.query('insert into public.test_admins values ($1)', [admin]);
    for (const customer of [alice, bob, carol, dave, erin]) {
      await client.query('insert into public.memberships(user_id, business_id) values ($1, $2), ($1, $3)',
        [customer, shop, syncingShop]);
    }
    await client.query(`insert into public.business_fidel_locations
      (business_id, fidel_program_id, fidel_location_id, fidel_status)
      values ($1, 'prog', 'loc-active', 'active'), ($2, 'prog', 'loc-syncing', 'syncing')`,
      [shop, syncingShop]);

    // --- identities ---
    await assert.rejects(as(client, 'authenticated', alice,
      'select public.fidel_link_identity($1)', [alice]), /permission denied/);
    const identity = async user => (await as(client, 'service_role', null,
      'select public.fidel_link_identity($1) as id', [user])).rows[0].id;
    const aliceMeta = await identity(alice);
    assert.match(aliceMeta, /^[0-9a-f]{32}$/);
    assert.equal(await identity(alice), aliceMeta, 'identity is stable');
    assert.notEqual(await identity(bob), aliceMeta);
    await assert.rejects(as(client, 'authenticated', alice,
      'select * from public.fidel_link_identities'), /permission denied/);

    // --- claims ---
    const claim = async (c, user, cardId, scheme = 'visa', last = '4242') =>
      (await as(c, 'service_role', null,
        'select public.claim_linked_card($1, $2, $3, $4, $5) as r',
        [user, cardId, 'acct', scheme, last])).rows[0].r;
    assert.equal((await claim(client, carol, 'card-no-identity')).status, 'no_identity');
    const first = await claim(client, alice, 'card-a1');
    assert.equal(first.status, 'claimed');
    assert.deepEqual(await claim(client, alice, 'card-a1'),
      { status: 'already_linked', linked_card_id: first.linked_card_id });
    assert.deepEqual(await claim(client, bob, 'card-a1'), { status: 'already_linked_elsewhere' });
    await assert.rejects(claim(client, alice, 'card-x', 'discover'), /invalid verified card arguments/);
    await assert.rejects(claim(client, alice, 'card-x', 'visa', '12a4'), /invalid verified card arguments/);

    // Clients can read their own cards but never write them.
    const own = await as(client, 'authenticated', alice, 'select id from public.linked_cards');
    assert.equal(own.rows.length, 1);
    assert.equal((await as(client, 'authenticated', bob, 'select id from public.linked_cards')).rows.length, 0);
    await assert.rejects(as(client, 'authenticated', alice,
      "insert into public.linked_cards(user_id, fidel_card_id) values ($1, 'forged')", [alice]),
      /permission denied/);
    await assert.rejects(as(client, 'authenticated', alice,
      'update public.linked_cards set unlinked_at = null where user_id = $1', [alice]),
      /permission denied/);

    // Cap race: 6 concurrent claims for one user leave exactly 5 active cards.
    await identity(dave);
    const racers = await Promise.all(Array.from({ length: 6 }, () => newClient()));
    const raceResults = await Promise.all(racers.map((c, i) => claim(c, dave, `card-d${i}`)));
    const statuses = raceResults.map(r => r.status).sort();
    assert.deepEqual(statuses, ['claimed', 'claimed', 'claimed', 'claimed', 'claimed', 'limit_reached']);
    assert.equal((await client.query(
      'select count(*)::int n from public.linked_cards where user_id = $1 and unlinked_at is null', [dave])).rows[0].n, 5);

    // Two users racing for the same card: exactly one wins.
    await identity(erin);
    const [c1, c2] = [await newClient(), await newClient()];
    const same = await Promise.all([claim(c1, erin, 'card-shared'), claim(c2, bob, 'card-shared')]);
    assert.deepEqual(same.map(r => r.status).sort(), ['already_linked_elsewhere', 'claimed']);

    // --- unlink, pending delete, re-link ---
    const unlink = async (user, id, reason = 'user') => (await as(client, 'service_role', null,
      'select public.unlink_linked_card($1, $2, $3) as r', [user, id, reason])).rows[0].r;
    assert.deepEqual(await unlink(bob, first.linked_card_id), { status: 'not_found' }, 'not the owner');
    assert.deepEqual(await unlink(alice, first.linked_card_id), { status: 'unlinked', fidel_card_id: 'card-a1' });
    assert.deepEqual(await unlink(alice, first.linked_card_id), { status: 'not_found' }, 'already unlinked');
    const pending = async () => (await as(client, 'service_role', null,
      'select linked_card_id from public.fidel_cards_pending_delete(50)')).rows.map(r => r.linked_card_id);
    assert.ok((await pending()).includes(first.linked_card_id));
    const relink = await claim(client, alice, 'card-a1');
    assert.equal(relink.status, 'claimed', 're-link after unlink works');
    assert.notEqual(relink.linked_card_id, first.linked_card_id);
    assert.ok(!(await pending()).includes(first.linked_card_id),
      'an unlinked row whose card was re-linked must not be deleted at Fidel');
    await as(client, 'service_role', null, 'select public.mark_fidel_card_deleted($1, $2)',
      [first.linked_card_id, 'fidel 503']);
    let row = (await client.query('select fidel_deleted_at, fidel_delete_error from public.linked_cards where id = $1',
      [first.linked_card_id])).rows[0];
    assert.equal(row.fidel_deleted_at, null);
    assert.equal(row.fidel_delete_error, 'fidel 503');
    await as(client, 'service_role', null, 'select public.mark_fidel_card_deleted($1, null)', [first.linked_card_id]);
    row = (await client.query('select fidel_deleted_at, fidel_delete_error from public.linked_cards where id = $1',
      [first.linked_card_id])).rows[0];
    assert.ok(row.fidel_deleted_at instanceof Date);
    assert.equal(row.fidel_delete_error, null);
    await assert.rejects(client.query(
      "update public.linked_cards set unlinked_at = now() where id = $1", [relink.linked_card_id]),
      /linked_cards_unlink_state_check/);

    // --- badge list: only active Locations ---
    const badge = (await as(client, 'authenticated', stranger,
      'select public.card_linked_business_ids() as id')).rows.map(r => r.id);
    assert.deepEqual(badge, [shop]);
    await assert.rejects(as(client, 'anon', null, 'select public.card_linked_business_ids()'), /permission denied/);

    // --- London day boundaries, including both BST/GMT changes ---
    const dayStart = async ts => (await client.query(
      "select to_char(public.london_day_start($1::timestamptz) at time zone 'UTC', 'YYYY-MM-DD HH24:MI') as d", [ts])).rows[0].d;
    assert.equal(await dayStart('2026-10-25T12:00:00Z'), '2026-10-24 23:00'); // BST day, ends at 01:00 UTC change
    assert.equal(await dayStart('2026-10-26T12:00:00Z'), '2026-10-26 00:00'); // GMT
    assert.equal(await dayStart('2027-03-28T12:00:00Z'), '2027-03-28 00:00'); // GMT midnight, BST starts 01:00 UTC
    assert.equal(await dayStart('2027-03-29T12:00:00Z'), '2027-03-28 23:00'); // BST
    assert.equal(await dayStart('2026-10-25T23:30:00Z'), '2026-10-24 23:00'); // 23:30 GMT, still 25 Oct in London
    assert.equal((await client.query(`select to_char(public.london_day_start(
      public.london_day_start('2026-10-25T12:00:00Z') + interval '36 hours') at time zone 'UTC',
      'YYYY-MM-DD HH24:MI') as d`)).rows[0].d, '2026-10-26 00:00', 'next day across a 25-hour day');

    // --- P5 manual entries ---
    // carol gets a fresh card so the manual-entry checks start from a clean slate.
    await identity(carol);
    assert.equal((await claim(client, carol, 'card-c1')).status, 'claimed');
    const staffInsert = (c, customer, business, method, type = 'stamp') => as(c, 'authenticated', staff,
      `insert into public.transactions (user_id, business_id, type, value, manual_payment_method, created_at)
       values ($1, $2, $3, 1, $4, now() - interval '5 days') returning recorded_by, created_at`,
      [customer, business, type, method]);
    // Seeds are inserted as the service role (which the rule exempts), with a
    // timestamp computed by the database owner.
    const seed = async (customer, ageSql) => {
      const { rows: [{ at }] } = await client.query(`select ${ageSql} as at`);
      await as(client, 'service_role', null,
        `insert into public.transactions (user_id, business_id, type, value, manual_payment_method, created_at)
         values ($1, $2, 'stamp', 1, 'cash', $3)`, [customer, shop, at]);
    };
    const clearManual = customer => client.query(
      'delete from public.transactions where user_id = $1 and manual_payment_method is not null', [customer]);

    await assert.rejects(staffInsert(client, carol, shop, null), /linked_customer_payment_method_required/);
    const ok = (await staffInsert(client, carol, shop, 'cash')).rows[0];
    assert.equal(ok.recorded_by, staff, 'trigger records the inserter');
    assert.ok(Date.now() - ok.created_at.getTime() < 60_000, 'client-supplied created_at is replaced by now()');
    await assert.rejects(staffInsert(client, carol, shop, 'unlinked_card'), /manual_too_soon/);

    await clearManual(carol);
    await seed(carol, "now() - interval '29 minutes'");
    await assert.rejects(staffInsert(client, carol, shop, 'cash'), err => {
      assert.match(err.message, /manual_too_soon/);
      assert.match(err.detail, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}/);
      return true;
    });
    await clearManual(carol);
    await seed(carol, "now() - interval '30 minutes 1 second'");
    await staffInsert(client, carol, shop, 'cash');

    // Daily limit: 3 entries today refuse the 4th, whatever their spacing.
    await clearManual(carol);
    for (let i = 0; i < 3; i++) await seed(carol, 'public.london_day_start(now())');
    await assert.rejects(staffInsert(client, carol, shop, 'cash'), /manual_daily_limit_reached/);
    // Yesterday's entries don't count.
    await clearManual(carol);
    for (let i = 0; i < 3; i++) await seed(carol, "public.london_day_start(now()) - interval '31 minutes'");
    await staffInsert(client, carol, shop, 'cash');

    // Two concurrent staff entries don't both pass.
    await clearManual(carol);
    const [s1, s2] = [await newClient(), await newClient()];
    const staffTx = async c => {
      await c.query('begin');
      await c.query("select set_config('request.jwt.claims', $1, true)",
        [JSON.stringify({ role: 'authenticated', sub: staff })]);
      await c.query('set local role authenticated');
    };
    const manualInsert = "insert into public.transactions (user_id, business_id, type, value, manual_payment_method) values ($1, $2, 'stamp', 1, 'cash')";
    await staffTx(s1);
    await staffTx(s2);
    await s1.query(manualInsert, [carol, shop]);
    const blocked = s2.query(manualInsert, [carol, shop]).then(() => 'inserted', e => e.message);
    await new Promise(resolve => setTimeout(resolve, 300));
    await s1.query('commit');
    assert.match(await blocked, /manual_too_soon/, 'the second concurrent entry waits, then is refused');
    await s2.query('rollback');

    // Exemptions: admin, service role, unlinked customer, shop without an active Location.
    await as(client, 'authenticated', admin,
      "insert into public.transactions (user_id, business_id, type, value) values ($1, $2, 'stamp', 1)", [carol, shop]);
    await as(client, 'service_role', null,
      "insert into public.transactions (user_id, business_id, type, value) values ($1, $2, 'stamp', 1)", [carol, shop]);
    await staffInsert(client, carol, syncingShop, null);
    const noCardCustomer = randomUUID();
    await client.query('insert into auth.users(id) values ($1)', [noCardCustomer]);
    await client.query('insert into public.memberships(user_id, business_id) values ($1, $2)', [noCardCustomer, shop]);
    await staffInsert(client, noCardCustomer, shop, null);

    // --- customer_card_link_status ---
    const status = (caller, customer, business) => as(client, 'authenticated', caller,
      'select public.customer_card_link_status($1, $2) as s', [customer, business]);
    const st = (await status(staff, carol, shop)).rows[0].s;
    assert.equal(st.linked, true);
    assert.equal(typeof st.manualToday, 'number');
    assert.equal((await status(owner, carol, syncingShop)).rows[0].s.linked, false, 'syncing shop is not linked');
    assert.equal((await status(staff, noCardCustomer, shop)).rows[0].s.linked, false);
    await assert.rejects(status(stranger, carol, shop), /not allowed/);
    await assert.rejects(status(carol, carol, shop), /not allowed/, 'customers cannot call it');
  } finally {
    await stop();
  }
});
