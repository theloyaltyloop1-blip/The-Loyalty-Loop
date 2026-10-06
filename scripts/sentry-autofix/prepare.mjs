import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function dispatchIdentity(event) {
  const value = event.client_payload ?? event.inputs;
  if (!value || !/^\d{1,20}$/.test(value.issue_id ?? '')
    || !/^\d{1,20}$/.test(value.project_id ?? '')
    || !/^[a-f0-9]{32}$/i.test(value.event_id ?? '')
    || !/^[a-f0-9]{40}$/i.test(value.release ?? '')) throw new Error('Invalid alert identifiers');
  return { issue_id: value.issue_id, event_id: value.event_id.toLowerCase(),
    project_id: value.project_id, release: value.release.toLowerCase() };
}

export function repairBranch(identity) {
  const key = createHash('sha256').update(`${identity.issue_id}:${identity.release}`).digest('hex').slice(0,16);
  return `codex/sentry-${identity.issue_id}-${key}`;
}

export function redact(value, max = 1200) {
  return String(value ?? '').slice(0, max)
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/(?:[\w.+-]+)@(?:[\w.-]+)\.[a-z]{2,}/gi, '[email]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_.-]{20,})\b/g, '[token]')
    .replace(/https?:\/\/[^\s"<>]+/g, (url) => {
      try { const parsed = new URL(url); return `${parsed.origin}${parsed.pathname}`; }
      catch { return '[url]'; }
    });
}

function tag(event, key) {
  return event.tags?.find?.((item) => item.key === key)?.value
    ?? event.tags?.find?.((item) => Array.isArray(item) && item[0] === key)?.[1];
}

export function canonicalContext(event, issue, identity, config) {
  const eventProject = String(event.projectID ?? event.project?.id ?? event.project ?? '');
  const eventIssue = String(event.groupID ?? event.issue_id ?? '');
  const release = typeof event.release === 'string' ? event.release : event.release?.version;
  if (String(issue.id) !== identity.issue_id || String(issue.project?.id) !== config.projectId
    || eventProject !== config.projectId || eventIssue !== identity.issue_id
    || (event.eventID ?? event.event_id ?? event.id)?.toLowerCase() !== identity.event_id
    || release?.toLowerCase() !== identity.release
    || (event.environment ?? tag(event, 'environment')) !== 'production') {
    throw new Error('Canonical Sentry event does not match the production alert');
  }
  if (!['error', 'fatal'].includes(event.level ?? tag(event, 'level'))) throw new Error('Not an error event');
  const exceptionEntry = event.entries?.find((entry) => entry.type === 'exception');
  const values = exceptionEntry?.data?.values ?? event.exception?.values ?? [];
  const exceptions = values.slice(0,3).map((value) => ({
    type: redact(value.type, 150), message: redact(value.value),
    frames: (value.stacktrace?.frames ?? []).filter((frame) => frame.inApp ?? frame.in_app).slice(-12)
      .map((frame) => ({ file: redact(frame.filename ?? frame.absPath ?? frame.abs_path, 300),
        function: redact(frame.function, 150), line: frame.lineNo ?? frame.lineno,
        column: frame.colNo ?? frame.colno })),
  }));
  return { ...identity, title: redact(issue.title, 250), platform: redact(event.platform, 50), exceptions };
}

export async function prepare({ env = process.env, fetchImpl = fetch } = {}) {
  const identity = dispatchIdentity(JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8')));
  if (identity.project_id !== env.SENTRY_PROJECT_ID) throw new Error('Project is not allowlisted');
  if (identity.release !== env.BASE_SHA) throw new Error('Alert is from an older release; refusing a speculative repair');
  const host = env.SENTRY_API_HOST || 'sentry.io';
  if (!['sentry.io','us.sentry.io','de.sentry.io'].includes(host)) throw new Error('Unsupported Sentry API host');
  for (const key of ['SENTRY_AUTH_TOKEN','SENTRY_ORG','SENTRY_PROJECT']) {
    if (!env[key]) throw new Error(`${key} is required`);
  }
  const get = async (path) => {
    const response = await fetchImpl(`https://${host}/api/0/${path}`, {
      headers: { Authorization: `Bearer ${env.SENTRY_AUTH_TOKEN}` },
      redirect: 'error', signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Sentry lookup failed (${response.status})`);
    return response.json();
  };
  const [issue, event] = await Promise.all([
    get(`issues/${identity.issue_id}/`),
    get(`projects/${encodeURIComponent(env.SENTRY_ORG)}/${encodeURIComponent(env.SENTRY_PROJECT)}/events/${identity.event_id}/`),
  ]);
  const context = canonicalContext(event, issue, identity, { projectId: env.SENTRY_PROJECT_ID });
  writeFileSync('.sentry-context.json', JSON.stringify(context, null, 2));
  appendFileSync(env.GITHUB_OUTPUT, `branch=${repairBranch(identity)}\nissue_id=${identity.issue_id}\nbase_sha=${identity.release}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prepare().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
