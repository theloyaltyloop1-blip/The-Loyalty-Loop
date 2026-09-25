import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import EmbeddedPostgres from 'embedded-postgres';

// Unlike the focused Fidel fixture suite, this attempts every fetched migration
// unchanged. Missing Supabase platform dependencies fail explicitly; no SQL is
// stripped and a failed replay must never be reported as full-history coverage.
test('full fetched Supabase migration history replays unchanged', {
  timeout: 90000,
  skip: 'needs Supabase platform extensions (pg_net) unavailable in embedded PostgreSQL; pre-pilot gate, see CLAUDE_HANDOFF.md'
}, async () => {
  const listener = createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const { port } = listener.address();
  await new Promise(resolve => listener.close(resolve));
  const postgres = new EmbeddedPostgres({
    databaseDir: join(tmpdir(), 'loyalty-history-' + randomUUID()),
    port, password: randomUUID(), user: 'postgres', persistent: false,
    authMethod: 'scram-sha-256', postgresFlags: ['-h', '127.0.0.1'],
    onLog: () => {}, onError: () => {}
  });
  await postgres.initialise();
  await postgres.start();
  const client = postgres.getPgClient('postgres', '127.0.0.1');
  await client.connect();
  try {
    // Minimal auth platform bootstrap only. Public app objects come from history.
    await client.query(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
          nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
      $$;
      create function auth.role() returns text language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
          nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
      $$;
    `);
    const folder = new URL('../../../../supabase/migrations/', import.meta.url);
    const files = (await readdir(folder)).filter(name => name.endsWith('.sql')).sort();
    assert.ok(files.length >= 54, 'expected authoritative history plus corrective migration');
    for (const file of files) {
      try {
        await client.query(await readFile(new URL(file, folder), 'utf8'));
      } catch (error) {
        throw new Error(`Full-history replay stopped at ${file}: ${error.message}`, { cause: error });
      }
    }
  } finally {
    await client.end();
    await postgres.stop();
  }
});
