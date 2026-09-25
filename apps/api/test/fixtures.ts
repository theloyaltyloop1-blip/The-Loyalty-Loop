import type { FidelConfig } from '../src/providers/fidel.js';

// Synthetic local fixtures, not Fidel credentials or a captured payment.
export const config: FidelConfig = {
  secret: 'local-test-secret-only', webhookUrl: 'https://test.example/webhooks/fidel',
  accountId: '11111111-1111-4111-8111-111111111111',
  programId: '22222222-2222-4222-8222-222222222222',
};

export const payload = {
  id: '33333333-3333-4333-8333-333333333333',
  accountId: config.accountId, programId: config.programId,
  card: { id: '44444444-4444-4444-8444-444444444444' },
  location: { id: '55555555-5555-4555-8555-555555555555' },
  auth: true, cleared: false, amount: 12.50, currency: 'GBP',
};
