import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Keep disposable repos in the ignored project scratch directory; no live repo
// branch, index, worktree registration or credentials are changed by this test.
mkdirSync('.tmp',{ recursive: true });
const fixtureRoot = resolve('.tmp');
function fixture({ correct = true, brokenTest = false, forbidden = false } = {}) {
  const dir = mkdtempSync(join(fixtureRoot,'sentry-verifier-'));
  const write = (path,text) => {
    mkdirSync(resolve(dir,path,'..'),{ recursive: true });
    writeFileSync(resolve(dir,path),text);
  };
  for (const name of ['verify.mjs','policy.mjs']) {
    mkdirSync(resolve(dir,'scripts/sentry-autofix'),{ recursive: true });
    copyFileSync(resolve('scripts/sentry-autofix',name),resolve(dir,'scripts/sentry-autofix',name));
  }
  write('.gitignore','.sentry-*\nnode_modules/\n');
  write('apps/web/src/lib/day.ts','export function days(value) { return Math.ceil(value); }\n');
  write('CLAUDE_HANDOFF.md','Original\n');
  write('vercel.json','{}\n');
  mkdirSync(resolve(dir,'apps/web/node_modules'),{ recursive: true });
  const git = (...args) => execFileSync('git',args,{ cwd: dir,encoding: 'utf8',stdio: ['ignore','pipe','pipe'] });
  git('init'); git('config','user.name','Fixture'); git('config','user.email','fixture@localhost');
  git('config','core.autocrlf','false'); git('add','.'); git('commit','-m','Baseline');
  const base = git('rev-parse','HEAD').trim();
  write('apps/web/src/lib/day.ts',correct
    ? 'export function days(value) { return Number.isFinite(value) ? Math.ceil(value) : 0; }\n'
    : 'export function days(value) { return Math.floor(value); }\n');
  write('apps/web/src/lib/day.test.mjs',brokenTest
    ? "import './missing.ts';\n"
    : "import test from 'node:test'; import assert from 'node:assert/strict'; import { days } from './day.ts'; test('missing day count has no remaining days', () => assert.equal(days(undefined), 0));\n");
  write('CLAUDE_HANDOFF.md','Verified fixture repair\n');
  if (forbidden) write('vercel.json','{"rewrites":[]}\n');
  git('add','.');
  write('.sentry-proposal/repair.patch',git('diff','--cached','--binary'));
  write('.sentry-proposal/result.json',JSON.stringify({ outcome: 'fixed',summary: 'Fixture',regression_test: 'apps/web/src/lib/day.test.mjs' }));
  git('reset','--hard',base);
  return { dir,base };
}

function verify(value) {
  return spawnSync(process.execPath,['scripts/sentry-autofix/verify.mjs'],{
    cwd: value.dir,env: { ...process.env,BASE_SHA: value.base },encoding: 'utf8',timeout: 60_000,
  });
}

test('clean verifier executes an assertion-failing baseline and passing repair', () => {
  const outcome = verify(fixture());
  assert.equal(outcome.status,0,outcome.stdout + outcome.stderr);
  assert.match(outcome.stdout,/original fails an assertion, repair passes/);
});

test('verifier rejects a proposed fix whose regression still fails', () => {
  const outcome = verify(fixture({ correct: false }));
  assert.notEqual(outcome.status,0);
  assert.match(outcome.stderr,/does not pass on the repair/);
});

test('missing imports cannot masquerade as a before-fix reproduction', () => {
  const outcome = verify(fixture({ brokenTest: true }));
  assert.notEqual(outcome.status,0);
  assert.match(outcome.stderr,/does not demonstrate an assertion failure/);
});

test('trusted verifier blocks configuration changes even with a passing regression', () => {
  const outcome = verify(fixture({ forbidden: true }));
  assert.notEqual(outcome.status,0);
  assert.match(outcome.stderr,/Needs owner review: vercel.json/);
});
