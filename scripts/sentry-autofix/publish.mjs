import { createHash } from 'node:crypto';
import { readFileSync, appendFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { inspectRepair } from './policy.mjs';

const env = process.env;
const repo = 'theloyaltyloop1-blip/The-Loyalty-Loop';
if (!env.GH_TOKEN) throw new Error('SENTRY_AUTOFIX_PUBLISH_TOKEN is required');
if (!/^codex\/sentry-\d{1,20}-[a-f0-9]{16}$/.test(env.REPAIR_BRANCH ?? '')
  || !/^[a-f0-9]{40}$/.test(env.BASE_SHA ?? '') || !/^\d{1,20}$/.test(env.SENTRY_ISSUE_ID ?? '')) {
  throw new Error('Invalid publish identifiers');
}
const patch = readFileSync('.sentry-proposal/repair.patch');
if (createHash('sha256').update(patch).digest('hex') !== env.EXPECTED_PATCH_HASH) throw new Error('Verified patch hash mismatch');
const git = (...args) => execFileSync('git',args,{ encoding: 'utf8' });
const api = async (path, method = 'GET', body) => {
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    method, redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(`GitHub publish failed (${response.status})`);
  return response.status === 204 ? null : response.json();
};
git('apply','--index','.sentry-proposal/repair.patch');
git('-c','user.name=Codex Sentry repair','-c','user.email=codex-sentry@localhost','commit','-m',`Fix Sentry issue ${env.SENTRY_ISSUE_ID}`);
copyFileSync('.sentry-proposal/result.json','.sentry-result.json');
inspectRepair(env.BASE_SHA,'HEAD');
// Publish through the Git data API: no repository code is run with write creds,
// no git credential helper persists the token, and only regular UTF-8 files pass.
const tree = git('diff','--name-only',env.BASE_SHA,'HEAD').trim().split('\n').map((path) => ({
  path, mode: '100644', type: 'blob', content: readFileSync(path,'utf8'),
}));
const baseCommit = await api(`git/commits/${env.BASE_SHA}`);
const newTree = await api('git/trees','POST',{ base_tree: baseCommit.tree.sha, tree });
const commit = await api('git/commits','POST',{
  message: `Fix Sentry issue ${env.SENTRY_ISSUE_ID}`, tree: newTree.sha, parents: [env.BASE_SHA],
});
const ref = await api(`git/ref/heads/${env.REPAIR_BRANCH}`);
if (ref.object.sha !== env.BASE_SHA) throw new Error('Repair branch changed after claim');
await api(`git/refs/heads/${env.REPAIR_BRANCH}`,'PATCH',{ sha: commit.sha, force: false });
const body = `Production Sentry issue ${env.SENTRY_ISSUE_ID}. Codex proposed a bounded website fix.\n\nIndependent verification: new regression fails by assertion on ${env.BASE_SHA}, passes with this repair; web lint/build and trusted scope checks passed. Proposal SHA-256: ${env.EXPECTED_PATCH_HASH}.\n\nOwner authorized automatic deployment of passing eligible fixes. No database, Edge Function or native release is included. Vercel deployment health and disappearance of the Sentry error still require observation.\n\nAutomation run: ${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
const pr = await api('pulls','POST',{
  title: `Fix Sentry issue ${env.SENTRY_ISSUE_ID}`, head: env.REPAIR_BRANCH, base: 'main', body,
});
appendFileSync(env.GITHUB_STEP_SUMMARY, `Repair PR: ${pr.html_url}\n`);
// Auto-merge must wait for full CI and an up-to-date base. Without a protected
// branch, --auto can merge immediately. Fail closed, keeping the verified PR.
const protection = await api('branches/main/protection');
const requiredChecks = protection.required_status_checks;
const contexts = new Set([...(requiredChecks?.contexts ?? []),
  ...(requiredChecks?.checks ?? []).map((check) => check.context)]);
if (requiredChecks?.strict !== true || !['web','api','mobile','sentry-autofix'].every((name) => contexts.has(name))) {
  throw new Error(`Main must require up-to-date web/api/mobile/sentry-autofix CI; PR #${pr.number} retained without auto-merge`);
}
// A changed main needs a fresh verified combined tree; never merge stale proof.
const main = await api('git/ref/heads/main');
if (main.object.sha !== env.BASE_SHA) {
  throw new Error(`Main changed; PR #${pr.number} retained for re-verification, not merged`);
}
// Use GitHub auto-merge so existing branch protection/required checks remain in
// force. PAT/App credentials are necessary for PR CI and Vercel push events.
execFileSync('gh',['pr','merge',String(pr.number),'--repo',repo,'--squash','--auto',
  '--match-head-commit',commit.sha], { stdio: 'inherit' });
appendFileSync(env.GITHUB_STEP_SUMMARY, 'Automatic merge requested. Existing Vercel integration deploys after merge; deployment success is not yet verified.\n');
