# R1–R4 staged deployment runbook

Prepared 2026-09-29. **Instructions only; none of this runbook has been executed.**

Authority: [CLAUDE_HANDOFF.md](../CLAUDE_HANDOFF.md), “R1–R4 implementation review: APPROVED for staged deployment”, and [repair design §7](CARD_LIFECYCLE_REPAIR_R1-R4.md#7-acceptance-to-be-checked-by-claudes-review). Claude approved the implementation and completed the Edge type check. Product-owner authorization for this deployment window and the later smoke test is still required.

Release contents:

- `supabase/migrations/20260929071345_fidel_card_lifecycle_repair.sql`.
- `fidel-card-claim`, `fidel-card-unlink`, `fidel-card-delete-sweep`, `delete-my-account`, each bundled from the reviewed source tree with `_shared/fidel-cards.ts`.
- `_shared/fidel-cards.ts` is a shared module, **not a fifth deployable function**. `fidel-webhook` needs no Edge deployment: its existing RPC call uses the replaced SQL function. `fidel-card-session` is outside this deployment set; its existing identity RPC uses the new tombstone check.

No secrets, provider configuration, schedules, status corrections, seed data, historical-event replays or unrelated releases are included. The orphan pass supports retired metadata only and is disabled under live keys. Unknown-metadata age rule 2 remains deferred. A listing that exceeds ten 100-card pages fails closed.

## 1. Prepare and capture read-only baselines

An authorized operator runs these later, from the reviewed repository root and the intended project's SQL editor. Keep results in the private release record. Use an already authenticated CLI session; enter any authentication prompt through the normal secure mechanism. Do not put credentials in commands, files or this document. `<PROJECT_REF>` is a placeholder, not the project's actual reference.

Confirm the source revision, migration checksum and deployment approval in the release record. Preserve the existing migration history. These CLI commands establish the target, inspect history and preview pending migrations; linking writes local CLI association only:

```powershell
supabase --version
supabase link --project-ref "<PROJECT_REF>"
if ($LASTEXITCODE -ne 0) { throw "Project link failed" }
supabase migration list --linked
if ($LASTEXITCODE -ne 0) { throw "Migration history inspection failed" }
supabase db push --linked --dry-run
if ($LASTEXITCODE -ne 0) { throw "Migration preview failed" }
supabase functions list --project-ref "<PROJECT_REF>" --output json
if ($LASTEXITCODE -ne 0) { throw "Function baseline inspection failed" }
```

**Run `supabase migration list --linked` and the dry run once read-only well before scheduling the window, as well as at its start** (Claude review, 2026-09-29). The handoff records that `20260925172000_fidel_member_spend_progress.sql` and `20260925190000_spend_switchover.sql` were applied live, but not how. If either shows as local-only or remote-only, the gate below will fail. That mismatch must be resolved as a separate reviewed task before any window is booked, never inside it. Earlier recorded pushes used `--skip-vault` (handoff, 2026-09-22/23) and later ones didn't. Use it only if the installed CLI's `db push --help` shows it and the CLI would otherwise try to sync vault secrets.

**Proceed only if the dry run lists exactly `20260929071345_fidel_card_lifecycle_repair.sql`.** If it lists other migrations, reports divergent history, or the repair is already applied, stop and assess the actual state. Do not use `--include-all`, migration-history repair, reset, seed or role import to force this release through. Capture each target function's current version, status, update time and JWT setting using CLI output and the Dashboard's read-only function details where needed. Historical version numbers in the handoff are not today's baseline.

### 1.1 All Location statuses, including Pure Elegant

```sql
begin transaction read only;

select l.id as mapping_id, l.business_id, b.name as business_name,
       l.fidel_program_id, l.fidel_location_id,
       l.fidel_status, l.fidel_status_checked_at,
       case when l.fidel_status = 'active' then 'eligible_location'
            else 'auth_will_not_earn_after_migration' end as r4_effect
from public.business_fidel_locations l
left join public.businesses b on b.id = l.business_id
order by b.name, l.fidel_program_id, l.fidel_location_id;

-- Discovery check only: confirm the FULL returned program/Location against
-- the owner's intended Test-mode Pure Elegant mapping, not just this suffix.
select l.business_id, b.name, l.fidel_program_id, l.fidel_location_id,
       l.fidel_status,
       coalesce(l.fidel_status = 'active', false) as expected_active
from public.business_fidel_locations l
join public.businesses b on b.id = l.business_id
where right(l.fidel_location_id, 4) = '4944'
order by b.name, l.fidel_location_id;

rollback;
```

Expected: the intended **Pure Elegant Test Location ending `4944` is `active`**. A missing, ambiguous, different-business or non-active result is a stop condition. Do not update its status as part of this runbook. Review every non-active/null row's impact with the owner: the migration immediately stops new auth awards there. Historical clearing/refund processing remains eligible for purchase correlation. The database mapping alone does not prove the provider environment; the owner confirms Test mode from their existing setup without exposing keys.

### 1.2 Predict the backfill and enumerate owed deletions

These queries use only columns that exist before the repair:

```sql
begin transaction read only;

select (unlinked_at is not null) as is_unlinked,
       (fidel_deleted_at is not null) as provider_deletion_confirmed,
       count(*) as card_rows
from public.linked_cards
group by 1, 2
order by 1, 2;

select case
         when unlinked_at is null then 'active (NULL state)'
         when fidel_deleted_at is not null then 'deleted'
         when fidel_delete_error is not null then 'failed'
         else 'pending'
       end as expected_backfill_state,
       count(*) as card_rows
from public.linked_cards
group by 1
order by 1;

select c.id as linked_card_id, c.user_id, c.fidel_card_id,
       c.unlinked_at, c.unlink_reason,
       (c.fidel_delete_error is not null) as has_delete_error,
       case when c.fidel_delete_error is not null then 'failed'
            else 'pending' end as expected_backfill_state,
       exists (select 1 from public.linked_cards a
               where a.fidel_card_id = c.fidel_card_id
                 and a.unlinked_at is null) as active_row_for_same_card
from public.linked_cards c
where c.unlinked_at is not null and c.fidel_deleted_at is null
order by c.unlinked_at, c.id;

rollback;
```

Save counts and row IDs for comparison immediately after migration. An empty error string is still non-null and backfills to `failed`. Unlinked rows with a confirmed deletion backfill to `deleted` even if an error also exists. Pending/failed rows that share a card ID with an active row are not permission to send DELETE; the lease protocol prevents deleting the active enrollment. Do not run the sweep to “clean up” during this read-only stage.

### 1.3 One-window readiness

Arrange an owner-coordinated quiet window: no app link/recovery/unlink, account deletion, manual sweep invocation or Playground activity while components are mixed. Confirm existing callers/jobs and in-flight removals are quiescent; a quiet device alone does not establish this if other users or automation can call them. The linking kill switch is not a maintenance barrier: recovery and unlink do not depend on it. If quiescence cannot be established without additional operational changes, stop and obtain a separately approved traffic-control plan. This document does not change settings or install a scheduler.

Run the prechecks at the start of that quiet window and retain their timestamps. Have all four reviewed bundles ready. Do not leave the migration and legacy DELETE callers mixed overnight or between separate sessions. One window reduces exposure; **the CLI deployments are not an atomic switch**.

## 2. Deploy in this exact order, in one authorized window

The commands below are mutations for the later authorized operator only. Target association and the single-pending-migration condition must already be verified in §1. Keep the quiet window in force throughout. Execute from the same reviewed source tree:

```powershell
supabase db push --linked
if ($LASTEXITCODE -ne 0) { throw "Migration failed or status uncertain: stop and inspect history; do not deploy Edge Functions" }

supabase functions deploy fidel-card-claim --project-ref "<PROJECT_REF>"
if ($LASTEXITCODE -ne 0) { throw "Mixed deployment: keep traffic quiescent and follow section 4" }
supabase functions deploy fidel-card-unlink --project-ref "<PROJECT_REF>"
if ($LASTEXITCODE -ne 0) { throw "Mixed deployment: keep traffic quiescent and follow section 4" }
supabase functions deploy fidel-card-delete-sweep --project-ref "<PROJECT_REF>"
if ($LASTEXITCODE -ne 0) { throw "Mixed deployment: keep traffic quiescent and follow section 4" }
supabase functions deploy delete-my-account --project-ref "<PROJECT_REF>"
if ($LASTEXITCODE -ne 0) { throw "Mixed deployment: keep traffic quiescent and follow section 4" }
```

Do not omit a function or deploy all repository functions indiscriminately. Do not pass `--no-verify-jwt`: all four must retain JWT verification. The sweep also enforces its existing service credential check. `fidel-webhook` retains its separately configured `verify_jwt = false` and signature validation; this release does not change it. Record the migration completion time in UTC and all four deployment results before allowing smoke-test actions.

CLI syntax is based on the official [migration push](https://supabase.com/docs/reference/cli/supabase-db-push), [function deploy](https://supabase.com/docs/reference/cli/supabase-functions-deploy) and [function listing](https://supabase.com/docs/reference/cli/supabase-functions-list) references. Check the operator's installed CLI help before the window if its version differs; do not guess unsupported flags.

## 3. Post-deployment read-only verification

### 3.1 Release history and function versions

```powershell
supabase migration list --linked
if ($LASTEXITCODE -ne 0) { throw "Cannot verify migration history" }
supabase functions list --project-ref "<PROJECT_REF>" --output json
if ($LASTEXITCODE -ne 0) { throw "Cannot verify function versions" }
```

The repair must appear applied remotely. Each of the four target functions must be ACTIVE with a version newer than its captured baseline and an update time in this window. Confirm JWT verification remains enabled from function details. Check the deployed source/bundle read-only in the Dashboard: claim uses v2, unlink/sweep/account use lease helpers, and all four contain the reviewed shared module. A version increment alone does not prove which source was deployed. Webhook and session versions should remain unchanged. Do not invoke endpoints just to obtain a version. Supabase Edge versions are Management/Dashboard metadata, not PostgreSQL function version numbers.

### 3.2 New and replacement SQL function ACLs

Run this catalog query; it does **not** invoke any lifecycle/webhook RPC:

```sql
begin transaction read only;
with expected(signature) as (values
  ('public.claim_linked_card_v2(uuid,text,text,text,text,boolean)'),
  ('public.begin_fidel_card_delete(uuid)'),
  ('public.finish_fidel_card_delete(uuid,text,integer)'),
  ('public.begin_fidel_account_deletion(uuid)'),
  ('public.prepare_fidel_account_card_delete(uuid,text)'),
  ('public.complete_fidel_account_deletion(uuid)'),
  ('public.abort_fidel_account_deletion(uuid)'),
  ('public.fidel_orphan_card_action(text,text)'),
  ('public.finish_fidel_orphan_delete(text,integer)'),
  ('public.fidel_location_accepts_new_awards(public.business_fidel_locations)'),
  ('public.fidel_link_identity(uuid)'),
  ('public.claim_linked_card(uuid,text,text,text,text)'),
  ('public.unlink_linked_card(uuid,uuid,text)'),
  ('public.mark_fidel_card_deleted(uuid,text)'),
  ('public.fidel_cards_pending_delete(integer)'),
  ('public.process_fidel_webhook_event(text,text,text,text,text,text,text,integer,boolean,boolean)')
)
select e.signature, p.oid is not null as present,
       p.prosecdef as security_definer, p.proconfig,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_can_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as user_can_execute,
       exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
               where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_can_execute
from expected e
left join pg_proc p on p.oid = to_regprocedure(e.signature)
order by e.signature;

select c.oid::regclass as table_name, c.relrowsecurity as rls_enabled,
       c.relacl,
       has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as anon_has_any_privilege,
       has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as user_has_any_privilege
from pg_class c
where c.oid in (to_regclass('public.fidel_retired_metadata_ids'),
                to_regclass('public.fidel_orphan_delete_leases'))
order by table_name;
rollback;
```

Expected: 16 function rows, all present, security definer, `search_path=""`, service execute true, anon/authenticated/PUBLIC execute false. Two table rows, RLS true and client privileges false. Missing or unexpected results are a hold condition. The three-argument finish signature has a default for its attempt argument; do not assume a separate two-argument overload should exist.

### 3.3 Backfill and invariant results

Run before resuming card activity. Compare with §1.2; initially `in_progress`/`superseded` counts are zero, attempts zero and leases null. Subsequent legitimate operations can change those facts; compare timestamps rather than overwriting states to match the snapshot.

```sql
begin transaction read only;
select coalesce(fidel_delete_state, 'active (NULL state)') as state,
       (unlinked_at is not null) as is_unlinked,
       (fidel_deleted_at is not null) as provider_deletion_confirmed,
       count(*) as card_rows, min(fidel_delete_attempts) as min_attempts,
       max(fidel_delete_attempts) as max_attempts,
       count(*) filter (where fidel_delete_lease_until is not null) as leased_rows
from public.linked_cards
group by 1, 2, 3
order by 1, 2, 3;

select id as linked_card_id, unlinked_at, fidel_deleted_at,
       fidel_delete_state, fidel_delete_attempts, fidel_delete_lease_until
from public.linked_cards
where ((unlinked_at is null) is distinct from (fidel_delete_state is null))
   or (coalesce(fidel_delete_state = 'deleted', false) is distinct from (fidel_deleted_at is not null))
   or ((fidel_delete_lease_until is not null) is distinct from coalesce(fidel_delete_state = 'in_progress', false))
   or fidel_delete_attempts < 0;

select id as linked_card_id, user_id, unlinked_at, unlink_reason,
       fidel_delete_state, fidel_delete_attempts, fidel_delete_lease_until
from public.linked_cards
where fidel_delete_state in ('pending', 'failed', 'in_progress')
order by unlinked_at, id;
rollback;
```

The invariant query must return no rows. Compare each pending/failed row with the pre-deploy deletion list. Backfill itself sends no DELETE and does not prove provider removal. Re-run §1.1 to confirm the Pure Elegant Location is still Active.

### 3.4 Existing webhook evidence only — no test calls

```sql
begin transaction read only;
select e.id as ledger_id, e.received_at, e.event_type, e.outcome,
       e.fidel_transaction_id, p.id as purchase_id,
       p.original_amount_pence, p.progress_credited_pence, p.status as purchase_status,
       b.name as business_name, l.fidel_location_id, l.fidel_status as location_status_now,
       case when e.outcome = 'processed' then 'stored_processed_outcome'
            when e.outcome is null then 'historical_purchase_only_not_new_rpc_proof'
            else 'investigate_outcome' end as evidence_strength
from public.fidel_webhook_events e
join public.fidel_transactions p on p.fidel_transaction_id = e.fidel_transaction_id
join public.businesses b on b.id = p.business_id
join public.business_fidel_locations l on l.business_id = p.business_id
where e.event_type = 'transaction.auth'
  and right(l.fidel_location_id, 4) = '4944'
  and l.fidel_status = 'active'
order by e.received_at desc
limit 20;

select outcome, count(*) as events
from public.fidel_webhook_events
group by outcome
order by outcome nulls first;
rollback;
```

The deployed `fidel-webhook` handler returns HTTP 200 for the new RPC statuses `ineligible_location` and `refund_membership_missing`, which is the correct acknowledgement. However, its "reconciliation required" warning log lists only the older statuses. Quiet function logs therefore don't mean nothing was refused: use the stored `outcome` counts above. Adding the two statuses to that warning belongs with the next reviewed webhook change, not this release.

Use the owner's verified full mapping from §1.1 to disambiguate results. The old ledger did not store Location IDs; the join shows the purchase business's **current** mapping, not proof of the event's exact Location or its status at receipt.

If an already-arrived auth row after the recorded migration completion has `outcome='processed'` and the matching purchase, it supports successful processing by the new RPC; matching read-only delivery logs, if already available, support the actual HTTP response. Pre-migration rows normally have NULL outcome and only establish historical purchase evidence. With no qualifying post-deploy row, record **“post-deploy Active auth processing not yet observed”**, not a pass or failure. This stage must not manufacture evidence by calling the webhook/RPC, replaying a message, inserting a row or using Playground. The separately authorized smoke test below can supply new evidence later.

## 4. Rollback limits and forward-fix procedure

Before migration: cancel the window if any precondition fails; no release mutation is needed. If migration reports failure or a connection drops, inspect migration history and catalog read-only before deciding whether it applied. Do not blindly rerun a non-idempotent migration or mark history applied/reverted.

After successful migration there is **no safe automatic rollback** in this release. Added columns/tables, backfilled deletion states, retired identities, new leases and ledger outcomes are durable facts. Dropping them would discard removal intent and audit evidence. Provider deletions cannot be undone by restoring a local active row; a shopper would need a genuine fresh enrollment. Newly awarded spend/rewards must not be erased to recreate a prior balance.

**Do not redeploy legacy functions.** Old bare-DELETE code bypasses the lease protocol and can delete a newly relinked enrollment under the new schema. Preserved SQL signatures provide staged compatibility, not permission to leave old callers running indefinitely.

If an Edge deployment fails, retain the quiet window, record which functions advanced, and retry the missing function from the same approved source after resolving the deployment error. Continue the remaining ordered deployments; verify all four together before reopening. Do not roll successful functions back. If the source itself is defective, prepare a reviewed forward fix preserving state/ACLs/leases; use a new additive migration for any SQL correction and a coordinated corrected function deployment. Test locally, obtain the owner's authorization for the concrete repair, then follow the same checks.

If traffic cannot remain quiescent, escalate for an explicitly approved containment plan. Do not invent an automatic secret rotation, kill-switch change, status flip or scheduler change. Do not clear leases/tombstones manually to force success. The normal card lease is five minutes with a 20-second HTTP timeout; an abandoned account tombstone expires after an hour, while retired metadata intentionally stays blocked. Recovery of an account whose later deletion steps failed must preserve that distinction.

## 5. Separately authorized owner-assisted smoke test

Only after the four-function verification passes and the owner approves this **Test-mode** activity. This section describes future writes; it is not part of §3's read-only verification. Do not run account deletion, a sweep, a refund or a real card payment for this smoke test.

1. Confirm the Android shopper build has native card linking, the test account is a member of Pure Elegant, the exact program/Location is the verified Active Test mapping and the card is owner-approved for testing. Stop if any identity/environment is uncertain. Do not capture card numbers, keys or metadata secrets in the report.
2. Capture current membership progress, visit count, redemption hold, reward count, reward thresholds and active card count. Use the read-only query below, replacing only `<SHOPPER_USER_ID>` with the chosen account's UUID; store the exact business/Location IDs with the evidence. Do not reset anything to zero or reuse the historical `-726p`/£10 snapshot.

```sql
begin transaction read only;
select m.id as membership_id, m.user_id, m.business_id, b.name,
       b.reward_model, b.reward_threshold_pence,
       m.reward_progress_pence, m.visit_count, m.redemption_blocked_reason,
       l.fidel_program_id, l.fidel_location_id, l.fidel_status,
       (select count(*) from public.rewards r
        where r.user_id=m.user_id and r.business_id=m.business_id) as total_reward_rows,
       (select count(*) from public.rewards r
        where r.user_id=m.user_id and r.business_id=m.business_id
          and r.redeemed_at is null) as unredeemed_reward_rows,
       (select jsonb_agg(jsonb_build_object('title',rc.title,'threshold_pence',rc.spend_threshold_pence)
                         order by rc.spend_threshold_pence)
        from public.reward_catalog rc
        where rc.business_id=m.business_id and rc.spend_threshold_pence is not null) as spend_tiers
from public.memberships m
join public.businesses b on b.id=m.business_id
join public.business_fidel_locations l on l.business_id=m.business_id
where m.user_id='<SHOPPER_USER_ID>'::uuid
  and right(l.fidel_location_id,4)='4944';

select id as linked_card_id, card_scheme, last_numbers, linked_at, unlinked_at,
       fidel_delete_state, fidel_deleted_at, fidel_delete_attempts,
       fidel_delete_lease_until
from public.linked_cards
where user_id='<SHOPPER_USER_ID>'::uuid
order by linked_at, id;
rollback;
```

3. **If the chosen test card is already an active row for this account** (the 2026-09-25 milestone account had one active Visa), skip this step and start at step 4 with that row. Re-enrolling a card Fidel still holds returns the SDK's `cardAlreadyExists`, which leads into the known R9 message defect rather than testing R1–R4. Otherwise, on Android, link one test card through the SDK. Refresh Linked cards; confirm one corresponding active row and no unexpected duplicate. Save the local row ID. If already at the five-card limit, stop and let the owner choose a different test account/card; do not remove unrelated cards.
4. Unlink that card. Confirm it disappears and its local row is unlinked. Wait for recorded `deleted`/`fidel_deleted_at` before the normal relink test. If removal is `pending`, `failed` or `in_progress`, reopening Linked cards must not reactivate it. Record the result and stop; do not invoke the sweep or repeat enrollment to bypass it.
5. Explicitly relink through the SDK after confirmed deletion. Confirm a new active local row and preserved historical row; the provider ID may or may not be reused. Reopen the screen and verify stability. Link/unlink/relink alone must not change progress or rewards. If SDK `cardAlreadyExists` or a mixed recover-all status produces “belongs elsewhere”, follow [R9](CLAUDE_IMPLEMENTATION_REVIEW_2026-09-25.md#r9--p2-the-duplicate-card-error-can-falsely-say-the-card-belongs-elsewhere): inspect actual rows/status, record the UI defect and stop rather than attributing ownership from the message.
6. Refresh the membership snapshot immediately before the purchase. Agree one positive GBP Test-mode authorization amount with the owner. Prefer an amount below the next reward threshold so the expected delta is simple; derive it from current progress/tiers. Negative progress is legitimate. If a threshold crossing is unavoidable or intended, calculate the expected issued tiers and cycle carry from the current configuration before proceeding. Do not assume the displayed progress always rises by the raw amount when a reward cycle resets.
7. The owner creates **one** new Playground auth for that relinked test card at the verified Active Location, using the agreed amount. Record its new transaction ID and UTC time. Do not replay or manually call the webhook/RPC, and do not create another event if delivery is delayed. Observe existing delivery logs and ledger instead.
8. Re-run the read-only queries in §3.4 and this section. Locate that exact new transaction ID: expect auth outcome `processed`, one purchase and one spend row, correctly bound to the active card/user/business; verify the expected progress/reward changes. Use this additional read-only query, replacing the transaction ID placeholder:

```sql
begin transaction read only;
select e.id as ledger_id, e.received_at, e.outcome,
       p.id as purchase_id, p.user_id, p.business_id, p.linked_card_id,
       p.original_amount_pence, p.progress_credited_pence, p.status,
       (select count(*) from public.transactions t
        where t.note='fidel:auth:' || e.fidel_transaction_id
          and t.type::text='spend') as matching_spend_rows
from public.fidel_webhook_events e
left join public.fidel_transactions p on p.fidel_transaction_id=e.fidel_transaction_id
where e.event_type='transaction.auth'
  and e.fidel_transaction_id='<PLAYGROUND_TRANSACTION_ID>';
rollback;
```

Expected: one ledger row, matching purchase, `processed`, `matching_spend_rows=1`, amount equal to the agreed pence and correct ownership. Record missing/delayed delivery as unverified; do not call it success or alter fixtures. Any ownership mismatch, unexpected award, removal reactivation or duplicate spend is a stop/forward-fix issue.

Finally, record actual versions, timestamps, pre/post snapshots and pass/fail/unverified results in `CLAUDE_HANDOFF.md`. This smoke test does not prove real refund delivery, scheduling, notification recovery, iOS behaviour, R5–R9 completion or full pilot readiness.
