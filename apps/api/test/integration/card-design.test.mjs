import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { startFidelDatabase, as } from "./fidel-fixture.mjs";

test(
  "card design migration: strict schema, owner permissions, unchanged loyalty data",
  { timeout: 120000 },
  async () => {
    const f = await startFidelDatabase("card-design-");
    const db = f.client;
    try {
      await db.query(
        await readFile(
          new URL(
            "../../../../supabase/migrations/20261022100247_business_card_design.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const owner = randomUUID(),
        other = randomUUID(),
        admin = randomUUID(),
        shop = randomUUID();
      await db.query("insert into auth.users values($1),($2),($3)", [
        owner,
        other,
        admin,
      ]);
      await db.query("insert into test_admins values($1)", [admin]);
      await db.query("insert into businesses(id,owner_id) values($1,$2)", [
        shop,
        owner,
      ]);
      await db.query(`grant select,update on businesses to authenticated; alter table businesses enable row level security;
   create policy card_test_read on businesses for select to authenticated using(true);
   create policy card_test_owner_update on businesses for update to authenticated using(owner_id=auth.uid() or has_role(auth.uid(),'admin')) with check(owner_id=auth.uid() or has_role(auth.uid(),'admin'));`);
      const design = {
        version: 1,
        background: "roast",
        color: "#38271C",
        secondary: "#CE925B",
        icon: "coffee",
        font: "classic",
        layout: "row",
        entrance: "stamp",
        logoPosition: "left",
        photo: null,
      };
      const update = (actor, d) =>
        as(
          db,
          "authenticated",
          actor,
          "update businesses set card_design=$1 where id=$2 returning card_design",
          [d === null ? null : JSON.stringify(d), shop],
        );
      assert.equal(
        (
          await db.query("select card_design from businesses where id=$1", [
            shop,
          ])
        ).rows[0].card_design,
        null,
      );
      assert.deepEqual(
        (await update(owner, design)).rows[0].card_design,
        design,
      );
      assert.equal(
        (await update(other, { ...design, layout: "ring" })).rowCount,
        0,
      );
      assert.equal(
        (await update(admin, { ...design, layout: "bar" })).rows[0].card_design
          .layout,
        "bar",
      );
      // Broad future staff update policy must still not allow card-design edits.
      await db.query(
        "create policy card_test_broad_update on businesses for update to authenticated using(true) with check(true)",
      );
      await assert.rejects(update(other, design), /Only the shop owner/);
      for (const bad of [
        {},
        [],
        { ...design, version: 2 },
        { ...design, version: null },
        { ...design, layout: "canvas" },
        { ...design, color: "red" },
        { ...design, photo: "javascript:alert(1)" },
        { ...design, background: "photo" },
        { ...design, extra: "unexpected" },
        {
          ...design,
          photo: `https://abc.supabase.co/storage/v1/object/public/covers/${randomUUID()}/card-1.jpg`,
        },
      ])
        await assert.rejects(update(owner, bad), /check constraint/);
      const photo = `https://abc.supabase.co/storage/v1/object/public/covers/${shop}/card-123-abc.jpg`;
      assert.equal(
        (await update(owner, { ...design, background: "photo", photo })).rows[0]
          .card_design.photo,
        photo,
      );
      assert.equal((await update(owner, null)).rows[0].card_design, null);
      await assert.rejects(
        as(
          db,
          "anon",
          null,
          "update businesses set card_design=null where id=$1",
          [shop],
        ),
        /permission denied/,
      );
      assert.equal(
        (
          await db.query("select owner_id,name from businesses where id=$1", [
            shop,
          ])
        ).rows[0].owner_id,
        owner,
      );
    } finally {
      await f.stop();
    }
  },
);
