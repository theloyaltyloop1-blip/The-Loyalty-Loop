# Sentry automatic repair

Implementation and activation owner: **Codex**. The owner explicitly requested
automatic deployment of passing fixes on 6 October 2026. No Claude approval is
required. Current state: implemented and locally tested, **not activated**.

## Pipeline

1. An internal Sentry integration sends an issue alert to
   `https://www.the-loyalty-loop.com/api/sentry-alert`.
2. The receiver verifies HMAC-SHA256 over the raw body using the integration's
   client secret, checks `event_alert` / `triggered`, production environment,
   project and a 40-character commit release, then dispatches
   `.github/workflows/sentry-autofix.yml` explicitly on `main`.
3. Preparation retrieves the canonical Sentry event and issue via the API. Their
   project, event, issue, environment, release and severity must match. A stale
   release is refused. Only bounded exception/frame diagnostics are retained;
   user, request, breadcrumb and variable data are omitted. Common tokens, email
   addresses and URL queries are redacted; this is not universal PII detection.
4. A deterministic `codex/sentry-<issue>-<hash>` branch claims exactly one attempt
   per issue/release before any paid model call. The isolated Codex runner uses
   the official Codex action. It has neither Sentry nor publication credentials.
5. A fresh verifier applies the proposed patch and enforces the trusted path,
   file-mode and 400-line/10-file bounds. It runs a new regression against the
   exact original source with identical dependencies, requiring an assertion
   failure (missing imports/syntax/timeouts do not count), then requires the
   regression to pass with the repair. Web source lint and build run separately.
   Tracked-file integrity is checked after tests and build.
6. A fresh publication job rechecks scope and the verified patch hash, creates
   a PR, verifies strict protected-branch checks, and requests automatic squash
   merge for the exact PR head. Full CI and an up-to-date base remain mandatory.
   A changed main leaves the PR for re-verification rather than merging stale
   proof. The existing Vercel Git integration deploys after merge.

The workflow reports stage results in its Actions summary. GitHub failure
notifications depend on the owner's existing notification settings. It does not
mark Sentry issues resolved, claim production deployment health, or roll back a
deployment automatically. A failed deployment/error recurrence must be observed
through Vercel and Sentry. A repair can begin automatically; no successful fix or
response time is guaranteed.

## Automatically deployable scope

Only bounded website source fixes that have a meaningful regression are eligible.
The exact allowlist is `scripts/sentry-autofix/policy.mjs`. The pipeline cannot
modify itself, CI, build settings, dependencies, authentication, authorization,
payments/rewards/stamps/scans, account settings, admin/owner paths, legal copy,
mobile apps, SQL or Edge Functions. These are reported for Codex follow-up.

The current Sentry project instruments the website only. Mobile apps are not
instrumented and cannot be monitored or released by this pipeline. Existing
Fidel/WhatsApp/OTA release gates remain unchanged.

Current production builds do not upload source maps. Minified errors can lack
enough evidence for a meaningful fix; Codex must report `insufficient_evidence`.
Source-map upload needs its own private artifact configuration; never expose
source maps publicly as an activation shortcut.

## Verified account facts

- Vercel project: `loyalty-loop` (`prj_V2chVllrYdj7ACGIfqMxuk2RcRhR`).
- Sentry organization: `the-loyalty-loop`; project: `javascript-react`;
  numeric ID: `4512209368907856`; EU API host: `de.sentry.io`.
- GitHub: `theloyaltyloop1-blip/The-Loyalty-Loop`. Current default branch is
  `apps/web`, `main` is unprotected and auto-merge is disabled (read-only check).
- Vercel has the client DSN only; none of this pipeline's server credentials are
  present. Browser is signed in to Sentry. GitHub connector can publish source,
  but cannot manage secrets/settings or read protected-branch configuration.
  Local `gh` auth failed. No OpenAI API billing/key was verified.

## Activation steps (Codex retains ownership)

1. Publish this implementation, preserving unrelated local work, and verify CI
   on the actual commit. Ensure GitHub registers the workflow: dispatch workflows
   need their definition on the default branch. The repository's production
   branch is `main` but its default is `apps/web`; align the default to `main`
   deliberately, or register the identical workflow on the default branch and
   verify a dispatch using `ref: main`. Do not assume the explicit ref alone
   solves registration.
2. Enable squash/automatic merging in GitHub repository settings. Protect main
   with strict up-to-date required checks `web`, `api`, `mobile`, `sentry-autofix`.
   Do not bypass existing protections. Enable Actions to create PRs.
3. Configure credentials through provider secret settings, never chat or files:

   | Location | Name | Purpose |
   | --- | --- | --- |
   | Vercel production | `SENTRY_WEBHOOK_SECRET` | Sentry internal integration client secret |
   | Vercel production | `SENTRY_AUTOFIX_GITHUB_TOKEN` | Repository-limited GitHub Actions write token for dispatch |
   | GitHub Actions secret | `SENTRY_AUTH_TOKEN` | Sentry project/event read access, scoped to this organization/project |
   | GitHub Actions secret | `OPENAI_API_KEY` | Official Codex action API credential; API billing is separate from this chat subscription |
   | GitHub Actions secret | `SENTRY_AUTOFIX_PUBLISH_TOKEN` | Repository-limited Contents write, Pull requests write, Administration read (protection inspection) |

   Use a PAT or GitHub App installation token for publication so PR CI and Vercel
   receive events; the job's default `GITHUB_TOKEN` can suppress follow-on CI.
   Static App tokens expire; use a refresh/installation-token step if selecting
   an App. Do not store a one-hour token as a permanent secret.
4. Set repository variables `SENTRY_ORG=the-loyalty-loop`,
   `SENTRY_PROJECT=javascript-react`, `SENTRY_PROJECT_ID=4512209368907856`,
   `SENTRY_API_HOST=de.sentry.io`, `SENTRY_AUTOFIX_ENABLED=true`.
   Set Vercel production variables `SENTRY_PROJECT_ID=4512209368907856`,
   `SENTRY_AUTOFIX_ENABLED=true` after other activation gates pass. Keep preview
   disabled. Redeploy the exact intended main commit to load server secrets and
   the commit/environment event tags (do not publish the dirty working tree).
5. Create an internal Sentry integration with the URL above and issue-alert
   access. Add an alert action to notify that integration when a new or regressed
   error occurs in `production` for `javascript-react`. Use Sentry's real signed
   test delivery to verify the exact body/signature/resource contract.
6. **Sentry specifies a response within one second.** This receiver awaits GitHub
   dispatch, bounded to 800ms; it acknowledges only after acceptance and returns
   502 on transport/API failure. It is not a durable queue. Verify real cold-start
   response latency and provider retry behavior before calling it active. If the
   target is not met, add durable ingestion/dispatch recovery rather than silently
   acknowledging lost work. Retry/replay requests are deduplicated at the branch
   claim, not at receiver ingestion.
7. Verify a real eligible event completes canonical lookup, claim and diagnosis.
   A synthetic no-fix event must end without merge. Only enable unattended fixes
   after a controlled complete before/after regression passes in GitHub's Node 22
   runners. Verify merged commit, Vercel READY, production endpoint and actual
   error behavior. Record every actual result in `CLAUDE_HANDOFF.md`.

## Stop and retry

- Kill switch: disable the repository variable and the Vercel server variable
  `SENTRY_AUTOFIX_ENABLED`; redeploy Vercel to refresh its environment. Cancel an
  already-running workflow separately and disable any pending PR auto-merge.
- A claimed branch is retained after failures, preventing repeated paid attempts
  from the same alert/release. Read the run summary and diagnose first. To retry,
  deliberately delete that claim branch (after preserving any PR/code) and use
  workflow_dispatch with the same issue/event/project/release identifiers.
- Closing a PR does not automatically reset the claim. A new production release
  gets a different claim key. Multiple different issues can run concurrently;
  publish checks and branch protection stop stale-base merges.
- A successful dispatch is not a successful fix or deploy. Never mark an issue
  resolved merely because a workflow was started or merged.

## Local verification

```powershell
node --test scripts/sentry-autofix/autofix.test.mjs scripts/sentry-autofix/verifier.test.mjs
npm --prefix apps/web run lint -- src
npm run build:web
git diff --check
```

The four verifier scenarios create disposable Git repositories under ignored
`.tmp/sentry-verifier-*` and never alter the project branch/index. These tests
cover a passing before/after fix, an ineffective fix, a missing-module fake
reproduction, and forbidden configuration changes. They do not invoke a model,
use credentials, dispatch a hosted workflow or deploy.

Official contracts:
[Sentry webhook headers/signatures](https://github.com/getsentry/sentry-docs/blob/master/docs/integrations/integration-platform/webhooks.mdx),
[Sentry issue alerts](https://github.com/getsentry/sentry-docs/blob/master/docs/integrations/integration-platform/webhooks/issue-alerts.mdx),
[Sentry project event API](https://docs.sentry.io/api/events/retrieve-an-event-for-a-project/),
[Codex GitHub Action](https://learn.chatgpt.com/docs/github-action),
[Vercel Node handlers](https://vercel.com/docs/functions/runtimes/node-js).
