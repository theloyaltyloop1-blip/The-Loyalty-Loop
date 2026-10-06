import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function allowedPath(path) {
  if (path.includes('..') || path.includes('\\')) return false;
  if (['CLAUDE_HANDOFF.md','IMPLEMENTATION_TIMELINE.md'].includes(path)) return true;
  // Automation cannot modify itself, build config, dependencies, auth, legal,
  // databases, native apps or provider configuration and then approve itself.
  if (!path.startsWith('apps/web/src/')) return false;
  if (/(?:^|\/)(?:auth[^/]*|admin|owner|legal|payments?)(?:\/|\.|$)/i.test(path)) return false;
  if (/(?:supabase|auth|staff|reward|stamp|spend|scan|billing|checkout|settings|profile|onboarding|accesspanel)/i.test(path)) return false;
  if (['apps/web/src/main.tsx','apps/web/src/App.tsx','apps/web/src/index.css'].includes(path)) return false;
  return /\.(?:tsx?|css|test\.mjs)$/.test(path);
}

export function validateRepair(result, changes) {
  if (result.outcome !== 'fixed') throw new Error('Codex did not report a reproducible fix');
  if (!Array.isArray(changes) || !changes.length || changes.length > 10) throw new Error('Unexpected change scope');
  const regression = result.regression_test;
  if (!/^apps\/web\/src\/[A-Za-z0-9_./-]+\.test\.mjs$/.test(regression ?? '') || !allowedPath(regression)) {
    throw new Error('A new executable web regression test is required');
  }
  if (!changes.some(({ path, status }) => path === regression && status === 'A')) throw new Error('Regression test must be new');
  if (!changes.some(({ path }) => path === 'CLAUDE_HANDOFF.md')) throw new Error('Living handoff update required');
  for (const change of changes) {
    if (!['A','M'].includes(change.status) || !allowedPath(change.path)) throw new Error(`Needs owner review: ${change.path}`);
  }
  if (!changes.some(({ path }) => path.startsWith('apps/web/src/') && path !== regression)) throw new Error('No product fix');
}

export function inspectRepair(base, head, resultFile = '.sentry-result.json') {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
  const output = git('diff','--name-status','--no-renames',base,head).trim();
  const changes = output ? output.split('\n').map((line) => {
    const [status,path] = line.split('\t'); return { status,path };
  }) : [];
  const result = JSON.parse(readFileSync(resultFile, 'utf8'));
  validateRepair(result, changes);
  for (const { path } of changes) {
    const mode = git('ls-tree',head,'--',path).split(' ')[0];
    if (mode !== '100644' || lstatSync(path).isSymbolicLink()) throw new Error(`Unsupported file type: ${path}`);
  }
  const lines = git('diff','--numstat',base,head).trim().split('\n');
  const changedLines = lines.reduce((sum,line) => {
    const [added,removed] = line.split('\t').map(Number);
    if (!Number.isFinite(added) || !Number.isFinite(removed)) throw new Error('Binary changes not allowed');
    return sum + added + removed;
  }, 0);
  if (changedLines > 400) throw new Error('Repair exceeds 400 changed lines');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { inspectRepair(process.argv[2],process.argv[3]); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
