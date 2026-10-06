import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { inspectRepair } from './policy.mjs';

const base = process.env.BASE_SHA;
if (!/^[a-f0-9]{40}$/.test(base ?? '')) throw new Error('Invalid verification baseline');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
git('apply','--check','.sentry-proposal/repair.patch');
git('apply','--index','.sentry-proposal/repair.patch');
// Make the staged tree inspectable without trusting any model-written scripts.
git('-c','user.name=Sentry verifier','-c','user.email=sentry-verifier@localhost',
  'commit','-m','Temporary Sentry verification');
copyFileSync('.sentry-proposal/result.json','.sentry-result.json');
const result = inspectRepair(base, 'HEAD');
const testPath = result.regression_test;
const testSource = readFileSync(testPath);
const testEnv = { ...process.env };
// A verifier can itself be exercised by node --test. Do not inherit that
// runner's internal binary reporter protocol into the regression subprocess.
delete testEnv.NODE_TEST_CONTEXT;
const run = () => spawnSync(process.execPath,
  ['--experimental-strip-types','--test','--test-timeout=30000',testPath],
  { env: testEnv, encoding: 'utf8', timeout: 45_000, maxBuffer: 1024 * 1024 });
// This is a disposable verifier checkout. Restore the exact original source
// tree, add ONLY the new test, then restore the proposed source for the after
// check. Dependencies stay identical; no junction/symlink permission is needed.
git('restore',`--source=${base}`,'--worktree','--','apps/web/src');
mkdirSync(dirname(testPath),{ recursive: true });
writeFileSync(testPath,testSource);
let before;
try { before = run(); }
finally { git('restore','--source=HEAD','--worktree','--','apps/web/src'); }
const after = run();
// Require an assertion failure, not a missing module, syntax error or timeout.
if (before.error || before.status === null || before.status === 0
  || !/ERR_ASSERTION|AssertionError/.test(before.stdout + before.stderr)
  || /ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|SyntaxError/.test(before.stdout + before.stderr)) {
  throw new Error('Regression does not demonstrate an assertion failure on the original release');
}
if (after.error || after.status !== 0) throw new Error('Regression does not pass on the repair');
git('diff','--exit-code','HEAD');
const extras = git('ls-files','--others','--exclude-standard').trim().split('\n').filter(Boolean);
if (extras.some((path) => path !== '.sentry-result.json' && !path.startsWith('.sentry-proposal/'))) {
  throw new Error('Regression created unexpected files');
}
// Only bounded runner output; raw Sentry evidence was never included in tests.
console.log('Independent regression: original fails an assertion, repair passes.');
git('diff','--check',base,'HEAD');
