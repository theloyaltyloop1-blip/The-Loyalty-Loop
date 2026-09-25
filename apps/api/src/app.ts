import express, { type ErrorRequestHandler } from 'express';
import { WebhookError } from './lib/errors.js';
import { webhookRoutes } from './routes/webhooks.js';
import type { FidelConfig } from './providers/fidel.js';
import type { StampRepository } from './types/transaction.js';

export function createApp(config: FidelConfig, repository: StampRepository) {
  const app = express();
  app.disable('x-powered-by');
  // This router must precede any express.json() middleware to preserve signed bytes.
  app.use('/webhooks', webhookRoutes(config, repository));
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof WebhookError) {
      res.status(error.status).json({ error: error.code });
      return;
    }
    const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined;
    if (status === 413 || status === 415 || status === 400) {
      res.status(status).json({ error: 'invalid_request_body' });
      return;
    }
    // No payloads, secrets, connection strings, or database diagnostics in logs/responses.
    console.error('Fidel webhook persistence failed');
    res.status(503).json({ error: 'temporarily_unavailable' });
  };
  app.use(errors);
  return app;
}
