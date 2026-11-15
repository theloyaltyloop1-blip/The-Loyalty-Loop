# The Loyalty Loop: rules for Claude

Four parts: shopper app (`apps/shopper`, Expo), Business app (`apps/retailer`, Expo),
website (`apps/web`, Vite, hosted on Vercel), backend (`supabase/`, Postgres + edge functions).
"The owner" means the user. There is no Codex. Claude does all building and all review.

## Before any work

1. Run `git fetch origin`.
2. The live code is the branch `origin/main`. Ignore `origin/HEAD` and any tool that says
   the main branch is `apps/web`; that is an old branch.
3. The main project folder is usually on an old branch with other sessions' uncommitted
   files in it. Never judge whether a feature exists from the main folder. Read
   `origin/main`: `git show origin/main:<path>` or `git grep <text> origin/main`.
4. Read the first 150 lines of `CLAUDE_HANDOFF.md` on `origin/main`. Newest entries are at
   the top. Do not read the whole file. Search it when you need history.
5. Read `ARCH_PLAN.md` only for Fidel card-linking work. That feature is parked.
6. In `apps/shopper` or `apps/retailer`, also follow that folder's `AGENTS.md`.

## Who builds

- The main chat only reads, investigates, reviews, advises and manages sessions.
- Every code change, asset, merge, migration and release is done in a sub-session.
  Give it a full brief: files, goal, what done looks like, and these rules.
- Small edits to `CLAUDE_HANDOFF.md` and memory notes are allowed in the main chat.

## Starting a piece of work (sub-sessions)

1. Make a new worktree and branch from `origin/main`. Never from the main folder's branch.
2. Run a real `npm ci` in the worktree. Do not borrow `node_modules` from another folder.
3. Build, then run the checks in "Checks" below.
4. Add a handoff entry (see "Handoff").
5. Stop and report. Wait for the owner's yes before any commit, push, deploy,
   migration or OTA. One yes covers only the thing it was given for.

## Code rules

- Pop-ups in both apps: `showAlert` from `src/components/AppAlert.tsx`. Never `Alert.alert`.
- Dashboards keep their coloured tiles: sage, peach and amber tiles, the peach AI card, and
  the Business app's 2px dark tile borders. Improve structure if asked. Never make tiles
  white, grey or uniform.
- Prefer pop-up sheets and colour over grey system-style lists.
- Use the owner's logo files exactly as given. Resize only.
- Never wrap `require()` of a native module in try/catch as protection. Check
  `requireOptionalNativeModule('<Name>')` from `expo-modules-core` first.

## Checks

- Shopper or Business app: `npx tsc --noEmit` in the app folder.
- Website: `npm --prefix apps/web run build`.
- Say exactly which checks ran and which did not. "Not checked on a phone" must be written
  when true. Never report a check that was not run.

## Release checklist

### Website
1. Work is on a branch from `origin/main`, merged or rebased onto the latest `origin/main`.
2. `npm --prefix apps/web run build` passes.
3. Owner says yes.
4. Push to `main`. Vercel deploys by itself.
5. Open https://www.the-loyalty-loop.com and confirm the change is visible.
6. Add the handoff entry with the commit hash.

### OTA (JavaScript-only changes to either app)
1. Confirm the change is JS only: no change to `package.json`, `app.json`, lockfile or
   native config since the store build. If there is one, stop: it needs a native build.
2. Work from a worktree at `origin/main` with a real `npm ci`. Run from the app folder.
3. Owner says yes.
4. Publish each platform separately. `--platform all` fails.
   `npx --yes eas-cli@24.11.0 update --channel production --environment production --platform android --message "<what changed>"`
   then the same with `--platform ios`.
   `--environment production` is required every time. Without it the bundle has no
   Supabase keys and every phone shows "App configuration needed".
5. An OTA only reaches the app version it was published for. Publish for every version
   still on phones. The list is in the "Current state" block at the top of
   `CLAUDE_HANDOFF.md`.
6. Verify each uploaded bundle, not a local export. Download the launch asset from
   `https://u.expo.dev/update/<updateId>` and confirm it contains the Supabase project ref
   `tgukdabfvvoywawmzbdo` and a text string from the new code.
7. Add the handoff entry: commit hash, every update group ID, and the rollback command.
8. Tell the owner the update shows on the second app launch.
9. For a big release, draft the announcement emails for owners and shoppers. The owner
   sends them. Claude never sends.

### Native build
1. Only when the owner says to build. A JS-only change never gets a build.
2. Before starting, state why the change needs native code and wait for the yes.
3. Include everything waiting for a build. The list is in "Current state" in the handoff.
4. New native features get a new app version, so older phones are not sent JS they cannot run.
5. After the build: submit, then update "Current state" with versions and build numbers.

## Never

- Never commit, push, deploy, apply a migration, publish an OTA or start a build without
  the owner's yes for that action.
- Never build in the main chat.
- Never branch from, release from, or judge features by the main folder.
- Never run `eas update` without `--environment production`.
- Never run `eas update --platform all`.
- Never start an EAS build for a JS-only change.
- Never use `Alert.alert`.
- Never flatten or strip colour from dashboard tiles.
- Never suggest contacting Fidel. The owner cannot. Use docs, tests and pilot results.
- Never send emails or messages for the owner.
- Never put credentials, keys, or customer or card data in any file or chat.
- Never claim a check passed that was not run.

## Handoff

After each finished piece of work (a feature, fix, review, migration or release), add one
entry at the TOP of the log in `CLAUDE_HANDOFF.md`, under "Current state":

`## YYYY-MM-DD - <what> - <LIVE | NOT shipped | design only>`

Include: what changed, branch and commit, files, checks run, checks not run, what is still
open, and the next action with its owner (owner or Claude). When a release changes which
versions are on phones, update "Current state".
