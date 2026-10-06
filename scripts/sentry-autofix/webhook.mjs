import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_BODY = 256 * 1024;
const REPOSITORY = 'theloyaltyloop1-blip/The-Loyalty-Loop';
const json = (status, body) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store' },
});

export function validSignature(raw, signature, secret) {
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature ?? '')) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

function numericId(value) {
  const text = String(value ?? '');
  return /^\d{1,20}$/.test(text) ? text : null;
}

// Sentry issue-alert payloads contain the event, not necessarily data.issue.
// URLs are only parsed for an ID; no URL from the payload is ever fetched.
export function alertIdentity(payload, projectId) {
  if (payload?.action !== 'triggered') return null;
  const event = payload.data?.event;
  if (!event || numericId(event.project) !== projectId) return null;
  const environment = event.environment ?? event.tags?.find?.(
    (tag) => Array.isArray(tag) && tag[0] === 'environment',
  )?.[1];
  if (environment !== 'production') return null;
  const issueId = numericId(event.issue_id ?? event.groupID ?? payload.data?.issue?.id)
    ?? numericId(String(event.web_url ?? '').match(/\/issues\/(\d+)(?:\/|\?|$)/)?.[1]);
  const eventId = event.event_id ?? event.eventID ?? event.id;
  const release = typeof event.release === 'string' ? event.release : event.release?.version;
  if (!issueId || !/^[a-f0-9]{32}$/i.test(eventId ?? '') || !/^[a-f0-9]{40}$/i.test(release ?? '')) return null;
  return { issue_id: issueId, event_id: eventId.toLowerCase(), release: release.toLowerCase(), project_id: projectId };
}

async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); return null; }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function handleAlert(request, { env = process.env, fetchImpl = fetch } = {}) {
  if (request.method !== 'POST') return json(405, { error: 'POST required' });
  if (env.SENTRY_AUTOFIX_ENABLED !== 'true' || env.VERCEL_ENV !== 'production') {
    return json(503, { error: 'Automatic repair is disabled' });
  }
  if (!env.SENTRY_WEBHOOK_SECRET || !env.SENTRY_AUTOFIX_GITHUB_TOKEN || !numericId(env.SENTRY_PROJECT_ID)) {
    return json(503, { error: 'Automatic repair is not configured' });
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json(415, { error: 'JSON required' });
  }
  const raw = await readBody(request);
  if (raw === null) return json(413, { error: 'Payload too large' });
  if (!validSignature(raw, request.headers.get('sentry-hook-signature'), env.SENTRY_WEBHOOK_SECRET)) {
    return json(401, { error: 'Invalid signature' });
  }
  // Resource is not signed; payload action, project and production release are
  // validated too, and the runner re-fetches the canonical event from Sentry.
  if (request.headers.get('sentry-hook-resource') !== 'event_alert') {
    return json(200, { ignored: 'Unsupported resource' });
  }
  let payload;
  try { payload = JSON.parse(raw.toString('utf8')); }
  catch { return json(400, { error: 'Invalid JSON' }); }
  const identity = alertIdentity(payload, env.SENTRY_PROJECT_ID);
  if (!identity) return json(200, { ignored: 'Not an eligible production alert with a commit release' });
  try {
    const result = await fetchImpl(`https://api.github.com/repos/${REPOSITORY}/actions/workflows/sentry-autofix.yml/dispatches`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(800),
      headers: {
        Authorization: `Bearer ${env.SENTRY_AUTOFIX_GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json', 'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref: 'main', inputs: identity }),
    });
    if (result.status !== 204) return json(502, { error: 'Repair dispatch failed' });
    return json(202, { accepted: true, issue_id: identity.issue_id });
  } catch {
    // Do not log payloads, headers, upstream response bodies or credentials.
    return json(502, { error: 'Repair dispatch unavailable' });
  }
}
