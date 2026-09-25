import { Router, raw } from 'express';
import { fidelController } from '../controllers/fidel.js';
import { authenticateFidel } from '../middleware/fidel-signature.js';
import type { FidelConfig } from '../providers/fidel.js';
import type { StampRepository } from '../types/transaction.js';

export function webhookRoutes(config: FidelConfig, repository: StampRepository): Router {
  const router = Router();
  router.post('/fidel', (req, res, next) => {
    if (!req.is('application/json')) {
      res.status(415).json({ error: 'json_required' });
      return;
    }
    next();
  }, raw({ type: 'application/json', limit: '64kb', inflate: false }),
  authenticateFidel(config), fidelController(config, repository));
  return router;
}
