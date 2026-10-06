import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { handleAlert, validSignature, alertIdentity } from './webhook.mjs';
import { dispatchIdentity, repairBranch, canonicalContext, redact } from './prepare.mjs';
import { allowedPath, validateRepair } from './policy.mjs';

const release = 'a'.repeat(40), eventId = 'b'.repeat(32);
const identity = { issue_id: '123', event_id: eventId, project_id: '456', release };
const env = { VERCEL_ENV: 'production', SENTRY_AUTOFIX_ENABLED: 'true',
  SENTRY_WEBHOOK_SECRET: 'fixture-secret', SENTRY_AUTOFIX_GITHUB_TOKEN: 'fixture-github', SENTRY_PROJECT_ID: '456' };
const payload = () => ({ action: 'triggered', data: { event: {
  project: 456, environment: 'production', issue_id: '123', event_id: eventId, release,
  user: { email: 'private@example.com' }, request: { headers: { authorization: 'secret' } },
} } });
const sign = (raw) => createHmac('sha256',env.SENTRY_WEBHOOK_SECRET).update(raw).digest('hex');
function request(value = payload(), options = {}) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  return new Request('https://example.com/api/sentry-alert', { method: 'POST', body: raw,
    headers: { 'content-type': 'application/json', 'sentry-hook-resource': 'event_alert',
      'sentry-hook-signature': sign(raw), ...options } });
}

test('raw-body signature rejects tampering, wrong length and wrong secrets', () => {
  const raw = '{ "action": "triggered" }';
  assert.equal(validSignature(Buffer.from(raw),sign(raw),env.SENTRY_WEBHOOK_SECRET), true);
  assert.equal(validSignature(Buffer.from(raw.trim() + ' '),sign(raw),env.SENTRY_WEBHOOK_SECRET), false);
  assert.equal(validSignature(Buffer.from(raw),sign(raw),'other'), false);
  for (const signature of ['', 'a', 'zz'.repeat(32), undefined]) {
    assert.equal(validSignature(Buffer.from(raw),signature,env.SENTRY_WEBHOOK_SECRET), false);
  }
});

test('valid production alert dispatches only allowlisted identifiers', async () => {
  let call;
  const response = await handleAlert(request(),{ env, fetchImpl: async (...args) => {
    call = args; return new Response(null,{ status: 204 });
  } });
  assert.equal(response.status,202);
  assert.equal(call[0],'https://api.github.com/repos/theloyaltyloop1-blip/The-Loyalty-Loop/actions/workflows/sentry-autofix.yml/dispatches');
  assert.deepEqual(JSON.parse(call[1].body),{ ref: 'main', inputs: identity });
  assert.equal(call[1].body.includes('private@example.com'),false);
});

test('disabled, preview, missing config and wrong method never dispatch', async () => {
  const never = async () => { assert.fail('Unexpected network call'); };
  for (const config of [{ ...env, SENTRY_AUTOFIX_ENABLED: 'false' }, { ...env, VERCEL_ENV: 'preview' },
    { ...env, SENTRY_WEBHOOK_SECRET: '' }, { ...env, SENTRY_PROJECT_ID: '../456' }]) {
    assert.equal((await handleAlert(request(),{ env: config,fetchImpl: never })).status,503);
  }
  assert.equal((await handleAlert(new Request('https://example.com'),{ env,fetchImpl: never })).status,405);
});

test('unauthenticated, malformed, oversized and non-JSON bodies are rejected', async () => {
  const never = async () => { assert.fail('Unexpected network call'); };
  const run = (req) => handleAlert(req,{ env,fetchImpl: never });
  assert.equal((await run(request(payload(),{ 'sentry-hook-signature': '0'.repeat(64) }))).status,401);
  assert.equal((await run(request('{'))).status,400);
  assert.equal((await run(request(' '.repeat(256 * 1024 + 1)))).status,413);
  assert.equal((await run(request(payload(),{ 'content-type': 'text/plain' }))).status,415);
});

test('wrong project/environment/release and unsupported actions are acknowledged without repair', async () => {
  const never = async () => { assert.fail('Unexpected network call'); };
  for (const field of [{ project: 789 }, { environment: 'preview' }, { release: 'unknown' }, { event_id: 'bad' }]) {
    const value = payload(); Object.assign(value.data.event,field);
    const response = await handleAlert(request(value),{ env,fetchImpl: never });
    assert.equal(response.status,200);
    assert.match(JSON.stringify(await response.json()),/ignored/);
  }
  const value = payload(); value.action = 'resolved';
  assert.equal(alertIdentity(value,'456'),null);
  assert.equal((await handleAlert(request(payload(),{ 'sentry-hook-resource': 'installation' }),{ env,fetchImpl: never })).status,200);
});

test('issue permalink and environment tags are supported without fetching payload URLs', () => {
  const value = payload(); delete value.data.event.issue_id; delete value.data.event.environment;
  value.data.event.web_url = 'https://host.invalid/organizations/demo/issues/123/events/';
  value.data.event.tags = [['environment','production']];
  assert.deepEqual(alertIdentity(value,'456'),identity);
});

test('GitHub rejection and transport failure return retryable errors without upstream details', async () => {
  for (const fetchImpl of [async () => new Response('private token failure',{ status: 403 }),
    async () => { throw new Error('private token'); }]) {
    const response = await handleAlert(request(),{ env,fetchImpl });
    assert.equal(response.status,502);
    assert.equal(JSON.stringify(await response.json()).includes('private'),false);
  }
});

test('dispatch inputs and deterministic claim isolate issues/releases', () => {
  assert.deepEqual(dispatchIdentity({ client_payload: identity }),identity);
  assert.deepEqual(dispatchIdentity({ inputs: identity }),identity);
  assert.throws(() => dispatchIdentity({ inputs: { ...identity,issue_id: '$(bad)' } }));
  assert.equal(repairBranch(identity),repairBranch({ ...identity,event_id: 'c'.repeat(32) }));
  assert.notEqual(repairBranch(identity),repairBranch({ ...identity,release: 'd'.repeat(40) }));
  assert.match(repairBranch(identity),/^codex\/sentry-123-[a-f0-9]{16}$/);
});

function eventFixture() {
  return { eventID: eventId,groupID: '123',projectID: '456',release: { version: release },
    platform: 'javascript',tags: [{ key: 'environment',value: 'production' },{ key: 'level',value: 'error' }],
    user: { email: 'private@example.com' },request: { body: 'private body' },
    entries: [{ type: 'exception',data: { values: [{ type: 'TypeError',value: 'Failure for private@example.com',
      stacktrace: { frames: [{ inApp: true,filename: 'https://example.com/src/helpers.ts?token=secret',lineNo: 4,colNo: 5 }] } }] } },
    { type: 'breadcrumbs',data: { values: ['private breadcrumb'] } }] };
}
test('canonical API evidence validates identity and omits customer/request/breadcrumb data', () => {
  const result = canonicalContext(eventFixture(),{ id: '123',project: { id: '456' },title: 'Error' },identity,{ projectId: '456' });
  const text = JSON.stringify(result);
  assert.equal(text.includes('private'),false);
  assert.equal(text.includes('token=secret'),false);
  assert.equal(result.exceptions[0].frames[0].file,'https://example.com/src/helpers.ts');
});

test('canonical event mismatches and warning severity fail closed', () => {
  for (const field of [{ projectID: '999' },{ groupID: '999' },{ eventID: 'f'.repeat(32) },
    { release: { version: 'f'.repeat(40) } },{ environment: 'preview' },{ level: 'warning' }]) {
    assert.throws(() => canonicalContext({ ...eventFixture(),...field },
      { id: '123',project: { id: '456' } },identity,{ projectId: '456' }));
  }
});

test('common diagnostic credentials and email addresses are scrubbed', () => {
  const value = redact('Bearer abc private@example.com https://example.com/a?token=abc sk-123456789');
  assert.equal(value.includes('private@example.com'),false);
  assert.equal(value.includes('token=abc'),false);
  assert.equal(value.includes('sk-123456789'),false);
});

const result = { outcome: 'fixed',summary: 'Fix',regression_test: 'apps/web/src/lib/date.test.mjs' };
const changes = [{ path: result.regression_test,status: 'A' },{ path: 'apps/web/src/lib/date.ts',status: 'M' },
  { path: 'CLAUDE_HANDOFF.md',status: 'M' }];
test('eligible web helper and new regression with handoff pass the publication policy', () => {
  assert.doesNotThrow(() => validateRepair(result,changes));
});

test('self-modification, auth/payment/native/database/config and symlink-style paths cannot auto-deploy', () => {
  for (const path of ['.github/workflows/ci.yml','scripts/sentry-autofix/policy.mjs','vercel.json',
    'apps/web/package.json','apps/shopper/App.tsx','supabase/migrations/new.sql','apps/web/src/main.tsx',
    'apps/web/src/pages/owner/Help.tsx','apps/web/src/lib/auth.ts','apps/web/src/lib/reward.ts',
    'apps/web/src/pages/Profile.tsx','apps/web/src/../../secret.ts','apps\\web\\src\\date.ts']) {
    assert.equal(allowedPath(path),false,path);
    assert.throws(() => validateRepair(result,[...changes,{ path,status: 'M' }]));
  }
});

test('missing reproduction, reused tests, deleted files and unconfirmed outcomes cannot deploy', () => {
  assert.throws(() => validateRepair({ ...result,outcome: 'insufficient_evidence' },changes));
  assert.throws(() => validateRepair({ ...result,regression_test: '' },changes));
  assert.throws(() => validateRepair(result,changes.map((item) => ({ ...item,status: 'M' }))));
  assert.throws(() => validateRepair(result,changes.filter((item) => item.path !== 'CLAUDE_HANDOFF.md')));
  assert.throws(() => validateRepair(result,[...changes,{ path: 'apps/web/src/lib/other.ts',status: 'D' }]));
});
